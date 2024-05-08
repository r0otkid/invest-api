
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

function calculateAveragePrices(orders) {
    let buyOrders = orders.filter(order => order.order_type === "buy");
    let averagePrices = {};

    buyOrders.forEach(order => {
        let instrument_uid = order.instrument_uid;
        if (!averagePrices[instrument_uid]) {
            averagePrices[instrument_uid] = { sum: 0, count: 0 };
        }
        averagePrices[instrument_uid].sum += order.price;
        averagePrices[instrument_uid].count++;
    });

    for (let instrument_uid in averagePrices) {
        averagePrices[instrument_uid] = averagePrices[instrument_uid].sum / averagePrices[instrument_uid].count;
    }

    return averagePrices;
}
const calculateDeviation = (ticker) => {
    const orders = $(`#orders-table tbody tr`).filter(
        (index, row) => $(row).find('td:eq(1)').text().trim() === ticker.trim() && $(row).find('td:eq(3)').text() === 'buy'
    );
    if (orders.length === 0) {
        return;
    }
    let totalQuantity = 0;
    let totalAmount = 0;
    orders.each((index, row) => {
        totalQuantity += parseFloat($(row).find('td:eq(4)').text());
        totalAmount += parseFloat($(row).find('td:eq(5)').text().replace(/[^\d.]/g, ''));
    });
    if (totalQuantity === 0) {
        return;
    }
    const averagePrice = totalAmount / totalQuantity;
    const currentPrice = parseFloat($(`#stock-${ticker} td:eq(5)`).text().replace(/[^\d.]/g, '').trim());
    if (isNaN(currentPrice)) {
        return;
    }
    const deviation = Math.abs(currentPrice) - Math.abs(averagePrice);
    return deviation.toFixed(1)
};

const createNewTableRow = (instrument, closePrice, ticker) => {
    $('#stock-widget tbody').append(
        `<tr id="stock-${instrument.ticker}" class="stock" data-price="${closePrice}">
            <td><img width='15px' height='15px' style='border-radius: 50%; margin-right: 5px;' src="/static/img/${instrument.ticker}.png" alt="${instrument.name}" title="${instrument.name}" /></td>
            <td>${instrument.name}</td>
            <td id="securities-${instrument.uid}"></td>
            <td></td>
            <td>${ticker}</td>
            <td style="text-align: center;"><b>&nbsp;&nbsp;${parseFloat(closePrice.toFixed(8)).toString()}</b></td>
            <td>0</td>
        </tr>`
    );
}

const updateExistingRow = (stockRow, closePrice) => {
    const { icon, color } = getIconAndColor(stockRow, closePrice);
    const preLastColumn = stockRow.find('td:eq(5)');
    color !== 'black' && preLastColumn.css('color', 'rgb(38, 51, 55)');
    preLastColumn.html(`<b>${icon} ${parseFloat(closePrice.toFixed(8)).toString()}</b>`).attr('class', `stock ${color}`).data('price', closePrice);
    setTimeout(() => {
        preLastColumn.attr('class', 'stock');
        let currentHtml = stockRow.find('td:eq(5) b').html();
        let updatedHtml = currentHtml.replace(/\+|\-/g, '');
        stockRow.find('td:eq(5) b').html(updatedHtml);
        preLastColumn.css('color', '#abb2bf');
    }, 500);
}

const updateOrAppendStockElement = (instrument, ticker, closePrice) => {
    let stockRow = $(`#stock-${instrument.ticker}`);
    if (stockRow.length === 0) {
        createNewTableRow(instrument, closePrice, ticker);
    } else {
        updateExistingRow(stockRow, closePrice);
    }
    addQuote(instrument.ticker, closePrice);
    const lastColumn = stockRow.find('td:eq(6)');
    if (stockRow.find('td:eq(2)').text().trim()) {
        const dev = calculateDeviation(instrument.ticker);
        lastColumn.html(dev);
    } else {
        lastColumn.html(0);
    }
};

const collectAnalyticsData = () => {
    let analyticsData = {};

    $("tr.stock").each(function () {
        const ticker = this.id.split('-')[1];
        const percentageString = $(this).find("td:eq(3)").text().trim(); // из четвертой колонки
        const percentage = parseFloat(percentageString.replace('%', ''));
        analyticsData[ticker] = percentage || 50;  // 50% если данные не найдены
    });

    return analyticsData;
}

const getForecastColor = (value) => {
    const hue = value * 120; // 0 (красный) - 120 (зелёный) в HSL
    const saturation = 30;
    const lightness = 50 + (10 * value);

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const displayPredicate = (predicates) => {
    const $currentState = $('#current-state');
    const actionablePredicates = predicates.filter(p => !p.includes('No clear action'));

    if (actionablePredicates.length === 0 && predicates.length > 0) {
        $currentState.html('No clear action').delay(500).fadeOut(500, () => {
            $currentState.show().css('opacity', '');
        });
    } else if (actionablePredicates.length > 0) {
        const formattedPredicates = actionablePredicates.map(p => {
            const color = p.includes('📉') ? 'red-font' : 'green-font';
            return `<div class="${color}">${p}</div>`
        }).join('');
        $currentState.html(formattedPredicates).delay(500).fadeOut(500, () => {
            $currentState.show().css('opacity', '');
        });
    } else {
        $currentState.html('No data available').delay(500).fadeOut(500, () => {
            $currentState.show().css('opacity', '');
        });
    }
}

const displayGlobalProfit = () => {
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    const initialAmount = 10000;

    $('#orders-table tbody tr').each(function () {
        const operation = $(this).find('td:nth-child(4)').text().trim();
        const amount = parseFloat($(this).find('td:nth-child(6)').text().trim().replace(/[^0-9.-]+/g, ""));
        if (operation === 'buy') {
            totalBuyAmount += amount;
        } else if (operation === 'sell') {
            totalSellAmount += amount;
        }
    });

    const profitValue = parseFloat(parseFloat($('#total-balance').text()) - initialAmount);
    const profit = profitValue.toFixed(2);
    const profitPercent = parseFloat(profitValue * 100 / initialAmount).toFixed(3);

    $('#global-profit').html(profit + " RUB");
    $('#global-profit-percent').html(profitPercent + ' %');
}