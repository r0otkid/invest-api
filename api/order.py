import logging
import uuid
from tinkoff.invest import AsyncClient, OrderDirection, OrderType, OrderExecutionReportStatus, GetOrdersResponse
from settings import TOKEN, TARGET
from utils import money_value_to_rub


async def create_market_order(account_id: str, instrument_id: str, quantity: int, is_buy: bool) -> dict:
    """Общая функция для создания рыночного ордера на покупку или продажу."""

    direction = OrderDirection.ORDER_DIRECTION_BUY if is_buy else OrderDirection.ORDER_DIRECTION_SELL

    async with AsyncClient(TOKEN, target=TARGET) as client:
        try:
            order_response = await client.orders.post_order(
                quantity=quantity,
                direction=direction,
                account_id=account_id,
                order_type=OrderType.ORDER_TYPE_MARKET,
                order_id=str(uuid.uuid4()),
                instrument_id=instrument_id,
            )
        except Exception as e:
            logging.warning(
                f"Quantity: {quantity}, direction: {direction}, account_id: {account_id}, instrument_id: {instrument_id}"
            )
            logging.error(f"Error while creating order: {e}")
            return {"error": str(e)}
        if order_response.execution_report_status == OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_FILL:
            return {"message": f"Order for {direction} was executed successfully, order_id: {order_response.order_id}"}
        else:
            return {"error": f"Order for {direction} was not executed", "details": order_response.message}


async def buy_order_create(account_id: str, instrument_id: str, quantity: int) -> dict:
    """Создание рыночного ордера на покупку."""
    return await create_market_order(account_id, instrument_id, quantity, True)


async def sell_order_create(account_id: str, instrument_id: str, quantity: int) -> dict:
    """Создание рыночного ордера на продажу."""
    return await create_market_order(account_id, instrument_id, quantity, False)


async def get_all_orders(account_id: str) -> dict:
    """Получение списка всех активных ордеров для указанного счета."""
    async with AsyncClient(TOKEN, target=TARGET) as client:
        try:
            response: GetOrdersResponse = await client.orders.get_orders(account_id=account_id)
            orders = response.orders
            return {"orders": [order.to_dict() for order in orders]}  # Конвертируем объекты Order в словари
        except Exception as e:
            return {"error": str(e)}
