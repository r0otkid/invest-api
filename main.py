from decimal import Decimal
import motor.motor_asyncio
import os
from typing import Optional
from tinkoff.invest.utils import quotation_to_decimal
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
from api.instrument import find_instruments
from settings import BOT_TOKEN, TOKEN, ROOT_ID
from api.order import buy_order_create, get_all_orders, sell_order_create
from utils import get_account_id

# Создание подключения к MongoDB
client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
db = client.tin
collection = db.market_data

routes = web.RouteTableDef()


INSTRUMENTS = [
    "BBG004730ZJ9",
    "TCS00A107RM8",
    "BBG004731489",
    "TCS00A105EX7",
    "BBG333333333",
    "TCS10A101X50",
    "TCS00A107597",
    "BBG000LNHHJ9",
]


async def create_order(request, order_type):
    """Общая функция для создания рыночного ордера на покупку или продажу."""
    acc_id = request.query.get("acc_id", await get_account_id(accounts=await get_accounts()))
    instrument_id = request.query.get("instrument_id")
    amount = int(round(Decimal(request.query.get("amount")), 0))

    if not instrument_id:
        return web.json_response({"error": "Instrument ID is required"})

    if order_type == "buy":
        response = await buy_order_create(account_id=acc_id, instrument_id=instrument_id, quantity=amount)
    else:
        response = await sell_order_create(account_id=acc_id, instrument_id=instrument_id, quantity=amount)

    return web.json_response(response)


@routes.get("/")
async def root(request):
    instruments = []
    for instrument in INSTRUMENTS:
        instruments = [*instruments, *await find_instruments(instrument)]

    account_id = await get_account_id(accounts=await get_accounts())
    if account_id:
        positions = await get_account_positions(account_id=account_id)
        balance = float(quotation_to_decimal(positions[0]))
    else:
        balance = 0

    context = {
        "balance": balance,
        "bot_token": BOT_TOKEN,
        "chat_id": ROOT_ID,
        "token": TOKEN,
        "instruments": instruments,
        "figi_list": INSTRUMENTS,
    }
    response = aiohttp_jinja2.render_template("base.html", request, context=context)
    return response


@routes.get("/start")
async def start(request):
    return web.json_response({})


@routes.post("/market-data")
async def marketData(request):
    try:
        data = await request.json()
        result = await collection.insert_one(data)
        return web.json_response({'status': 'success', 'inserted_id': str(result.inserted_id)})
    except Exception as e:
        return web.json_response({'status': 'error', 'message': str(e)}, status=500)


@routes.get("/accounts")
async def accounts(request):
    return web.json_response(await get_accounts())


@routes.get("/open-sandbox-account")
async def open_sanbox_acc(request):
    return web.json_response(await open_sandbox_account())


@routes.get("/close-all-sandbox-accounts")
async def close_all_sanbox_acc(request):
    return web.json_response(await close_all_sanbox_accounts())


@routes.get("/add-money")
async def add_money(request) -> Optional[int]:
    account_id = request.query.get("account_id")
    money = request.query.get("money", 10000)

    if not account_id:
        account_id = await get_account_id(accounts=await get_accounts())

    result = await add_money_sandbox(account_id=account_id, money=money) if account_id else None
    return web.json_response(result.balance.units if result else None)


@routes.get("/get-balance")
async def get_balance(request):
    account_id = await get_account_id(accounts=await get_accounts())
    positions = await get_account_positions(account_id=account_id)
    money = float(quotation_to_decimal(positions[0]))
    return web.json_response(money)


@routes.get("/info")
async def info(request):
    return web.json_response(await get_info())


@routes.get("/instrument")
async def instrument(request):
    search_string = request.query.get("search_string", 'ZAYM')
    return web.json_response(await find_instruments(search_string=search_string))


@routes.get("/create-buy-order")
async def create_buy_order(request):
    """Создание рыночного ордера на покупку."""
    return await create_order(request, "buy")


@routes.get("/create-sell-order")
async def create_sell_order(request):
    """Создание рыночного ордера на продажу."""
    return await create_order(request, "sell")


@routes.get("/orders-list")
async def orders_list(request):
    account_id = await get_account_id(accounts=await get_accounts())
    return web.json_response(await get_all_orders(account_id=account_id))


@routes.get("/all-securities")
async def get_all_securities(request):
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
    return web.json_response({"securities": securities})


app = web.Application()
aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader(os.path.join(os.getcwd(), "templates")))

app.add_routes(routes)
app.router.add_static('/static/', path=os.path.join(os.path.dirname(__file__), 'static'), name='static')

if __name__ == "__main__":
    web.run_app(app)
