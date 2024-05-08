import asyncio
import logging
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
from api.instrument import find_instruments, get_instrument_by_id, get_trading_status
from settings import BOT_TOKEN, TOKEN, ROOT_ID
from api.order import buy_order_create, get_all_orders, sell_order_create
from strategy.strategy2 import TradingStrategy
from support.calculator import BalanceCalculator
from support.executor import TradeExecutor
from utils import get_account_id, get_instruments, process_forecast, money_value_to_rub

# Создание подключения к MongoDB
client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
db = client.tin

routes = web.RouteTableDef()

INSTRUMENTS = [
    "BBG004730N88",  # SBER
    "BBG00475K2X9",  # HYDR
    "BBG004S68473",  # IRAO
    "BBG004730ZJ9",  # VTBR
    "BBG0100R9963",  # SGZH
    "BBG0047315D0",  # SNGS
    "BBG004730JJ5",  # MOEX
    "BBG004S68598",  # MTLR
    "BBG004731354",  # ROSN
    "BBG004S68614",  # AFKS
    "BBG00475JZZ6",  # FEES
    "BBG004S683W7",  # AFLT
    "BBG000R04X57",  # FLOT
    # "TCS00A107RM8",  # ZAYMER
    "BBG004731489",  # GMKN
    "BBG000VFX6Y4",  # GLTR
    "BBG004S68B31",  # ALRS
    "TCS00A105EX7",
    # фонды
    # "BBG333333333",  # TMOS
    # "TCS10A101X50",
    # "TCS00A107597",
]


async def create_order(account_id, amount, instrument_id, order_type, price):
    """Общая функция для создания рыночного ордера на покупку или продажу."""
    if not instrument_id:
        return web.json_response({"error": "Instrument ID is required"})

    response = {}
    if order_type == "buy":
        balance = await get_balance(account_id=account_id)
        if balance >= amount * price:
            response = await buy_order_create(account_id=account_id, instrument_id=instrument_id, quantity=amount)
    else:
        response = await sell_order_create(account_id=account_id, instrument_id=instrument_id, quantity=amount)
    if response.get('executed_order_price'):
        money_value = response['executed_order_price']
        return web.json_response(money_value_to_rub(money_value=money_value))
    else:
        return web.json_response({"error": "Order was not created"})


@routes.get("/")
async def root(request):
    instruments = await get_instruments(instrument_list=INSTRUMENTS, find_function=find_instruments)
    account_id = await get_account_id(accounts=await get_accounts())  # get it from api only first time
    balance = await get_balance(account_id=account_id)

    for i in instruments:
        instrument = await get_instrument_by_id(i['uid'])
        i['lot'] = instrument.lot

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
    is_reverse = request.query.get('is_reverse', '').lower() == 'true'
    new_data = await request.json()

    forecast_results = await process_forecast(db.market_data, new_data)
    await db.market_data.insert_one(new_data)

    calculator = BalanceCalculator(motor=db)
    balance = await calculator.get_money()

    strategy = TradingStrategy(db, balance, sl, tp, forecast_results, new_data, is_reverse)
    predicates = await strategy.make_predicate()

    executor = TradeExecutor(db=db, calculator=calculator, sl=sl, tp=tp)
    order_was_created = await executor.execute_trades(
        predicates=predicates, market_data=new_data['marketData'], create_order=create_order
    )

    return web.json_response(
        {'forecast_results': forecast_results, 'predicate': predicates, 'order': order_was_created}
    )


@routes.get("/accounts")
async def accounts_handler(request):
    accounts = await get_accounts()
    return web.json_response(accounts)


@routes.get("/open-sandbox-account")
async def open_sanbox_acc_handler(request):
    await db.account.delete_many({})
    account_id = await open_sandbox_account()
    await db.account.insert_one({'account_id': account_id})
    return web.json_response({'account_id': account_id})


@routes.get("/close-all-sandbox-accounts")
async def close_all_sanbox_acc_handler(request):
    await db.account.delete_many({})
    await db.orders.delete_many({})
    await db.market_data.delete_many({})
    return web.json_response(await close_all_sanbox_accounts())


