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

function calculateRSI(prices, period = 14) {
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

function calculateStochasticOscillator(prices, period = 14) {
    // Стохастический осциллятор - это индикатор моментума,
    // который сравнивает текущую цену закрытия с диапазоном цен за определенный период.
    const closingPrices = prices.slice(-period);
    const high = Math.max(...closingPrices);
    const low = Math.min(...closingPrices);
    const currentClose = prices[prices.length - 1];
    const stochastic = ((currentClose - low) / (high - low)) * 100;

    return stochastic;
}

function calculateMACD(prices, slowPeriod = 26, fastPeriod = 12, signalPeriod = 9) {
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

function calculateBollingerBands(prices, period = 20, multiplier = 2) {
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

                const sma = calculateSMA(prices, 5);
                const ema = calculateEMA(prices, 5);
                const wma = calculateWMA(prices, 5);
                const macd = calculateMACD(prices);
                const bollinger = calculateBollingerBands(prices);
                const parabolicSAR = calculateParabolicSAR(prices);

                const smaLast = sma[sma.length - 1];
                const emaLast = ema[ema.length - 1];
                const wmaLast = wma[wma.length - 1];
                const macdHistogramLast = macd.histogram[macd.histogram.length - 1];
                const priceLast = prices[prices.length - 1];
                const psarLast = parabolicSAR[parabolicSAR.length - 1];

                // Веса для каждого индикатора
                const weights = {
                    ema: 0.25,
                    macd: 0.20,
                    wma: 0.15,
                    sma: 0.10,
                    rsi: 0.10,
                    bollinger: 0.10,
                    stochastic: 0.10
                };

                // Расчет сигналов
                let weightedSum = 0;
                let weightTotal = 0;
                weightedSum += (emaLast > smaLast) * weights.ema;
                weightedSum += (emaLast > wmaLast) * weights.ema;
                weightedSum += (wmaLast > smaLast) * weights.wma;
                weightedSum += (macdHistogramLast > 0) * weights.macd;
                weightedSum += (priceLast > bollinger.upper[bollinger.upper.length - 1]) * weights.bollinger;
                weightedSum += (priceLast > psarLast) * weights.stochastic; // Using stochastic weight for PSAR for example

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