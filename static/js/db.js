let db;
const dbName = "QuotesDB";
const index = 3;


function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, index);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("quotes")) {
                const store = db.createObjectStore("quotes", { keyPath: "id", autoIncrement: true });
                store.createIndex("ticker", "ticker", { unique: false }); // Создание индекса 'ticker'
            } else {
                // Если хранилище уже существует, но нужно добавить новый индекс:
                const store = transaction.objectStore("quotes");
                if (!store.indexNames.contains("ticker")) {
                    store.createIndex("ticker", "ticker", { unique: false });
                }
            }
        };

        request.onsuccess = function (event) {
            resolve(event.target.result);
        };

        request.onerror = function (event) {
            // Логирование объекта ошибки, если он доступен, или event.target.error
            console.error("Database error: ", event.target.error ? event.target.error : event);
            reject(event.target.error ? event.target.error.message : "Unknown error occurred.");
        };
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
        request.onsuccess = function () {
            // console.log("Quote added to the database", quote);
        };

        request.onerror = function (event) {
            console.error("Error writing to the database", event.target.errorCode);
        };
    }).catch(error => {
        console.error("Error opening database:", error);
    });
}

function deleteOldQuotes() {
    if (!db) {
        console.error("Database has not been initialized.");
        return;
    }

    openDatabase().then(db => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const transaction = db.transaction(["quotes"], "readwrite");
        const store = transaction.objectStore("quotes");
        const index = store.index("timestamp"); // Предполагается, что у вас есть индекс по временной метке

        const range = IDBKeyRange.upperBound(oneMonthAgo.getTime());
        const request = index.openCursor(range);

        request.onsuccess = function (event) {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                console.log("Old quotes deleted up to one month ago.");
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
            const request = index.getAll(); // Получаем все записи

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

            const quote = {
                ticker: ticker,
                price: price,
                timestamp: newDate.getTime()
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