@routes.get("/add-money")
async def add_money_handler(request) -> Optional[int]:
    account_id = request.query.get("account_id")
    money = request.query.get("money", 10000)
    result = await add_money_sandbox(account_id=account_id, money=int(money)) if account_id else None
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


@routes.get("/instrument-by-id")
async def instrument_handler(request):
    instrument_id = request.query.get("id")
    instrument = await get_instrument_by_id(instrument_id)
    return web.json_response(
        {
            'api_trade_available_flag': instrument.api_trade_available_flag,
            'buy_available_flag': instrument.buy_available_flag,
            'country_of_risk': instrument.country_of_risk,
            'currency': instrument.currency,
            'figi': instrument.figi,
            'for_qual_investor_flag': instrument.for_qual_investor_flag,
            'instrument_type': instrument.instrument_type,
            'lot': instrument.lot,
            'name': instrument.name,
            'position_uid': instrument.position_uid,
            'ticker': instrument.ticker,
            'uid': instrument.uid,
            'weekend_flag': instrument.weekend_flag,
        }
    )


@routes.get("/get-lot-quantity")
async def get_lot_quantity_handler(request):
    instrument_id = request.query.get("id", '')
    instrument = await get_instrument_by_id(instrument_id)
    return web.json_response(instrument.lot)


@routes.get("/orders-list")
async def orders_list_handler(request):
    account_id = await get_account_id(accounts=await get_accounts())
    return web.json_response(await get_all_orders(account_id=account_id))


@routes.get("/create-order")
async def create_order_handler(request):
    account_id = await get_account_id(accounts=await get_accounts())
    amount = request.query.get("amount", 1)
    instrument_id = request.query.get("instrument_id")
    instrument = await get_instrument_by_id(instrument_id)
    order_type = request.query.get("order_type")
    is_market_order_available, is_api_trade_available = await get_trading_status(figi=instrument.figi)
    if is_api_trade_available and is_market_order_available:
        order = await create_order(
            account_id=account_id, amount=int(amount), instrument_id=instrument_id, order_type=order_type
        )
        return web.json_response({'order_id': order.uid})
    return web.json_response(
        {
            'error': f'Trading is not available for `{instrument.name}` instrument.',
            'details': {
                'is_api_trade_available': is_api_trade_available,
                'is_market_order_available': is_market_order_available,
            },
        }
    )


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


@routes.get("/get-securities")
async def get_securities_handler(request):
    security = await db.securities.find_one({})
    instruments = await db.instruments.find({}).to_list(length=1000)
    securities = security.get('securities', []) if security else []
    # prices = []
    for security in securities:
        cursor = db.market_data.find().sort('_id', -1).limit(1)
        data = await cursor.next()
        instrument = next((i for i in instruments if i['uid'] == security['instrument_uid']), None)
        if instrument and '_id' in instrument:
            del instrument['_id']
        security['instrument'] = instrument
        ticker = instrument['ticker']
        if ticker in data['marketData']:
            security['price'] = data['marketData'][ticker]['price'] if data else 0
        if '_id' in security:
            del security['_id']
    return web.json_response({"securities": securities})


@routes.get("/buy-sell-orders")
async def get_buy_sell_orders_handler(request):
    orders = await db.orders.find({}).to_list(length=1000)
    instruments = await db.instruments.find({}).to_list(length=1000)
    for order in orders:
        instrument = next((i for i in instruments if i['uid'] == order['instrument_uid']), None)
        if '_id' in order:  # todo: make serializer
            del order['_id']
        if instrument:
            if '_id' in instrument:
                del instrument['_id']
            order['instrument'] = instrument
    return web.json_response(orders)


app = web.Application()
aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader(os.path.join(os.getcwd(), "templates")))

app.add_routes(routes)
app.router.add_static('/static/', path=os.path.join(os.path.dirname(__file__), 'static'), name='static')

if __name__ == "__main__":
    web.run_app(app)
