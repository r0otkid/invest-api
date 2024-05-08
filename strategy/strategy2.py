import logging
import numpy as np


class TradingStrategy:
    def __init__(
        self, db, balance: float, sl: float, tp: float, forecast: dict, market_data: dict, is_reverse: bool = False
    ) -> None:
        self.db = db
        self.balance = balance
        self.sl = sl
        self.tp = tp
        self.is_reverse = is_reverse
        self.forecast = forecast
        self.market_data = market_data['marketData']

    @staticmethod
    def calculate_sma(prices, period):
        if len(prices) >= period:
            return np.mean(prices[-period:])
        return None

    @staticmethod
    def calculate_ema(prices, period):
        if len(prices) < period:
            return None
        ema = [prices[0]]  # начальное значение EMA равно первой цене
        k = 2 / (period + 1)
        for price in prices[1:]:
            ema.append(price * k + ema[-1] * (1 - k))
        return ema[-1]

    @staticmethod
    def calculate_rsi(prices, period=10):
        if len(prices) < period:
            return None

        gains = []
        losses = []
        for i in range(1, len(prices)):
            delta = prices[i] - prices[i - 1]
            if delta > 0:
                gains.append(delta)
            else:
                losses.append(-delta)

        average_gain = np.mean(gains) if gains else 0
        average_loss = np.mean(losses) if losses else 0

        if average_loss == 0:
            return 100  # В теории RSI может быть 100, если нет потерь

        rs = average_gain / average_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    async def make_predicate(self) -> list:
        messages = []
        cursor = self.db.market_data.find().sort('_id', -1).limit(30)
        history_records = await cursor.to_list(length=30)

        if not history_records:
            return ["Error: No historical data found"]

        trends = {}
        for record in history_records:
            for ticker, data in record['marketData'].items():
                if ticker not in trends:
                    trends[ticker] = []
                trends[ticker].append(data['price'])

        for ticker, data in self.market_data.items():
            current_price = data['price']
            instrument = await self.db.instruments.find_one({'ticker': ticker})
            cursor = self.db.orders.find({'order_type': 'buy', 'instrument_uid': instrument['uid']})
            buy_orders = await cursor.to_list(length=None)
            prices = [order['price'] for order in buy_orders]
            buy_price = np.mean(prices) if prices else current_price  #  среднее арифметическое цен покупки или текущая

            forecast_prob = self.forecast.get(ticker, 0)
            prices = trends.get(ticker, [])

            sma = self.calculate_sma(prices, period=48)
            ema = self.calculate_ema(prices, period=48)
            rsi = self.calculate_rsi(prices, period=56)

            # Рассчитать процент изменения цены
            price_change = (current_price - buy_price) / buy_price * 100

            security_obj = await self.db.securities.find_one({})
            securities = security_obj.get('securities', []) if security_obj else []

            sec_balance = 0
            for sec in securities:
                if sec['instrument_uid'] == instrument['uid']:
                    sec_balance = sec['balance']
            sl = self.sl if instrument['instrument_type'] == 'share' else self.sl / 3
            tp = self.tp if instrument['instrument_type'] == 'share' else self.tp / 3
            buy = '📈 BUY'
            sell = '📉 SELL'
            if price_change <= -sl and sec_balance > 0:
                messages.append(f"{sell} {ticker}")  # - Stop Loss
            elif price_change >= tp and sec_balance > 0:
                messages.append(f"{sell} {ticker}")  # - Take Profit
            else:
                if sma is not None and ema is not None:
                    if (current_price > ema and current_price > sma and forecast_prob >= 0.6) and (
                        rsi is not None and rsi < 30
                    ):
                        action = buy if not self.is_reverse else sell
                        messages.append(f"{action} {ticker}")
                    elif (current_price < ema and current_price < sma and forecast_prob >= 0.7) and (
                        rsi is not None and rsi > 70
                    ):
                        action = sell if not self.is_reverse else buy
                        messages.append(f"{action} {ticker}")
                    else:
                        messages.append(f"⏳ HOLD {ticker} - No clear action")
        return messages
