const createNewTableRow = (instrument, closePrice, ticker) => {
    $('#stock-widget tbody').append(
        `<tr id="stock-${instrument.ticker}" class="stock" data-price="${closePrice}">
            <td><img width='15px' height='15px' style='border-radius: 50%; margin-right: 5px;' src="/static/img/${instrument.ticker}.png" alt="${instrument.name}" title="${instrument.name}" /></td>
            <td>${instrument.name}</td>
            <td id="securities-${instrument.uid}"></td>
            <td></td>
            <td>${ticker}</td>
            <td><b>&nbsp;&nbsp;${parseFloat(closePrice.toFixed(8)).toString()}</b></td>
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
}


const getIconAndColor = (stockRow, closePrice) => {
    let icon = '&nbsp;&nbsp;';
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
    return { icon: icon, color: color };
}

const updateExistingRow = (instrument, stockRow, closePrice) => {
    const { icon, color } = getIconAndColor(stockRow, closePrice);
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
                }
            )
        }
    ).catch(error => {
        console.error('Ошибка при выполнении selectBestTradingOptions:', error);
    });

    stockRow.find('td:eq(5)').html(`<b>${icon} ${parseFloat(closePrice.toFixed(8)).toString()}</b>`).attr('class', `stock ${color}`).data('price', closePrice);
    setTimeout(() => {
        stockRow.find('td:eq(5)').attr('class', 'stock');
        let currentHtml = stockRow.find('td:eq(5) b').html();
        // Заменяем '+' и '-' на пустую строку, если они есть
        let updatedHtml = currentHtml.replace(/\+|\-/g, '');
        // Обновляем содержимое элемента <b> в ячейке
        stockRow.find('td:eq(5) b').html(updatedHtml);
    }, 500);
}

const updateOrAppendStockElement = (instrument, ticker, closePrice) => {
    let stockRow = $(`#stock-${instrument.ticker}`);
    if (stockRow.length === 0) {
        // Добавляем новую строку в таблицу если ее нет
        createNewTableRow(instrument, closePrice, ticker);
    } else {
        // Иначе обновляем существующую строку
        updateExistingRow(instrument, stockRow, closePrice);
    }
    addQuote(instrument.ticker, closePrice);
};

const collectAnalyticsData = () => {
    let analyticsData = {};

    $("tr.stock").each(function () {
        const ticker = this.id.split('-')[1]; // ID имеет формат "stock-TICKER"
        const percentageString = $(this).find("td:eq(3)").text().trim(); // из четвертой колонки
        const percentage = parseFloat(percentageString.replace('%', ''));
        analyticsData[ticker] = percentage;
    });

    return analyticsData;
}