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
            $("#balance").text(parseFloat(response).toFixed(2));
        },
        error: function (xhr, status, error) {
            console.error("Произошла ошибка при получении баланса: " + error);
        }
    });
}


const loadSecurities = () => {
    $.ajax({
        url: '/get-securities',
        type: 'GET',
        success: (response) => {
            const securities = response.securities;
            let total = 0;
            securities.forEach(security => {
                $(`#securities-${security.instrument_uid}`).html(security.balance);
                const uid = security.instrument_uid;
                const balance = security.balance;
                $(`#securities-${uid}`).html(balance);
                total += parseFloat(security.balance * security.price);
            })
            $(`#sec-balance`).html(total.toFixed(2));
            $(`#total-balance`).html((total + parseFloat($('#balance').text())).toFixed(2));
        },
        error: (error) => {
            console.error('👺 Ошибка при загрузке бумаг:', error);
        }
    });
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
                    forecastCell.css('color', 'rgb(38, 51, 55)');
                }
                displayPredicate(response.predicate);
                loadOrders();
            },
            error: function (xhr, status, error) {
                console.error("Ошибка при отправке данных на сервер: " + error);
            }
        });
    }).catch(error => {
        console.error("Ошибка при получении данных:", error);
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


const loadOrders = () => {
    $.ajax({
        url: "/buy-sell-orders",
        type: "GET",
        success: function (orders) {
            const averagePrices = calculateAveragePrices(orders);

            $('#orders-table tbody').empty();

            orders.forEach(order => {
                const quantity = order.lots * order.instrument?.lot;
                let profit = 0;
                if (order.order_type === 'sell') {
                    let avgPrice = averagePrices[order.instrument_uid] || 0;
                    profit = (order.price - avgPrice) * quantity;
                    profit = profit.toFixed(2); // Форматирование значения до двух десятичных знаков
                }
                const color = profit > 0 ? 'goldenrod' : 'orangered';
                $('#orders-table tbody').append(`
                    <tr style="color: ${order.order_type === 'buy' ? 'seagreen' : color}">
                        <td>${order.instrument.figi}</td>
                        <td>${order.instrument.ticker}</td>
                        <td>${order.price}</td>
                        <td>${order.order_type}</td>
                        <td>${quantity}</td>
                        <td><b>${order.order_type === 'buy' ? `-${parseFloat(order.price * quantity).toFixed(2)}` : profit}</b> <code>RUB</code></td>
                    </tr>
                `);
            });
        },
        error: function (error) {
            console.log("Error fetching orders:", error);
        }
    });
}