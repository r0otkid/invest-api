from motor.motor_asyncio import AsyncIOMotorClient

from api.instrument import get_instrument_by_id


class BalanceCalculator:
    def __init__(self, motor: AsyncIOMotorClient) -> None:
        self.collection = 'securities'
        self.db = motor.securities

    async def get_money(self) -> float:
        """Получить текущий баланс"""
        securities = await self.db.find_one()
        return securities['money']

    async def get_securities_balance(self) -> float:
        """Получить баланс активов"""
        securities = await self.db.find_one()
        return sum([security['balance'] for security in securities['securities']])

    async def get_total_balance(self) -> float:
        """Получить весь баланс"""
        money = await self.get_money()
        actives = await self.get_securities_balance()
        return money + actives

    async def get_lot_quantity(self, instrument_id: str) -> int:
        """Возвращает количество инструментов в лоте"""
        instrument = await get_instrument_by_id(instrument_id)
        return instrument.lot

    async def target_distribution(self):
        total_balance = await self.get_total_balance()
        target_money = total_balance * 0.3  # 30% от общего баланса должно быть в наличных
        target_securities = total_balance * 0.7  # 70% от общего баланса должно быть в активах
        return target_money, target_securities

    async def get_amount_for_buy(self, price: float) -> dict:
        _, target_securities = await self.target_distribution()
        current_money = await self.get_money()
        current_securities = await self.get_securities_balance()
        securities_to_buy = {}

        if current_securities < target_securities:
            needed_for_securities = target_securities - current_securities
            available_for_buy = min(needed_for_securities, current_money)

            securities = await self.db.find_one()
            for security in securities['securities']:
                instrument_id = security['instrument_uid']
                lot_size = await self.get_lot_quantity(instrument_id)
                max_lots = available_for_buy // (price * lot_size)
                if max_lots > 0:
                    # Проверяем, что после покупки баланс денег не уйдет в минус
                    if available_for_buy - (price * lot_size * max_lots) >= 0:
                        securities_to_buy[instrument_id] = max_lots
                    available_for_buy -= price * lot_size * max_lots

        return securities_to_buy

    async def get_amount_for_sell(self) -> dict:
        _, target_securities = await self.target_distribution()
        current_securities = await self.get_securities_balance()
        securities_to_sell = {}

        if current_securities > target_securities:
            excess_securities = current_securities - target_securities

            # Распределение активов для продажи
            securities = await self.db.find_one()
            for security in securities['securities']:
                instrument_id = security['instrument_uid']
                balance = security['balance']
                lot_size = await self.get_lot_quantity(instrument_id)
                sell_lots = min(balance // lot_size, (excess_securities // lot_size))
                if sell_lots > 0:
                    securities_to_sell[instrument_id] = sell_lots

        return securities_to_sell
