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
            alert('Баланс успешно пополнен.');
            window.location = '/';
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
                console.log('Информация получена', response);
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

const updateExchangeTimer = () => {
    const now = new Date();
    const openingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0); // 9:00 утра
    const closingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0); // 17:00 вечера

    let targetTime;
    let messagePrefix;

    if (now < openingTime) {
        targetTime = openingTime;
        messagePrefix = "До открытия: ";
    } else if (now >= openingTime && now < closingTime) {
        targetTime = closingTime;
        messagePrefix = "До закрытия: ";
    } else {
        $('#exchange-timer').text("Биржа закрыта.");
        return; // Заканчиваем функцию, если биржа закрыта
    }

    const diff = targetTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    $('#exchange-timer').text(`${messagePrefix}${hours}:${minutes}:${seconds}`);
}


$(document).ready(function () {
    updateExchangeTimer();
    setInterval(updateExchangeTimer, 1000); // Обновляем таймер каждую секунду
    $('#delete-acc').on('click', closeAllAccounts);
    $('#open-acc').on('click', openAccount);
    $('#add-money').on('click', addMoney);
    getTariff().then(tariff => {
        $('#tariff').text(tariff.toUpperCase());
        sendMessage("🤖 Запущен бот-торговец, тариф: " + tariff.toUpperCase());
    });
    getAccounts().then(accounts => {
        const acc = JSON.parse(accounts[0]);
        console.log('🏛 Аккаунт загружен:', acc);
        sendMessage("🏛 Загружен аккаунт: " + acc.id);
    }).catch(error => {
        console.error('👺 Ошибка при загрузке аккаунта:', error);
        sendMessage('👺 Ошибка при загрузке аккаунта:', error);
    });
});