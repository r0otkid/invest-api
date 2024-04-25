function filterDataByInterval(tickerData, intervalMinutes = 5) {
    if (!Array.isArray(tickerData)) {
        console.error('Data for filtering is not an array:', tickerData);
        return [];
    }
    const intervalMilliseconds = intervalMinutes * 60 * 1000; // Конвертируем минуты в миллисекунды
    // Убедимся, что данные отсортированы
    const sortedData = tickerData.sort((a, b) => a.timestamp - b.timestamp);
    let lastTimestamp = sortedData[0]?.timestamp || 0; // Начальная метка времени или 0
    let filteredData = [];

    for (let i = 0; i < sortedData.length; i++) {
        if (sortedData[i].timestamp >= lastTimestamp + intervalMilliseconds) {
            filteredData.push(sortedData[i]);
            lastTimestamp = sortedData[i].timestamp;
        }
    }

    return filteredData;
}

function createTabs(dataByTicker) {
    const tabsContainer = document.querySelector('.tabs');
    const buttonsContainer = tabsContainer.querySelector('.tab-buttons');
    const contentContainer = tabsContainer.querySelector('.tab-content');

    Object.keys(dataByTicker).forEach((ticker, index) => {
        // Создание кнопки для таба
        const button = document.createElement('button');
        button.textContent = ticker;
        button.addEventListener('click', () => setActiveTab(index));
        buttonsContainer.appendChild(button);

        // Создание панели для графика
        const panel = document.createElement('div');
        panel.className = 'content-panel';
        contentContainer.appendChild(panel);

        const canvas = document.createElement('canvas');
        panel.appendChild(canvas);
        // Здесь ваш код для инициализации графика...

        if (index === 0) {
            button.classList.add('active');
            panel.classList.add('active');
        }
    });

    function setActiveTab(activeIndex) {
        // Снимаем выделение со всех кнопок и скрываем все панели
        document.querySelectorAll('.tab-buttons button').forEach((button, index) => {
            if (index === activeIndex) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Показываем активную панель
        document.querySelectorAll('.tab-content .content-panel').forEach((panel, index) => {
            if (index === activeIndex) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }
}


function updateChart(ticker, price, timestamp) {
    const chartInstance = chartInstances[ticker];
    if (!chartInstance) {
        console.error(`Chart instance not found for ticker: ${ticker}`);
        return;
    }

    // Преобразование временной метки в читаемый формат
    const label = new Date(timestamp).toLocaleTimeString();

    // Добавление новых данных
    chartInstance.data.labels.push(label);
    chartInstance.data.datasets.forEach((dataset) => {
        dataset.data.push(price);
    });

    // Удаление старых данных, чтобы на графике было не более 50 точек
    while (chartInstance.data.labels.length > 50) {
        chartInstance.data.labels.shift();
        chartInstance.data.datasets.forEach((dataset) => {
            dataset.data.shift();
        });
    }

    // Обновление графика
    chartInstance.update({
        preservation: true
    });
}

const updateCharts = (data) => {
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

const plugin = {
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart, args, options) => {
        const { ctx } = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = options.color || '#99ffff';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
};

function createCharts(dataByTicker) {
    // Получение элементов для вкладок и содержимого
    const tabLinks = document.querySelector('.tab-links');
    const tabContent = document.querySelector('.tab-content');

    Object.keys(dataByTicker).forEach((ticker, index) => {
        // Важно: Убедимся, что мы передаем массив для конкретного тикера
        const tickerData = dataByTicker[ticker];
        const filteredData = filterDataByInterval(tickerData);
        const prices = filteredData.map(entry => entry.price);
        const timestamps = filteredData.map(entry => new Date(entry.timestamp).toLocaleTimeString());

        // Создание новой вкладки
        const tabButton = document.createElement('li');
        tabButton.textContent = ticker;
        tabButton.dataset.target = `chart-${ticker}`;
        tabButton.className = 'tab-link';
        tabButton.onclick = changeTab; // Функция смены вкладок
        tabLinks.appendChild(tabButton);

        // Создание контейнера для графика
        const chartContainer = document.createElement('div');
        chartContainer.id = `chart-${ticker}`;
        chartContainer.className = 'tab-pane';
        tabContent.appendChild(chartContainer);

        // Настройка контейнера canvas для Chart.js
        const canvas = document.createElement('canvas');
        chartContainer.appendChild(canvas);

        const chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{
                    label: `Price History for ${ticker}`,
                    data: prices,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    backgroundColor: [
                        'rgb(255, 99, 132)',
                        'rgb(54, 162, 235)',
                        'rgb(255, 205, 86)'
                    ],
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: false
                    }
                },
                plugins: {
                    customCanvasBackgroundColor: {
                        color: '#2b2b2b',
                    }
                }
            },
            plugins: [plugin],

        });
        chartInstances[ticker] = chartInstance;

        // Делаем первую вкладку активной
        if (index === 0) {
            tabButton.classList.add('active');
            chartContainer.classList.add('active');
        }
    });
}

function changeTab(event) {
    const targetId = event.target.dataset.target;

    // Удаляем активное состояние со всех вкладок и панелей
    document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

    // Добавляем активное состояние на выбранную вкладку и панель
    event.target.classList.add('active');
    document.getElementById(targetId).classList.add('active');
}