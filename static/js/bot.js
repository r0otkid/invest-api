const sendMessage = (message) => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    $.post(url, { chat_id: chatId, text: message })
        .done(response => console.log("Сообщение отправлено", response))
        .fail(error => console.error("Ошибка при отправке сообщения", error));
}