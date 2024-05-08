
const updateExchangeTimer = () => {
    const now = new Date();
    const openingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 59, 0); // 9:00 утра
    const closingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 40, 0); // 17:00 вечера

    let targetTime;
    let messagePrefix;

    if (now < openingTime) {
        targetTime = openingTime;
        messagePrefix = "To open: ";
    } else if (now >= openingTime && now < closingTime) {
        targetTime = closingTime;
        messagePrefix = "To close: ";
    } else {
        $('#exchange-timer').text("Evening trading");
        return;
    }

    const diff = targetTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    $('#exchange-timer').text(`${messagePrefix}${hours}:${minutes}:${seconds}`);
}


$(document).ready(function () {
    updateExchangeTimer();
    setInterval(updateExchangeTimer, 1000);
    $('#delete-acc').on('click', () => {
        closeAllAccounts();
    });
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