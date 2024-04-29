import json
from tinkoff.invest.exceptions import RequestError
from dataclasses import asdict
from datetime import datetime
import logging


def serializer(val):
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, list):
        return list(val)
    return val


def convert_to_json(obj):
    if hasattr(obj, "__dict__"):
        return json.dumps(asdict(obj), default=serializer, ensure_ascii=False)
    else:
        raise TypeError(f"Object of type {type(obj)} is not serializable to JSON")


async def get_account_id(accounts: list) -> str:
    account = json.loads(accounts["accounts"][0]) if accounts["accounts"] else {"id": ''}
    return account['id']


def money_value_to_rub(money_value):
    # Преобразование структуры MoneyValue в рубли, учитывая 'units' и 'nano'
    return money_value.units + money_value.nano / 1_000_000_000.0


async def get_instruments(instrument_list, find_function) -> list:
    instruments = []
    try:
        for instrument in instrument_list:
            instruments = [*instruments, *await find_function(instrument)]
    except RequestError as e:
        logging.warning('Не получается получить инструменты')
        logging.error(e)
    return instruments


async def process_forecast(collection, new_data) -> dict:
    market_data = new_data['marketData']
    forecast_results = {}

    # Получаем последние 30 записей для каждого тикера
    for ticker, info in market_data.items():
        current_price = info['price']
        forecasts_query = collection.find({"marketData." + ticker: {"$exists": True}}).limit(30)
        last_records = await forecasts_query.to_list(length=30)
        correct_forecasts = 0
        total_forecasts = 0

        for record in last_records:
            if record:
                last_price = record['marketData'][ticker]['price']
                last_forecast = record['analyticsData'].get(ticker, None)

                # Считаем, сбылся ли прогноз
                if last_forecast is not None:
                    if (current_price > last_price and last_forecast > 50) or (
                        current_price < last_price and last_forecast < 50
                    ):
                        correct_forecasts += 1
                    total_forecasts += 1

        # Сохраняем процент правильных прогнозов
        if total_forecasts > 0:
            forecast_accuracy = correct_forecasts / total_forecasts
            forecast_results[ticker] = forecast_accuracy

    return forecast_results
