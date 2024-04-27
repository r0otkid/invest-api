import json
import motor.motor_asyncio
import os
from typing import Optional
from tinkoff.invest.utils import quotation_to_decimal
from api.account import get_balance
import jinja2
import aiohttp_jinja2
from aiohttp import web

from api.account import (
    add_money_sandbox,
    close_all_sanbox_accounts,
    get_account_positions,
    get_accounts,
    get_info,
    open_sandbox_account,
)
from api.instrument import find_instruments, get_instrument_by_id
from settings import BOT_TOKEN, TOKEN, ROOT_ID
from api.order import get_all_orders
from strategy.strategy2 import TradingStrategy
from support.calculator import BalanceCalculator
from support.executor import TradeExecutor
from utils import get_account_id, get_instruments, process_forecast

# Создание подключения к MongoDB
client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
db = client.tin

routes = web.RouteTableDef()


INSTRUMENTS = [
    "BBG004730ZJ9",
    # "TCS00A107RM8",
    "BBG004731489",
    "TCS00A105EX7",
    "BBG333333333",  # фонды
    "TCS10A101X50",
    "TCS00A107597",
    # "BBG000LNHHJ9",
]


@routes.get("/")
async def root(request):
    instruments = await get_instruments(instrument_list=INSTRUMENTS, find_function=find_instruments)
    account_id = await get_account_id(accounts=await get_accounts())  # get it from api only first time
    balance = await get_balance(account_id=account_id)

    # сохраняем аккаунт в базу
    await db.account.delete_many({})
    await db.account.insert_one({'account_id': account_id})

    # сохраняем инструменты в базу
    await db.instruments.delete_many({})
    await db.instruments.insert_many(instruments)

    # сохраняем баланс в базу
    await db.securities.delete_many({})
    await db.securities.insert_one({'money': balance})

    context = {
        "balance": balance,
        "bot_token": BOT_TOKEN,
        "chat_id": ROOT_ID,
        "token": TOKEN,
        "instruments": [
            {k: v for k, v in instrument.items() if k != '_id'} for instrument in instruments
        ],  # убираем ObjectId
        "figi_list": [i['figi'] for i in instruments],
    }
    return aiohttp_jinja2.render_template("base.html", request, context=context)


@routes.get("/start")
async def start(request):
    return web.json_response({})


@routes.post("/market-data")
async def marketData(request):
    sl = float(request.query.get('sl', '0.1'))
    tp = float(request.query.get('tp', '0.15'))
    new_data = await request.json()

    forecast_results = await process_forecast(db.market_data, new_data)
    await db.market_data.insert_one(new_data)

    calculator = BalanceCalculator(motor=db)
    balance = await calculator.get_money()

    strategy = TradingStrategy(db, balance, sl, tp, forecast_results, new_data)
    predicates = await strategy.make_predicate()

    executor = TradeExecutor(db=db, calculator=calculator)
    await executor.execute_trades(predicates=predicates, market_data=new_data['marketData'])
    return web.json_response({'forecast_results': forecast_results, 'predicate': predicates})

    # try:
    #    new_data = await request.json()
    #    sl = float(request.query.get('sl', '0.1'))
    #    tp = float(request.query.get('tp', '0.15'))

    #     forecast_results = await process_forecast(collection, new_data)
    #     await collection.insert_one(new_data)
    #     balance = await get_balance()
    #     strategy = TradingStrategy(db, forecast_results, sl, tp, balance)
    #     strategy.balance = balance
    #     strategy_response = {}
    #     for id_object in [{'ticker': i['ticker'], "uid": i["uid"]} for i in await get_instruments_cached()]:
    #         response = await strategy.evaluate(id_object['ticker'], id_object['uid'])
    #         lots, strategy_response[id_object['ticker']] = response
    #         if '📉' in response:
    #             if balance > strategy.lots * strategy.price:
    #                 account_id = await get_account_id(accounts=await get_accounts())
    #                 logging.error()
    #                 await create_order(account_id, lots, id_object['uid'], "buy")
    #                 break
    #         if '📈' in response:
    #             account_id = await get_account_id(accounts=await get_accounts())
    #             if lots:
    #                 await create_order(account_id, lots, id_object['uid'], "sell")
    #                 break

    #     return web.json_response({'forecast_results': forecast_results, 'strategy_response': strategy_response})
    # except Exception as e:
    #     return web.json_response({'message': str(e)}, status=500)


@routes.get("/accounts")
async def accounts_handler(request):
    accounts = await get_accounts()
    return web.json_response(accounts)


@routes.get("/open-sandbox-account")
async def open_sanbox_acc_handler(request):
    return web.json_response(await open_sandbox_account())


@routes.get("/close-all-sandbox-accounts")
async def close_all_sanbox_acc_handler(request):
    return web.json_response(await close_all_sanbox_accounts())


@routes.get("/add-money")
async def add_money_handler(request) -> Optional[int]:
    account_id = request.query.get("account_id")
    money = request.query.get("money", 10000)

    if not account_id:
        account_id = await get_account_id(accounts=await get_accounts())

    result = await add_money_sandbox(account_id=account_id, money=money) if account_id else None
    return web.json_response(result.balance.units if result else None)


@routes.get("/get-balance")
async def get_balance_handler(request):
    account_id = await get_account_id(accounts=await get_accounts())
    positions = await get_account_positions(account_id=account_id)
    money = float(quotation_to_decimal(positions[0]))
    return web.json_response(money)


@routes.get("/info")
async def info_handler(request):
    return web.json_response(await get_info())


@routes.get("/instrument")
async def instrument_handler(request):
    search_string = request.query.get("search_string", 'ZAYM')
    return web.json_response(await find_instruments(search_string=search_string))


@routes.get("/get-lot-quantity")
async def get_lot_quantity_handler(request):
    instrument_id = request.query.get("id", '')
    instrument = await get_instrument_by_id(instrument_id)
    return web.json_response(instrument.lot)


@routes.get("/orders-list")
async def orders_list_handler(request):
    account_id = await get_account_id(accounts=await get_accounts())
    return web.json_response(await get_all_orders(account_id=account_id))


@routes.get("/all-securities")
async def get_all_securities_handler(request):
    """HTTP роут для получения списка всех бумаг в портфеле."""
    account_id = await get_account_id(accounts=await get_accounts())
    positions = await get_account_positions(account_id=account_id, money_only=False)
    # Сериализация объектов PortfolioPosition в JSON
    securities = [
        {
            "figi": pos.figi,
            "instrument_type": pos.instrument_type,
            "balance": pos.balance,
            "blocked": pos.blocked if pos.blocked else 0,
            "instrument_uid": pos.instrument_uid,
            "position_uid": pos.position_uid,
        }
        for pos in positions.securities
    ]
    await db.securities.update_one({}, {"$set": {"securities": securities}})
    return web.json_response({"securities": securities})


app = web.Application()
aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader(os.path.join(os.getcwd(), "templates")))

app.add_routes(routes)
app.router.add_static('/static/', path=os.path.join(os.path.dirname(__file__), 'static'), name='static')

if __name__ == "__main__":
    web.run_app(app)
