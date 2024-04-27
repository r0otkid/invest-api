import asyncio
import logging
from api.account import get_account_positions, get_accounts
from api.instrument import get_instrument_by_id
from utils import get_account_id


class TradingStrategy:
    def __init__(self, db, forecast_results, sl, tp, balance):
        self.db = db
        self.forecast_results = forecast_results
        self.sl = sl
        self.tp = tp
        self.balance = balance
        self.lots = None
        self.price = None
        self.pending = False

    async def get_last_price(self, ticker):
        """Получить последнюю цену для тикера из базы данных"""
        record = await self.db.market_data.find_one(
            {"marketData." + ticker: {"$exists": True}}, sort=[("_id", -1)], projection={"marketData." + ticker: 1}
        )
        if record:
            return record['marketData'][ticker]['price']
        return None

    async def calculate_moving_average(self, ticker, window=10):
        """Вычислить скользящее среднее цены за указанное количество последних записей."""
        cursor = self.db.market_data.find(
            {"marketData." + ticker: {"$exists": True}},
            projection={"marketData." + ticker + ".price": 1},
            sort=[("_id", -1)],
            limit=window,
        )
        prices = [record['marketData'][ticker]['price'] for record in await cursor.to_list(length=window)]
        if prices:
            return sum(prices) / len(prices)
        return None

    async def calculate_rsi(self, ticker, periods=14):
        """Вычислить индекс относительной силы (RSI)."""
        cursor = self.db.market_data.find(
            {"marketData." + ticker: {"$exists": True}},
            projection={"marketData." + ticker + ".price": 1},
            sort=[("_id", -1)],
            limit=periods + 1,
        )
        prices = [record['marketData'][ticker]['price'] for record in await cursor.to_list(length=periods + 1)]
        if len(prices) < periods + 1:
            return None

        changes = [prices[i] - prices[i + 1] for i in range(len(prices) - 1)]
        gains = [max(x, 0) for x in changes]
        losses = [abs(min(x, 0)) for x in changes]

        average_gain = sum(gains) / periods
        average_loss = sum(losses) / periods

        if average_loss == 0:
            return 100  # Prevent division by zero; RSI is 100 if the average loss is zero

        rs = average_gain / average_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    async def calculate_ema(self, ticker, span=20):
        """Вычислить экспоненциальное сглаженное среднее (EMA) для цены."""
        cursor = self.db.market_data.find(
            {"marketData." + ticker: {"$exists": True}},
            projection={"marketData." + ticker + ".price": 1},
            sort=[("_id", -1)],
            limit=span,
        )
        prices = [record['marketData'][ticker]['price'] for record in await cursor.to_list(length=span)]
        if not prices:
            return None

        weights = [2 / (span + 1) * (span - i) / span for i in range(span)]
        ema = sum(p * w for p, w in zip(prices, weights)) / sum(weights)
        return ema

    async def evaluate(self, ticker, instrument_id):
        """Оценить возможность сделки на основе данных"""
        last_price = await self.get_last_price(ticker)
        current_price = await self.get_current_price(ticker)  # Получение текущей цены из базы данных
        ema = await self.calculate_ema(ticker, span=20)  # Расчет EMA
        rsi = await self.calculate_rsi(ticker, periods=14)  # Расчет RSI

        forecast = self.forecast_results.get(ticker, 0)

        if current_price is None or ema is None:
            return f"🕘 [{ticker}] Недостаточно данных для анализа"

        # Определение типа сделки на основе прогноза, изменения цен, EMA и RSI
        price_change = (current_price - last_price) / last_price if last_price else 0

        # Использование EMA и RSI в решении
        if forecast > 0.5:  # and current_price > ema and rsi is not None and rsi < 30:  # price_change > self.tp
            lots = await self.calculate_lots(current_price, instrument_id=instrument_id)
            self.lots = lots
            self.price = current_price
            if self.balance > lots * current_price:
                return lots, f"📉 [{ticker}] Сделка на покупку для {lots} лотов (цена выше EMA)"
            else:
                return 0, f"💡 [{ticker}] Не хватает {lots * current_price - self.balance} на балансе (цена выше EMA)"
        elif forecast < 0.5:  # and current_price < ema and rsi is not None and rsi > 70:  # price_change < self.sl
            lots = await self.calculate_lots(current_price, instrument_id=instrument_id)
            self.lots = lots
            self.price = current_price
            account_id = await get_account_id(accounts=await get_accounts())
            positions = await get_account_positions(account_id=account_id, money_only=False)
            available = 0
            for security in positions.securities:
                if security.instrument_uid == instrument_id:
                    available = security.balance
                    break
            if available and available > lots:
                return lots, f"📈 [{ticker}] Сделка на продажу для {lots} лотов (цена ниже EMA)"
            else:
                return 0, f"💡 [{ticker}] условия для продажи, не хватает {lots} лотов (цена ниже EMA)"
        else:
            return 0, f"🕘 [{ticker}] Ожидаем динамику рынка"

    async def get_current_price(self, ticker):
        """Получить текущую цену для тикера из базы данных"""
        record = await self.db.market_data.find_one(
            {"marketData." + ticker: {"$exists": True}}, sort=[("_id", -1)], projection={"marketData." + ticker: 1}
        )
        if record:
            return record['marketData'][ticker]['price']
        return None

    async def calculate_lots(self, price, instrument_id):
        """Рассчитать количество лотов на основе текущего баланса и цены лота"""
        # Получаем информацию о лоте инструмента
        instrument = await get_instrument_by_id(instrument_id)
        if not instrument or not instrument.lot:
            return 0  # В случае отсутствия информации о лоте, возвращаем 0

        lot_multiplier = instrument.lot
        lot_price = price * lot_multiplier  # Стоимость одного лота

        # Рассчитываем допустимую для инвестирования сумму (70% от начального баланса)
        investable_amount = self.balance * 0.7

        # Вычисляем количество лотов, которое можно купить, не опуская баланс ниже 30%
        max_lots = int(investable_amount / lot_price)
        return max_lots
