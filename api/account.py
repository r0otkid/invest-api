from decimal import Decimal
import logging
from tinkoff.invest import AsyncClient, MoneyValue
from tinkoff.invest.sandbox.client import SandboxClient
from tinkoff.invest.utils import decimal_to_quotation, quotation_to_decimal
from settings import TOKEN, TARGET, IS_PROD
from utils import convert_to_json


async def get_accounts() -> dict:
    async with AsyncClient(TOKEN, target=TARGET) as client:
        response = await client.users.get_accounts()
        return {"accounts": [convert_to_json(account) for account in response.accounts]}


async def open_sandbox_account() -> str:
    with SandboxClient(TOKEN) as client:
        return client.sandbox.open_sandbox_account(name='contest2024:r0otkid/invest-api:1').account_id


async def close_all_sanbox_accounts():
    with SandboxClient(TOKEN) as client:
        sandbox_accounts = client.users.get_accounts()
        for sandbox_account in sandbox_accounts.accounts:
            client.sandbox.close_sandbox_account(account_id=sandbox_account.id)


async def add_money_sandbox(account_id: str, money: int, currency="rub"):
    money = decimal_to_quotation(Decimal(money))
    with SandboxClient(TOKEN) as client:
        return client.sandbox.sandbox_pay_in(
            account_id=account_id,
            amount=MoneyValue(units=money.units, nano=money.nano, currency=currency),
        )


async def get_account_positions(account_id: str, money_only=True):
    try:
        if IS_PROD:
            async with AsyncClient(TOKEN, target=TARGET) as cli:
                result = await cli.operations.get_positions(account_id=account_id)
                return result.money if money_only else result
        else:
            async with AsyncClient(TOKEN, target=TARGET, sandbox_token=TOKEN) as cli:
                result = await cli.operations.get_positions(account_id=account_id)
                return result.money if money_only else result
    except Exception as e:
        logging.error(e)
        return {'securities': []}


async def get_info() -> dict:
    async with AsyncClient(TOKEN, target=TARGET) as client:
        info = await client.users.get_info()
        result_dict = {
            "prem_status": info.prem_status,
            "qual_status": info.qual_status,
            "qualified_for_work_with": list(info.qualified_for_work_with),
            "tariff": info.tariff,
        }
        return result_dict


async def get_balance(account_id: str) -> float:
    if account_id:
        positions = await get_account_positions(account_id=account_id)
        if positions:
            balance = float(quotation_to_decimal(positions[0]))
        else:
            balance = float(0)
    else:
        balance = float(0)
    return balance
