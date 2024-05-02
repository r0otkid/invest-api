function erfinv(x) {
    var z;
    var a = 0.147;
    var the_sign_of_x;
    if (x == 0) {
        the_sign_of_x = 0;
    } else if (x > 0) {
        the_sign_of_x = 1;
    } else {
        the_sign_of_x = -1;
    }

    if (x != 0) {
        var ln_1minus_x_sqrd = Math.log(1 - x * x);
        var ln_1minusxx_by_a = ln_1minus_x_sqrd / a;
        var ln_1minusxx_by_2 = ln_1minus_x_sqrd / 2;
        var ln_etc_by2_plus2 = ln_1minusxx_by_2 + (2 / (Math.PI * a));
        var first_sqrt = Math.sqrt((ln_etc_by2_plus2 * ln_etc_by2_plus2) - ln_1minusxx_by_a);
        var second_sqrt = Math.sqrt(first_sqrt - ln_etc_by2_plus2);
        z = second_sqrt * the_sign_of_x;
    } else { // если x == 0
        z = 0;
    }
    return z;
}

function calculateMarketVolatility(prices) {
    let meanPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    let variance = prices.reduce((sum, price) => sum + Math.pow(price - meanPrice, 2), 0) / prices.length;
    return Math.sqrt(variance);
}

function adjustWeights(weights, volatility) {
    let adjustedWeights = { ...weights };
    if (volatility > 1.5) { // это порог изменчивости, который считаем высоким
        adjustedWeights.macd *= 1.2; // увеличиваем вес MACD
        adjustedWeights.rsi *= 1.2; // увеличиваем вес RSI
    } else {
        adjustedWeights.sma *= 1.1; // увеличиваем вес SMA при низкой волатильности
        adjustedWeights.wma *= 1.1; // увеличиваем вес WMA при низкой волатильности
    }
    return adjustedWeights;
}

function calculateSMA(prices, windowSize) {
    // Это базовый метод анализа временных рядов,
    // который сглаживает временные ряды данных,
    // вычисляя среднее значение переменной за определенный предыдущий период.
    let sma = [];
    for (let i = windowSize - 1; i < prices.length; i++) {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) {
            sum += prices[i - j];
        }
        sma.push(sum / windowSize);
    }
    return sma;
}

function calculateEMA(prices, period) {
    // EMA придает больший вес наиболее недавним данным,
    // быстрее реагируя на изменения цен, чем SMA.
    let ema = [];
    let multiplier = 2 / (period + 1);
    ema[0] = prices[0]; // Используем первую цену как начальное значение EMA

    for (let i = 1; i < prices.length; i++) {
        let currentEma = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
        ema.push(currentEma);
    }
    return ema;
}

function calculateWMA(prices, windowSize) {
    // взвешенное скользящее
    const wma = [];
    let weightSum = 0;
    for (let i = 1; i <= windowSize; i++) {
        weightSum += i;
    }
    for (let i = windowSize - 1; i < prices.length; i++) {
        let weightedSum = 0;
        for (let j = 0; j < windowSize; j++) {
            weightedSum += prices[i - j] * (windowSize - j);
        }
        wma.push(weightedSum / weightSum);
    }
    return wma;
}

function calculateRSI(prices, period = 28) {
    // Индекс относительной силы (RSI - Relative Strength Index)
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) {
            gains += difference;
        } else {
            losses -= difference;
        }
    }

    const relativeStrength = (gains / period) / (losses / period);
    const rsi = 100 - (100 / (1 + relativeStrength));

    return rsi;
}

function calculateStochasticOscillator(prices, period = 28) {
    // Стохастический осциллятор - это индикатор моментума,
    // который сравнивает текущую цену закрытия с диапазоном цен за определенный период.
    const closingPrices = prices.slice(-period);
    const high = Math.max(...closingPrices);
    const low = Math.min(...closingPrices);
    const currentClose = prices[prices.length - 1];
    const stochastic = ((currentClose - low) / (high - low)) * 100;

    return stochastic;
}

