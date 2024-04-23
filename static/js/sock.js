$(document).ready(function () {
    const pingStrategy = (analyze, bestToBuy, bestToSell, closePrice, previousPrice) => {
        const sl = $('#sl').val();
        const tp = $('#tp').val();
        $.ajax({
            url: `/strategy?sl=${sl}&tp=${tp}&analyze=${JSON.stringify(analyze)}&best_to_buy=${JSON.stringify(bestToBuy)}&best_to_sell=${JSON.stringify(bestToSell)}&close_price=${closePrice}&previous_price=${previousPrice}`,
            type: 'GET',
            success: (response) => {
                if (response.message) {
                    $('#current-state').html(response.message).css('color', 'dodgerblue');
                } else {
                    $('#current-state').html(
                        `📉Получен сигнал к покупке: ${response.to_buy}<br />📈 Получен сигнал к продаже: ${response.to_sell}`
                    ).css('color', 'darkseagreen');

                    // todo: делаем запрос на покупку/продажу, предварительно проверив активы (можно с клиента)
                    // 1. BUY
                    const instrumentForBuy = instruments.find(inst => inst.ticker === response.to_buy);
                    const uidForBuy = instrumentForBuy.uid;
                    const balance = parseFloat($('#balance').html());
                    const price = parseFloat($(`#stock-${instrumentForBuy.ticker} td:nth-child(6) b`).text().trim().replace('-', '').replace('+', '').trim());
                    console.log(balance, price)
                    const amount = parseInt(balance / price);
                    console.log(amount)
                    amount > 0 && $.ajax({
                        url: `/create-buy-order?instrument_id=${uidForBuy}&amount=${amount}`,
                        type: 'GET',
                        success: (response) => {
                            console.log('Создан ордер на покупку!', response);
                            $.ajax({
                                url: `/start`,
                                type: 'GET',
                                success: (response) => {
                                    console.log('Сигналы сервера включены', response);
                                    // update balance and securities
                                    $.ajax({
                                        url: '/get-balance',
                                        type: 'GET',
                                        success: function (response) {
                                            console.log(response)
                                            $('#balance').text(response);
                                        },
                                    });
                                    getAllSecurities().then(securities => {
                                        securities.forEach(security => {
                                            const uid = security.instrument_uid;
                                            const balance = security.balance;
                                            $(`#securities-${uid}`).html(balance);
                                        });
                                    }).catch(error => {
                                        console.error('👺 Ошибка при загрузке бумаг:', error);
                                    });
                                }
                            });
                        },
                        error: (error) => {
                            console.log('Не получилось создать ордер на покупку!', response)
                        }
                    });

                    // SELL
                    const instrumentForSell = instruments.find(inst => inst.ticker === response.to_sell);
                    const uidForSell = instrumentForSell.uid;
                    const securitiesCount = parseInt($(`#securities-${uidForSell}`).html());
                    securitiesCount > 0 && $.ajax({
                        url: `/create-sell-order?instrument_id=${uidForBuy}&amount=${securitiesCount}`,
                        type: 'GET',
                        success: (response) => {
                            console.log('Создан ордер на продажу!', response)
                            $.ajax({
                                url: `/start`,
                                type: 'GET',
                                success: (response) => {
                                    console.log('Сигналы сервера включены', response);
                                    // update balance and securities
                                    $.ajax({
                                        url: '/get-balance',
                                        type: 'GET',
                                        success: function (response) {
                                            console.log(response)
                                            $('#balance').text(response);
                                        },
                                    });
                                    getAllSecurities().then(securities => {
                                        securities.forEach(security => {
                                            const uid = security.instrument_uid;
                                            const balance = security.balance;
                                            $(`#securities-${uid}`).html(balance);
                                        });
                                    }).catch(error => {
                                        console.error('👺 Ошибка при загрузке бумаг:', error);
                                    });
                                }
                            });
                        },
                        error: (error) => {
                            console.log('Не получилось создать ордер на продажу!', response)
                        }
                    });
                }
                console.log('Информация от стратегии получена', response);
            },
            error: (error) => {
                console.log('Ошибка связи со стратегией', error);
            }
        });
    };

    const subscribeToCandles = () => {
        const instrList = figiList.map(figi => ({
            figi,
            "interval": "SUBSCRIPTION_INTERVAL_ONE_MINUTE"
        }));

        const message = {
            "subscribeCandlesRequest": {
                "subscriptionAction": "SUBSCRIPTION_ACTION_SUBSCRIBE",
                instruments: instrList,
                "waitingClose": false
            }
        };

        ws.send(JSON.stringify(message));
    };

    const handlePingMessage = event => {
        const data = JSON.parse(event.data);
        if (!data.ping) return;
        console.log('Tinkoff WS: received ping message');
    };

    const handleNewMessage = event => {
        handlePingMessage(event);
        const data = JSON.parse(event.data);
        if (!data.candle || !data.candle.close) return;

        const closePrice = parseFloat(data.candle.close.units) + data.candle.close.nano / 1e9;
        const figi = data.candle.figi;
        const instrument = instruments.find(inst => inst.figi === figi);
        const ticker = instrument ? instrument.ticker : 'Тикер не найден';

        updateOrAppendStockElement(instrument, ticker, closePrice);

        // update charts
        if (data.candle) {
            const closePrice = parseFloat(data.candle.close.units) + data.candle.close.nano / 1e9;
            const figi = data.candle.figi;
            const instrument = instruments.find(inst => inst.figi === figi);
            if (instrument) {
                const ticker = instrument.ticker;
                try {
                    updateChart(ticker, closePrice, data.candle.time);
                } catch (e) {
                    console.error('Ошибка при обновлении графика:', e);
                }
            }
        }
    };

    const updateOrAppendStockElement = (instrument, ticker, closePrice) => {
        let icon = '&nbsp;&nbsp;';
        let stockRow = $(`#stock-${instrument.ticker}`);
        if (stockRow.length === 0) {
            // Создаем новую строку, если не нашли
            $('#stock-widget tbody').append(
                `<tr id="stock-${instrument.ticker}" class="stock" data-price="${closePrice}">
                    <td><img width='15px' height='15px' style='border-radius: 50%; margin-right: 5px;' src="/static/img/${instrument.ticker}.png" alt="${instrument.name}" title="${instrument.name}" /></td>
                    <td>${instrument.name}</td>
                    <td id="securities-${instrument.uid}"></td>
                    <td></td>
                    <td>${ticker}</td>
                    <td><b>${icon} ${parseFloat(closePrice.toFixed(8)).toString()}</b></td>
                </tr>`
            );
            getAllSecurities().then(securities => {
                securities.forEach(security => {
                    const uid = security.instrument_uid;
                    const balance = security.balance;
                    $(`#securities-${uid}`).html(balance);
                });
            }).catch(error => {
                console.error('👺 Ошибка при загрузке бумаг:', error);
            });
        } else {
            // Иначе обновляем существующую строку
            const previousPrice = parseFloat(stockRow.data('price'));
            let color = 'black';
            const priceDifference = closePrice - previousPrice;
            if (priceDifference > 0) {
                color = 'green';
                icon = '+';
            } else if (priceDifference < 0) {
                color = 'red';
                icon = '-';
            }
            selectBestTradingOptions().then(
                best => {
                    const { bestToBuy, bestToSell } = best;

                    const tickerToBuy = bestToBuy.ticker;
                    const tickerToSell = bestToSell.ticker;

                    $('#stock-widget tbody tr').find('td:eq(1)').css('color', 'white');

                    $(`#stock-${tickerToBuy}`).find('td:eq(1)').css('color', 'darkseagreen');

                    $(`#stock-${tickerToSell}`).find('td:eq(1)').css('color', 'rgb(255, 107, 53)');

                    // analytics
                    analyzeAllTickers().then(
                        analyze => {
                            stockRow.find('td:eq(3)').html(
                                `${analyze[instrument.ticker]} %`
                            );
                            isBotStarted && pingStrategy(analyze, bestToBuy, bestToSell, closePrice, previousPrice);
                        }
                    )
                }
            ).catch(error => {
                console.error('Ошибка при выполнении selectBestTradingOptions:', error);
            });

            stockRow.find('td:eq(5)').html(`<b>${icon} ${parseFloat(closePrice.toFixed(8)).toString()}</b>`).attr('class', `stock ${color}`).data('price', closePrice);
        }
        addQuote(instrument.ticker, closePrice);
    };

    ws.onopen = () => {
        console.log('WebSocket connection established');
        subscribeToCandles();
    };

    ws.onmessage = handleNewMessage;

    ws.onerror = error => {
        console.error('WebSocket error:', error.message);
    };
});
