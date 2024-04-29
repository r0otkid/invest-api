from tinkoff.invest import Client as Cli, InstrumentIdType
from tinkoff.invest.caching.instruments_cache.instruments_cache import InstrumentsCache
from tinkoff.invest.caching.instruments_cache.settings import InstrumentsCacheSettings
from settings import TOKEN
from utils import convert_to_json


async def get_instrument_by_id(instrument_id: str, db=None):
    if not db:
        with Cli(TOKEN) as cli:
            response = cli.instruments.get_instrument_by(id=instrument_id, id_type=InstrumentIdType(3))  # uid
            result = response.instrument
            return result
    else:
        result = await db.instruments.find_one({"uid": instrument_id})
        return result


async def get_trading_status(figi: str) -> tuple:
    with Cli(TOKEN) as cli:
        trading_status = cli.market_data.get_trading_status(figi=figi)
        return trading_status.market_order_available_flag, trading_status.api_trade_available_flag


async def find_instruments(search_string: str = '') -> list:
    with Cli(TOKEN) as cli:
        response = cli.instruments.find_instrument(query=search_string)
        instruments = []
        for instrument in response.instruments:
            instruments.append(
                {
                    "isin": instrument.isin,
                    "figi": instrument.figi,
                    "ticker": instrument.ticker,
                    "class_code": instrument.class_code,
                    "instrument_type": instrument.instrument_type,
                    "name": instrument.name,
                    "uid": instrument.uid,
                    "position_uid": instrument.position_uid,
                    "instrument_kind": instrument.instrument_kind.value,
                    "api_trade_available_flag": instrument.api_trade_available_flag,
                    "for_iis_flag": instrument.for_iis_flag,
                    "first_1min_candle_date": instrument.first_1min_candle_date.isoformat(),
                    "first_1day_candle_date": instrument.first_1day_candle_date.isoformat(),
                    "for_qual_investor_flag": instrument.for_qual_investor_flag,
                    "weekend_flag": instrument.weekend_flag,
                    "blocked_tca_flag": instrument.blocked_tca_flag,
                }
            )
        return instruments


async def get_instruments_cache() -> dict:
    with Cli(TOKEN) as client:
        inst = client.instruments.etfs().instruments[-1]

        from_server = client.instruments.etf_by(
            id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_UID,
            class_code=inst.class_code,
            id=inst.uid,
        )

        settings = InstrumentsCacheSettings()
        instruments_cache = InstrumentsCache(settings=settings, instruments_service=client.instruments)

        from_cache = instruments_cache.etf_by(
            id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_UID,
            class_code=inst.class_code,
            id=inst.uid,
        )

        return {"from_server": convert_to_json(from_server), "from_cache": convert_to_json(from_cache)}


async def get_option_instruments() -> dict:
    with Cli(TOKEN) as client:
        r = client.instruments.options()
        option_instruments = [convert_to_json(instrument) for instrument in r.instruments]

        return {"option_instruments": option_instruments}