function calculateMACD(prices, slowPeriod = 52, fastPeriod = 24, signalPeriod = 18) {
    // MACD — это трендовый следящий индикатор моментума, который показывает взаимосвязь
    // между двумя скользящими средними цены. Этот индикатор помогает выявить изменения в силе,
    // направлении, моментуме и продолжительности тренда на финансовом рынке.
    let fastEMA = calculateEMA(prices, fastPeriod);
    let slowEMA = calculateEMA(prices, slowPeriod);
    let macdLine = fastEMA.map((value, index) => value - slowEMA[index]);
    let signalLine = calculateEMA(macdLine, signalPeriod);
    let histogram = macdLine.map((value, index) => value - signalLine[index]);
    return { macdLine, signalLine, histogram };
}

function calculateBollingerBands(prices, period = 40, multiplier = 2) {
    // Bollinger Bands — это индикатор волатильности, который состоит из трех линий:
    // средней (простая скользящая средняя) и двух других, расположенных на определенном числе
    // стандартных отклонений от этой средней. Этот индикатор помогает оценить волатильность и
    // уровни перекупленности или перепроданности.
    let sma = calculateSMA(prices, period);
    let bands = { upper: [], lower: [], mid: sma };
    for (let i = period - 1; i < prices.length; i++) {
        let slice = prices.slice(i + 1 - period, i + 1);
        let mean = sma[i - period + 1];
        let stdDev = Math.sqrt(slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period);
        bands.upper.push(mean + multiplier * stdDev);
        bands.lower.push(mean - multiplier * stdDev);
    }
    return bands;
}

function calculateParabolicSAR(prices, step = 0.02, maxStep = 0.2) {
    // Parabolic SAR — это индикатор, который определяет потенциальные развороты в рыночной цене,
    // используемый в основном для установки стоп-лоссов. Этот индикатор показывает, когда моментум
    // меняется на противоположный, что может быть сигналом для выхода или изменения позиции.
    let sar = [prices[0]];
    let ep = prices[0]; // extreme point
    let af = step; // acceleration factor
    let uptrend = prices[1] > prices[0];

    for (let i = 1; i < prices.length; i++) {
        sar.push(uptrend ? sar[i - 1] + af * (ep - sar[i - 1]) : sar[i - 1] - af * (sar[i - 1] - ep));
        if ((uptrend && prices[i] > ep) || (!uptrend && prices[i] < ep)) {
            ep = prices[i];
            af = Math.min(maxStep, af + step);
        } else if ((uptrend && prices[i] < sar[i]) || (!uptrend && prices[i] > sar[i])) {
            uptrend = !uptrend;
            af = step;
            ep = prices[i];
            sar[i] = Math.max(...prices.slice(Math.max(0, i - 5), i));
        }
    }
    return sar;
}

function calculateAutocorrelation(prices, lag) {
    const n = prices.length;
    const mean = prices.reduce((sum, price) => sum + price, 0) / n;
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n - lag; i++) {
        numerator += (prices[i] - mean) * (prices[i + lag] - mean);
    }
    for (let i = 0; i < n; i++) {
        denominator += Math.pow(prices[i] - mean, 2);
    }

    return numerator / denominator;
}

function calculateLinearRegression(prices) {
    const n = prices.length;
    const xSum = prices.reduce((sum, _, idx) => sum + idx, 0);
    const ySum = prices.reduce((sum, price) => sum + price, 0);
    const xySum = prices.reduce((sum, price, idx) => sum + idx * price, 0);
    const x2Sum = prices.reduce((sum, _, idx) => sum + Math.pow(idx, 2), 0);

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - Math.pow(xSum, 2));
    const intercept = (ySum - slope * xSum) / n;

    return { slope, intercept };
}

function calculateCUSUM(prices) {
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const cusum = [0];
    for (let i = 1; i < prices.length; i++) {
        cusum[i] = cusum[i - 1] + (prices[i] - mean);
    }
    return cusum;
}

function calculateShapiroWilkTest(prices) {
    const n = prices.length;
    const mean = prices.reduce((sum, price) => sum + price, 0) / n;
    const s = Math.sqrt(prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / n);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const expectedValues = sortedPrices.map((_, i) => mean + s * Math.sqrt(2) * erfinv((i - 0.375) / (n + 0.25)));

    const b = expectedValues.reduce((sum, ev, i) => sum + ev * sortedPrices[i], 0);
    const W = Math.pow(b, 2) / prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0);

    return W;
}

