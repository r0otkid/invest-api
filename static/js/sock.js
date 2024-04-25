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
        console.log('Tinkoff WS: received ping message');
    };

    const handleNewMessage = event => {
        handlePingMessage(event);
        const data = JSON.parse(event.data);
        if (!data.candle || !data.candle.close) return;

        const closePrice = parseFloat(data.candle.close.units) + data.candle.close.nano / 1e9;
        const instrument = instruments.find(inst => inst.figi === data.candle.figi);
        const ticker = instrument ? instrument.ticker : 'Тикер не найден';

        updateOrAppendStockElement(instrument, ticker, closePrice);
        updateCharts(data);
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
