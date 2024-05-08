$(document).ready(() => {

    $(document).on('click', `[id^='stock-']`, function () {
        const ticker = this.id.replace('stock-', '');
        $('#orders-table tbody tr').removeClass('highlighted');
        $(`#orders-table tbody tr td:contains(${ticker})`).parent().addClass('highlighted');

        const tabButton = $(`.tab-link[data-target='chart-${ticker}']`);
        tabButton.click();
    });

})