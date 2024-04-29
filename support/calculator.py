from motor.motor_asyncio import AsyncIOMotorClient

from api.instrument import get_instrument_by_id


class BalanceCalculator:
    def __init__(self, motor: AsyncIOMotorClient) -> None:
        self.motor = motor
        self.db = motor.securities

    async def get_money(self) -> float:
        """Получить текущий баланс"""
        securities = await self.db.find_one()
        return securities['money'] if securities else 0

    async def get_securities_balance(self) -> float:
        """Получить баланс активов"""
        securities = await self.db.find_one()
        return sum([security['balance'] for security in securities.get('securities', [])])

    async def get_total_balance(self) -> float:
        """Получить весь баланс"""
        money = await self.get_money()
        actives = await self.get_securities_balance()
        return money + actives

    async def get_lot_quantity(self, instrument_id: str) -> int:
        """Возвращает количество инструментов в лоте"""
        instrument = await get_instrument_by_id(instrument_id, db=self.motor)
        return instrument['lot'] if instrument else 0

    async def get_amount_for_buy(self, price: float, instrument_id: str) -> int:
        """Возвращает количество акций для покупки"""
        lot = await self.get_lot_quantity(instrument_id=instrument_id)
        money_balance = await self.get_money()
        amount_for_buy = int(money_balance / price / lot / 3)

        if amount_for_buy * price * lot > money_balance:
            amount_for_buy = 0

        return amount_for_buy

    async def get_amount_for_sell(self, instrument_id: str, stop_loss_take_profit: bool = False) -> int:
        """Возвращает количество акций для продажи"""
        instrument = await get_instrument_by_id(instrument_id, db=self.motor)
        securities_object = await self.db.find_one({})
        securities = securities_object.get('securities', []) if securities_object else []
        amount_for_sell = 0
        for security in securities:
            if security['instrument_uid'] == instrument_id:
                balance = security['balance']
                lot = instrument['lot']
                if not stop_loss_take_profit:
                    amount_for_sell = min(balance // lot // 3, int(balance // lot // 3))
                    if not amount_for_sell:
                        if 0 < balance // lot <= 2:
                            amount_for_sell = balance // lot
                else:
                    amount_for_sell = balance // lot
        return amount_for_sell
