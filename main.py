from decimal import Decimal
import json
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


routes = web.RouteTableDef()

VTBR_FIGI = "BBG004730ZJ9"  # VTB
ZAYMER_FIGI = "TCS00A107RM8"
GMKN_FIGI = "BBG004731489"
WHOOSH_FIGI = "TCS00A105EX7"
IMOEX_FIGI = "BBG333333333"
TGOLD_FIGI = "TCS10A101X50"
TLCB_FIGI = "TCS00A107597"


async def create_order(request, order_type):
    """Общая функция для создания рыночного ордера на покупку или продажу."""
    acc_id = request.query.get("acc_id", await get_account_id(accounts=await get_accounts()))
    instrument_id = request.query.get("instrument_id")

    if not instrument_id:
        return web.json_response({"error": "Instrument ID is required"})

    if order_type == "buy":
        response = await buy_order_create(
            account_id=acc_id, instrument_id=instrument_id, quantity=28
        )  #  todo: quantity
    else:
        response = await sell_order_create(account_id=acc_id, instrument_id=instrument_id, quantity=28)

    return web.json_response(response)


@routes.get("/")
async def root(request):
    instruments = await find_instruments(VTBR_FIGI)
    instruments = [*instruments, *await find_instruments(ZAYMER_FIGI)]
    instruments = [*instruments, *await find_instruments(GMKN_FIGI)]
    instruments = [*instruments, *await find_instruments(WHOOSH_FIGI)]
    instruments = [*instruments, *await find_instruments(IMOEX_FIGI)]
    instruments = [*instruments, *await find_instruments(TGOLD_FIGI)]
    instruments = [*instruments, *await find_instruments(TLCB_FIGI)]

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
        "figi_list": [
            VTBR_FIGI,
            ZAYMER_FIGI,
            GMKN_FIGI,
            WHOOSH_FIGI,
            IMOEX_FIGI,
            TGOLD_FIGI,
            TLCB_FIGI,
        ],
    }
    response = aiohttp_jinja2.render_template("base.html", request, context=context)
    return response


@routes.get("/start")
async def start(request):
    return web.json_response({})


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
    search_string = request.query.get("search_string", VTBR_FIGI)
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
