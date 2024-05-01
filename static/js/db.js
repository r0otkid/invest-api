let db;
const dbName = "QuotesDB";
const index = 4;


function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, index);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("quotes")) {
                const store = db.createObjectStore("quotes", { keyPath: "id", autoIncrement: true });
                // Проверяем, существует ли уже индекс 'timestamp'
                if (!store.indexNames.contains("timestamp")) {
                    // Создаем новый индекс 'timestamp'
                    store.createIndex("timestamp", "timestamp", { unique: false });
                }
                store.createIndex("ticker", "ticker", { unique: false }); // Создание индекса 'ticker'
            } else {
                // Если хранилище уже существует, но нужно добавить новый индекс:
                const store = transaction.objectStore("quotes");
                if (!store.indexNames.contains("ticker")) {
                    store.createIndex("ticker", "ticker", { unique: false });
                    store.createIndex("timestamp", "timestamp", { unique: false })
                }
            }
        };

        request.onsuccess = function (event) {
            resolve(event.target.result);
        };

        request.onerror = function (event) {
            console.error("Database error: ", event.target.error ? event.target.error : event);
            reject(event.target.error ? event.target.error.message : "Unknown error occurred.");
        };
    });
}

function countQuotes() {
    openDatabase().then(db => {
        const transaction = db.transaction(["quotes"], "readonly");
        const store = transaction.objectStore("quotes");
        const countRequest = store.count();

        countRequest.onsuccess = function () {
            $('#total-quotes').text(countRequest.result + " quoutes in DB");
        };

        countRequest.onerror = function (event) {
            console.error("Error counting records:", event.target.errorCode);
        };
    }).catch(error => {
        console.error("Error opening database:", error);
    });
}

function addQuote(ticker, price) {
    openDatabase().then(db => {
        const transaction = db.transaction(["quotes"], "readwrite");
        const store = transaction.objectStore("quotes");
        const quote = {
            ticker: ticker,
            price: price,
            timestamp: new Date().getTime()
        };

        const request = store.add(quote);

        request.onerror = function (event) {
            console.error("Error writing to the database", event.target.errorCode);
        };
    }).catch(error => {
        console.error("Error opening database:", error);
    });
}

function deleteOldQuotes() {
    openDatabase().then(db => {
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - hoursToStore);

        const transaction = db.transaction(["quotes"], "readwrite");
        const store = transaction.objectStore("quotes");
        const index = store.index("timestamp");

        const range = IDBKeyRange.upperBound(oneHourAgo.getTime());
        const request = index.openCursor(range);

        request.onsuccess = function (event) {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                console.log(`Old quotes deleted up to ${hoursToStore} hour ago.`);
            }
        };

        request.onerror = function (event) {
            console.error("Error deleting old quotes", event.target.errorCode);
        };
    }).catch(error => {
        console.error("Error opening database:", error);
    });
}

function fetchAllTickerData() {
    return openDatabase().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['quotes'], 'readonly');
            const store = transaction.objectStore('quotes');
            const index = store.index('ticker');
            const request = index.getAll();

            request.onsuccess = (event) => {
                const records = event.target.result;
                const dataByTicker = records.reduce((acc, record) => {
                    if (!acc[record.ticker]) {
                        acc[record.ticker] = [];
                    }
                    acc[record.ticker].push({ price: record.price, timestamp: record.timestamp });
                    return acc;
                }, {});

                resolve(dataByTicker);
            };

            request.onerror = (event) => {
                console.error('Failed to fetch ticker data:', event.target.error.message);
                reject(new Error(`Error fetching ticker data: ${event.target.errorCode}`));
            };
        });
    });
}

function fetchLatestTickerData() {
    return openDatabase().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['quotes'], 'readonly');
            const store = transaction.objectStore('quotes');
            const index = store.index('ticker');
            const request = index.openCursor(null, 'prev');

            let latestDataByTicker = {};

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    // Добавляем запись только если для этого тикера еще не добавлена последняя запись
                    if (!latestDataByTicker[record.ticker]) {
                        latestDataByTicker[record.ticker] = { price: record.price, timestamp: record.timestamp };
                    }
                    cursor.continue();
                } else {
                    // Когда курсор прошел все записи, возвращаем результат
                    resolve(latestDataByTicker);
                }
            };

            request.onerror = event => {
                console.error('Failed to fetch latest ticker data:', event.target.error.message);
                reject(new Error(`Error fetching latest ticker data: ${event.target.errorCode}`));
            };
        });
    });
}

function getDateRange() {
    openDatabase().then(db => {
        const transaction = db.transaction(["quotes"], "readonly");
        const store = transaction.objectStore("quotes");
        const index = store.index("timestamp");

        const getMinRequest = index.openCursor(null, "next");
        const getMaxRequest = index.openCursor(null, "prev");

        let minDate, maxDate;

        getMinRequest.onsuccess = function () {
            if (getMinRequest.result) {
                minDate = new Date(getMinRequest.result.value.timestamp);
            }
        };

        getMaxRequest.onsuccess = function () {
            if (getMaxRequest.result) {
                maxDate = new Date(getMaxRequest.result.value.timestamp);
            }
        };

        transaction.oncomplete = function () {
            if (minDate && maxDate) {
                const minuteDifference = Math.abs(maxDate.getTime() - minDate.getTime()) / 60000;
                $('#date-range').text(`-for ${parseInt(minuteDifference)} min`);
            }
        };

        transaction.onerror = function (event) {
            console.error("Error fetching date range:", event.target.errorCode);
        };
    }).catch(error => {
        console.error("Error opening database:", error);
    });
}


async function generateData() {
    // для генерации тестовых данных в базе данных
    const db = await openDatabase();
    const transaction = db.transaction(["quotes"], "readwrite");
    const store = transaction.objectStore("quotes");

    const tickers = [
        "VTBR", "ZAYMER", "GMKN", "WHOOSH",
        "IMOEX", "TGOLD", "TLCB"
    ];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14); // Две недели назад

    tickers.forEach(ticker => {
        let price = 100 + Math.random() * 50; // Начальная цена от 100 до 150

        for (let day = 0; day < 14; day++) {
            const newDate = new Date(startDate.getTime());
            newDate.setDate(startDate.getDate() + day);

            // Имитация изменения цены: колебания +- 5% в день
            const change = 1 + (Math.random() - 0.5) / 10;
            price *= change;

            const currentDate = new Date();

            // Устанавливаем случайные часы, минуты, секунды и миллисекунды
            currentDate.setHours(Math.floor(Math.random() * 24)); // От 0 до 23 часов
            currentDate.setMinutes(Math.floor(Math.random() * 60)); // От 0 до 59 минут
            currentDate.setSeconds(Math.floor(Math.random() * 60)); // От 0 до 59 секунд
            currentDate.setMilliseconds(Math.floor(Math.random() * 1000)); // От 0 до 999 миллисекунд

            // Получаем метку времени для новой случайной даты
            const randomTimestamp = currentDate.getTime();

            const quote = {
                ticker: ticker,
                price: price,
                timestamp: randomTimestamp
            };
            store.add(quote);
        }
    });

    transaction.oncomplete = function () {
        console.log("All data generated and stored.");
    };

    transaction.onerror = function (event) {
        console.error("Transaction error: ", event.target.errorCode);
    };
}