const getAllSecurities = () => {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/all-securities',
            type: 'GET',
            success: (response) => {
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
