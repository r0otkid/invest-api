
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
                // displayStrategyResponse(response.strategy_response);
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
    // Установка и удаление интервала отправки данных на сервер
    const sendMarketDataWithInterval = () => {
        if (marketDataIntervalId) clearInterval(marketDataIntervalId);
        marketDataIntervalId = setInterval(() => {
            sendMarketData($('#sl').val(), $('#tp').val());
        }, 5000);
    }

    const stopSendingMarketData = () => {
        if (marketDataIntervalId) {
            clearInterval(marketDataIntervalId);
            marketDataIntervalId = null;
            console.log("Отправка данных на сервер остановлена.");
        }
    }

    $.ajax({
        url: '/start',
        type: 'GET',
        success: (response) => {
            const statusIcon = $('#status');
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
                    $('#current-state').html('Running...')
                    console.log('Торговый бот запущен');
                }).catch(error => {
                    console.error('👺 Ошибка при загрузке бумаг:', error);
                });
            }
        },
        error: (error) => {
            console.log(error);
        }
    });
}