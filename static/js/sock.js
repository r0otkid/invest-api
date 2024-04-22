$(document).ready(function () {
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
        console.log('Tinkoff WebSocket: received ping message');
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
        updateStockPriceAndPercentDifference(ticker, closePrice);

        // update charts
        if (data.candle) {
            const closePrice = parseFloat(data.candle.close.units) + data.candle.close.nano / 1e9;
            const figi = data.candle.figi;
            const instrument = instruments.find(inst => inst.figi === figi);
            if (instrument) {
                const ticker = instrument.ticker;
                updateChart(ticker, closePrice, data.candle.time);
            }
        }
    };

    const updateStockPriceAndPercentDifference = (ticker, closePrice) => {
        let purchaseRow = $(`#purchase-${ticker}`);
        if (purchaseRow.length === 0) {
            console.log("Purchase info row not found for ticker: " + ticker);
            return;
        }

        // Получаем информацию о покупке
        const purchasePrice = parseFloat(purchaseRow.find('td:nth-child(2)').text());
        const quantity = parseInt(purchaseRow.find('td:nth-child(3)').text(), 10);
        const spent = purchasePrice * quantity;
        const current = closePrice * quantity;
        const difference = current - spent;
        const percentDifference = ((closePrice - purchasePrice) / purchasePrice) * 100; // Рассчитываем процентное изменение

        // Обновляем разницу и процентное изменение
        let profitColor = difference >= 0 ? 'darkseagreen' : 'orangered';
        let percentColor = percentDifference >= 0 ? 'darkseagreen' : 'orangered';

        purchaseRow.find('td:nth-child(4)').html(`<b style="color:${percentColor};">${percentDifference.toFixed(2)}%</b>`);
        purchaseRow.find('td:nth-child(5)').html(`<b style="color:${profitColor};">${difference.toFixed(2)} RUB</b>`);
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
                    <td></td>
                    <td>${ticker}</td>
                    <td><b>${icon} ${parseFloat(closePrice.toFixed(8)).toString()}</b></td>
                </tr>`
            );
            // sendMessage("Привет, мир!");
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
            // analytics
            analyzeAllTickers().then(
                analyze => {
                    stockRow.find('td:eq(2)').html(
                        `${analyze[instrument.ticker]} %`
                    );
                }
            )
            selectBestTradingOptions().then(
                best => {
                    const { bestToBuy, bestToSell } = best;

                    const tickerToBuy = bestToBuy.ticker;
                    const tickerToSell = bestToSell.ticker;

                    $('#stock-widget tbody tr').find('td:eq(1)').css('color', 'white');

                    $(`#stock-${tickerToBuy}`).find('td:eq(1)').css('color', 'green');

                    $(`#stock-${tickerToSell}`).find('td:eq(1)').css('color', 'red');
                }
            ).catch(error => {
                console.error('Ошибка при выполнении selectBestTradingOptions:', error);
            });

            stockRow.find('td:eq(4)').html(`<b>${icon} ${parseFloat(closePrice.toFixed(8)).toString()}</b>`).attr('class', `stock ${color}`).data('price', closePrice);
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