function calculateSpearmanCorrelation(data1, data2) {
    if (data1.length !== data2.length) throw new Error("Arrays must be of the same length");

    const rank = (data) => {
        const sorted = data
            .map((value, index) => ({ value, index }))
            .sort((a, b) => a.value - b.value)
            .map((v, i) => ({ ...v, rank: i + 1 }));
        const ranks = Array(data.length);
        sorted.forEach(({ index, rank }) => {
            ranks[index] = rank;
        });
        return ranks;
    };

    const rank1 = rank(data1);
    const rank2 = rank(data2);

    const dSquared = rank1.map((rank, i) => Math.pow(rank - rank2[i], 2));
    const n = rank1.length;
    const spearman = 1 - (6 * dSquared.reduce((sum, d) => sum + d, 0) / (n * (n * n - 1)));

    return spearman;
}

function calculateDickeyFullerTest(prices) {
    const n = prices.length;
    const deltaY = prices.slice(1).map((price, i) => price - prices[i]);
    const yLag = prices.slice(0, n - 1);
    const deltaYMean = deltaY.reduce((sum, y) => sum + y, 0) / (n - 1);
    const yLagMean = yLag.reduce((sum, y) => sum + y, 0) / (n - 1);

    const sxx = yLag.reduce((sum, y) => sum + Math.pow(y - yLagMean, 2), 0);
    const sxy = yLag.reduce((sum, y, i) => sum + (y - yLagMean) * (deltaY[i] - deltaYMean), 0);

    const beta = sxy / sxx;
    const alpha = deltaYMean - beta * yLagMean;
    const seAlpha = Math.sqrt((1 / (n - 1)) * ((1 / sxx) * deltaY.reduce((sum, y) => sum + Math.pow(y - deltaYMean - beta * (y - yLagMean), 2), 0)));

    const tStatistic = alpha / seAlpha;
    return tStatistic;
}


function calculateProbabilityOfGrowth(ticker) {
    return openDatabase().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['quotes'], 'readonly');
            const store = transaction.objectStore('quotes');
            const index = store.index('ticker');
            const range = IDBKeyRange.only(ticker);
            const request = index.getAll(range);

            request.onsuccess = (event) => {
                const prices = event.target.result.map(item => item.price);
                if (!prices.length) {
                    console.log(`No prices available for the ticker ${ticker}`);
                    reject(new Error(`No prices available for the ticker ${ticker}.`));
                    return;
                }
                const meanPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                const stdDev = Math.sqrt(prices.reduce((sum, price) => sum + Math.pow(price - meanPrice, 2), 0) / prices.length);
                const threshold = 2 * stdDev;

                const lag = 1; // Сдвиг на один день назад
                const currentPrices = prices.slice(lag); // Цены начиная со второго дня
                const laggedPrices = prices.slice(0, -lag); // Цены до последнего дня

                const sma = calculateSMA(prices, smaWindowSize);
                const ema = calculateEMA(prices, emaPeriod);
                const wma = calculateWMA(prices, wmaWindowSize);

                const rsi = calculateRSI(prices, rsiPeriod);
                const macd = calculateMACD(prices);
                const bollinger = calculateBollingerBands(prices);
                const parabolicSAR = calculateParabolicSAR(prices);
                const regression = calculateLinearRegression(prices);
                const cusum = calculateCUSUM(prices);
                const autocorrelation = calculateAutocorrelation(prices, 1);
                const shapiroWilk = calculateShapiroWilkTest(prices);
                const spearman = calculateSpearmanCorrelation(currentPrices, laggedPrices);
                const dickeyFuller = calculateDickeyFullerTest(prices);

                const smaLast = sma[sma.length - 1];
                const emaLast = ema[ema.length - 1];
                const wmaLast = wma[wma.length - 1];
                const macdHistogramLast = macd.histogram[macd.histogram.length - 1];
                const priceLast = prices[prices.length - 1];
                const psarLast = parabolicSAR[parabolicSAR.length - 1];

                // Веса для каждого индикатора
                const volatility = calculateMarketVolatility(prices);
                let weights = {
                    ema: 0.25,
                    macd: 0.20,
                    wma: 0.15,
                    sma: 0.10,
                    rsi: 0.15,
                    bollinger: 0.10,
                    stochastic: 0.10,
                    regression: 0.10,
                    cusum: 0.05,
                    autocorrelation: 0.15,
                    shapiroWilk: 0.05,
                    spearman: 0.05,
                    dickeyFuller: 0.05
                };
                weights = adjustWeights(weights, volatility);

                // Расчет сигналов
                let weightedSum = 0;
                let weightTotal = 0;
                weightedSum += (emaLast > smaLast) * weights.ema;
                weightedSum += (emaLast > wmaLast) * weights.ema;
                weightedSum += (wmaLast > smaLast) * weights.wma;
                weightedSum += (macdHistogramLast > 0) * weights.macd;
                weightedSum += (priceLast > bollinger.upper[bollinger.upper.length - 1]) * weights.bollinger;
                weightedSum += (priceLast > psarLast) * weights.stochastic;
                weightedSum += (regression.slope > 0) * weights.regression;
                weightedSum += (Math.abs(cusum[cusum.length - 1]) > threshold) * (cusum[cusum.length - 1] > 0 ? weights.cusum : -weights.cusum);
                weightedSum += (autocorrelation > 0.5) * weights.autocorrelation;
                weightedSum += (shapiroWilk < 0.95) * weights.shapiroWilk;
                weightedSum += (spearman > 0.5) * weights.spearman;
                weightedSum += (dickeyFuller < -2.89) * weights.dickeyFuller;
                weightedSum += (rsi > 70) * weights.rsi;
                weightedSum += (rsi < 30) * -weights.rsi;

                // Суммируем все веса
                Object.values(weights).forEach(weight => weightTotal += weight);

                // Итоговая вероятность
                let probability = (weightedSum / weightTotal) * 100;

                resolve(probability.toFixed(2));
            };

            request.onerror = (event) => {
                reject(new Error(`Error fetching prices for ticker ${ticker}: ${event.target.errorCode}`));
            };
        });
    });
}


