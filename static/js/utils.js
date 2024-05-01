const createNewTableRow = (instrument, closePrice, ticker) => {
    $('#stock-widget tbody').append(
        `<tr id="stock-${instrument.ticker}" class="stock" data-price="${closePrice}">
            <td><img width='15px' height='15px' style='border-radius: 50%; margin-right: 5px;' src="/static/img/${instrument.ticker}.png" alt="${instrument.name}" title="${instrument.name}" /></td>
            <td>${instrument.name}</td>
            <td id="securities-${instrument.uid}"></td>
            <td></td>
            <td>${ticker}</td>
            <td style="text-align: center;"><b>&nbsp;&nbsp;${parseFloat(closePrice.toFixed(8)).toString()}</b></td>
        </tr>`
    );
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

const updateExistingRow = (instrument, stockRow, closePrice) => {
    const { icon, color } = getIconAndColor(stockRow, closePrice);
    selectBestTradingOptions().then(
        best => {
            const { bestToBuy, bestToSell } = best;

            const tickerToBuy = bestToBuy.ticker;
            const tickerToSell = bestToSell.ticker;

            $('#stock-widget tbody tr').find('td:eq(1)').css('color', '#abb2bf');

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

    const lastColumn = stockRow.find('td:eq(5)');
    color !== 'black' && lastColumn.css('color', 'rgb(38, 51, 55)');
    lastColumn.html(`<b>${icon} ${parseFloat(closePrice.toFixed(8)).toString()}</b>`).attr('class', `stock ${color}`).data('price', closePrice);
    setTimeout(() => {
        lastColumn.attr('class', 'stock');
        let currentHtml = stockRow.find('td:eq(5) b').html();
        // Заменяем '+' и '-' на пустую строку, если они есть
        let updatedHtml = currentHtml.replace(/\+|\-/g, '');
        // Обновляем содержимое элемента <b> в ячейке
        stockRow.find('td:eq(5) b').html(updatedHtml);
        lastColumn.css('color', '#abb2bf');
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
    deleteOldQuotes();
    addQuote(instrument.ticker, closePrice);

};

const collectAnalyticsData = () => {
    let analyticsData = {};

    $("tr.stock").each(function () {
        const ticker = this.id.split('-')[1]; // ID имеет формат "stock-TICKER"
        const percentageString = $(this).find("td:eq(3)").text().trim(); // из четвертой колонки
        const percentage = parseFloat(percentageString.replace('%', ''));
        analyticsData[ticker] = percentage || 50;  // 50% если данные не найдены
    });

    return analyticsData;
}

const getForecastColor = (value) => {
    // Плавный переход от мягкого красного к мягкому зелёному
    const hue = value * 120; // 0 (красный) - 120 (зелёный) в HSL
    const saturation = 30; // Более низкая насыщенность для мягкости цвета
    const lightness = 50 + (10 * value); // Плавно увеличиваем яркость для большей мягкости

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const displayPredicate = (predicates) => {
    const $currentState = $('#current-state');
    $currentState.css('justify-content', 'center').css('align-items', 'center');
    const actionablePredicates = predicates.filter(p => !p.includes('No clear action'));

    // Если нет действенных предложений, показываем одно сообщение "No clear action"
    if (actionablePredicates.length === 0 && predicates.length > 0) {
        $currentState.html('No clear action').delay(500).fadeOut(500, () => {
            $currentState.show().css('opacity', '');
        });
    } else if (actionablePredicates.length > 0) {
        // Отображаем только те предложения, которые требуют действий
        const formattedPredicates = actionablePredicates.map(p => {
            const color = p.includes('📉') ? 'red-font' : 'green-font';
            return `<div class="${color}">${p}</div>`
        }).join('');
        $currentState.html(formattedPredicates).delay(500).fadeOut(500, () => {
            $currentState.show().css('opacity', '');
        });
    } else {
        // Если предложений нет, показываем пустое состояние или сообщение по умолчанию
        $currentState.html('No data available').delay(500).fadeOut(500, () => {
            $currentState.show().css('opacity', '');
        });
    }
}