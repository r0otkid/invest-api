from datetime import timedelta
from tinkoff.invest import Client as Cli, CandleInterval
from tinkoff.invest.utils import now
from settings import TOKEN
from utils import convert_to_json


async def get_candles(figi: str, days: int = 365) -> dict:
    with Cli(TOKEN) as cli:
        response = cli.get_all_candles(
            figi=figi,  # "BBG004730N88"
            from_=now() - timedelta(days=days),
            interval=CandleInterval.CANDLE_INTERVAL_HOUR,
        )
        print(await response)
        return {"candles": [convert_to_json(candle) for candle in response.candles]}