function analyzeAllTickers() {
    return openDatabase().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['quotes'], 'readonly');
            const store = transaction.objectStore('quotes');
            const tickerIndex = store.index('ticker');
            const request = tickerIndex.getAll();  // Изменено с getAllKeys() на getAll()

            request.onsuccess = (event) => {
                // Сначала извлекаем все записи, затем из каждой записи берем поле 'ticker'
                const tickers = [...new Set(event.target.result.map(item => item.ticker))];  // Уникальные тикеры

                const results = {};
                let analyzedCount = 0;

                if (tickers.length === 0) {
                    reject('No tickers found in the database.');
                    return;
                }

                tickers.forEach(ticker => {
                    calculateProbabilityOfGrowth(ticker).then(probability => {
                        results[ticker] = probability;
                        analyzedCount++;
                        if (analyzedCount === tickers.length) {
                            resolve(results); // Все тикеры проанализированы, возвращаем результаты
                        }
                    }).catch(error => {
                        console.error(`Error analyzing ticker ${ticker}: ${error}`);
                        results[ticker] = 'Analysis failed';
                        analyzedCount++;
                        if (analyzedCount === tickers.length) {
                            resolve(results);
                        }
                    });
                });
            };

            request.onerror = (event) => {
                console.error('Failed to fetch tickers:', event.target.error.message);
                reject(new Error(`Error fetching tickers: ${event.target.errorCode}`));
            };
        });
    });
}

function selectBestTradingOptions() {
    return analyzeAllTickers().then(results => {
        let maxProb = -1, minProb = 101;
        let bestToBuy = null, bestToSell = null;

        for (let ticker in results) {
            const prob = parseFloat(results[ticker]);
            if (!isNaN(prob)) {

                if (prob > maxProb) {
                    maxProb = prob;
                    bestToBuy = ticker;
                }
                if (prob < minProb) {
                    minProb = prob;
                    bestToSell = ticker;
                }
            }
        }

        return {
            bestToBuy: { ticker: bestToBuy, probability: maxProb.toFixed(2) },
            bestToSell: { ticker: bestToSell, probability: minProb.toFixed(2) }
        };
    }).catch(error => {
        console.error('Failed to analyze tickers for trading options:', error);
        throw error;
    });
}


// Функция для вызова calculateProbabilityOfGrowth из консоли:
function analyzeTicker(ticker) {
    calculateProbabilityOfGrowth(ticker)
        .then(probability => {
            console.log(`The probability of price growth for ${ticker} is: ${probability}%`);
        })
        .catch(error => {
            console.error(`Error analyzing ticker ${ticker}:`, error);
        });
}