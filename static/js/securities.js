const getAllSecurities = () => {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/all-securities',
            type: 'GET',
            success: (response) => {
                console.log('Информация о портфеле получена', response);
                const securities = response.securities;
                resolve(securities);
            },
            error: (error) => {
                console.log('Ошибка при получении информации о бумагах в портфеле', error);
                reject('Произошла ошибка при получении информации о бумагах в портфеле.');
            }
        });
    });
}

$(document).ready(function () {
    setTimeout(() => {
        getAllSecurities().then(securities => {
            securities.forEach(security => {
                console.log(securities)
                const uid = security.instrument_uid;
                const balance = security.balance;
                $(`#securities-${uid}`).html(balance);
            });
            console.log('📊 Бумаги загружены:', securities);
            sendMessage("📊 Загружены бумаги из портфеля: " + securities.length);
        }).catch(error => {
            console.error('👺 Ошибка при загрузке бумаг:', error);
            sendMessage('👺 Ошибка при загрузке бумаг:', error);
        });
    }, 10000)
});