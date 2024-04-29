
const closeAllAccounts = () => {
    $.ajax({
        url: '/close-all-sandbox-accounts',
        type: 'GET',
        success: (response) => {
            console.log('Учетные записи удалены', response);
            alert('Все учетные записи успешно удалены.');
        },
        error: (error) => {
            console.log('Ошибка при удалении учетных записей', error);
            alert('Произошла ошибка при удалении учетных записей.');
        }
    });
}

const openAccount = () => {
    $.ajax({
        url: '/open-sandbox-account',
        type: 'GET',
        success: (response) => {
            console.log('Аккаунт открыт', response);
            alert('Аккаунт открыт.');
        },
        error: (error) => {
            console.log('Ошибка при открытии аккаунта', error);
            alert('Произошла ошибка при открытии аккаунта в песочнице.');
        }
    });
}

const addMoney = () => {
    $.ajax({
        url: '/add-money',
        type: 'GET',
        success: (response) => {
            console.log('Баланс пополнен', response);
            refreshBalance();
        },
        error: (error) => {
            console.log('Ошибка при пополнении баланса', error);
            alert('Произошла ошибка при пополнении баланса.');
        }
    });
}

const getTariff = () => {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/info',
            type: 'GET',
            success: (response) => {
                const tariff = response.tariff;
                resolve(tariff);
            },
            error: (error) => {
                console.log('Ошибка при получении информации', error);
                reject('Произошла ошибка при получении информации.');
            }
        });
    });
}

const getAccounts = () => {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/accounts',
            type: 'GET',
            success: (response) => {
                console.log('Информация получена', response);
                const accounts = response.accounts;
                resolve(accounts);
            },
            error: (error) => {
                console.log('Ошибка при получении информации', error);
                reject('Произошла ошибка при получении информации.');
            }
        });
    });
}

const refreshBalance = () => {
    $.ajax({
        url: '/get-balance',
        type: 'GET',
        success: function (response) {
            $("#balance").text(response);
        },
        error: function (xhr, status, error) {
            console.error("Произошла ошибка при получении баланса: " + error);
        }
    });
}


const refreshSecurities = () => {
    getAllSecurities().then(securities => {
        securities.forEach(security => {
            const uid = security.instrument_uid;
            const balance = security.balance;
            $(`#securities-${uid}`).html(balance);
        });
    }).catch(error => {
        console.error('👺 Ошибка при загрузке бумаг:', error);
    })
}


const sendMarketData = (sl, tp) => {
    fetchLatestTickerData().then(data => {
        const analyticsData = collectAnalyticsData();

        const payload = {
            marketData: data,
            analyticsData: analyticsData,
        };

        $.ajax({
            url: `/market-data?sl=${sl}&tp=${tp}`,
            type: 'POST',
            data: JSON.stringify(payload),
            contentType: 'application/json',
            success: function (response) {
                for (const [ticker, forecast] of Object.entries(response.forecast_results)) {
                    const row = $(`#stock-${ticker}`);
                    const forecastCell = row.find('td:eq(3)');
                    const color = getForecastColor(forecast);
                    forecastCell.css('background-color', color);
                }
                displayPredicate(response.predicate);

            },
            error: function (xhr, status, error) {
                console.error("Ошибка при отправке данных на сервер: " + error);
            }
        });
    }).catch(error => {
        console.error("Ошибка при получении данных:", error);
    });
}

const loadSecurities = () => {
    $.ajax({
        url: '/get-securities',
        type: 'GET',
        success: (response) => {
            const securities = response.securities;
            securities.forEach(security => {
                $(`#securities-${security.instrument_uid}`).html(security.balance);
            })
        },
        error: (error) => {
            console.error('👺 Ошибка при загрузке бумаг:', error);
        }
    });

}

const startBot = () => {
    $.ajax({
        url: '/start',
        type: 'GET',
        success: (response) => {
            const statusIcon = $('#status');
            const start = $('#start');
            // ОСТАНОВКА БОТА
            if (start.html() === 'Stop Bot') {
                statusIcon.removeClass('green').addClass('red')
                start.html('Start Bot');
                start.css('background-color', 'dodgerblue')
                isBotStarted = false;
                stopSendingMarketData();
                console.log('Торговый бот остановлен');
                // ЗАПУСК БОТА
            } else {
                statusIcon.removeClass('red').addClass('green')
                start.html('Stop Bot');
                start.css('background-color', 'orangered')
                isBotStarted = true;
                sendMarketDataWithInterval();
                getAllSecurities().then(securities => {
                    securities.forEach(security => {
                        const uid = security.instrument_uid;
                        const balance = security.balance;
                        $(`#securities-${uid}`).html(balance);
                    });
                }).catch(error => {
                    console.error('👺 Ошибка при загрузке бумаг:', error);
                })
                $('#current-state').html('Running...')
                console.log('Торговый бот запущен');
            }
        },
        error: (error) => {
            console.log(error);
        }
    });
}

const loadDiagrams = () => {
    $.ajax({
        url: "/buy-sell-orders",
        type: "GET",
        success: function (orders) {
            const data = processOrders(orders);
            drawCharts(data);
        },
        error: function (error) {
            console.log("Error fetching orders:", error);
        }
    });

    function processOrders(orders) {
        const results = {
            buy: 0,
            sell: 0,
            tickers: {}
        };
        const prices = {};

        orders.forEach(order => {
            // Подсчет buy и sell
            if (order.order_type === "buy") {
                results.buy += 1;
                if (!prices[order.instrument.uid]) {
                    prices[order.instrument.uid] = {};
                }
                prices[order.instrument.uid].buy = order.price;
            } else if (order.order_type === "sell") {
                results.sell += 1;
                if (!prices[order.instrument.uid]) {
                    prices[order.instrument.uid] = {};
                }
                prices[order.instrument.uid].sell = order.price;
            }

            // Подсчет операций по тикерам
            const ticker = order.instrument.ticker; // доступ к тикеру через инструмент
            if (results.tickers[ticker]) {
                results.tickers[ticker] += 1;
            } else {
                results.tickers[ticker] = 1;
            }
        });

        return results;
    }

    function drawCharts(data) {
        const ctxBuySell = document.getElementById('buySellChart').getContext('2d');

        new Chart(ctxBuySell, {
            type: 'bar',
            data: {
                labels: ['Buy', 'Sell'],
                datasets: [{
                    label: 'Buy vs Sell Orders',
                    data: [data.buy, data.sell],
                    backgroundColor: ['rgba(54, 112, 235, 0.6)', 'rgba(255, 112, 132, 0.6)'],
                    borderColor: ['rgba(54, 112, 235, 1)', 'rgba(255, 112, 132, 1)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
        // диаграмма: по тикерам
        const ctxTicker = document.getElementById('tickerChart').getContext('2d');
        const tickerLabels = Object.keys(data.tickers);
        const tickerData = Object.values(data.tickers);

        new Chart(ctxTicker, {
            type: 'bar',
            data: {
                labels: tickerLabels,
                datasets: [{
                    label: 'Operations by Ticker',
                    data: tickerData,
                    backgroundColor: tickerLabels.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`),
                    borderColor: tickerLabels.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }
}