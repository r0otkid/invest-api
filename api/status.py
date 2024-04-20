from tinkoff.invest import Client as Cli
from settings import TOKEN
from utils import convert_to_json

async def get_trading_statuses(instrument_ids: list) -> dict:
    with Cli(TOKEN) as client:
        statuses = client.market_data.get_trading_statuses(instrument_ids=instrument_ids)
        print(statuses)
        status_list = [convert_to_json(status) for status in statuses.trading_statuses]
        
        return {
            'statuses': status_list
        }