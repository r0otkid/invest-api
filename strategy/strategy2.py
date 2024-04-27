import logging
import numpy as np


class TradingStrategy:
    def __init__(self, db, balance: float, sl: float, tp: float, forecast: dict, market_data: dict) -> None:
        self.db = db
        self.balance = balance
        self.sl = sl
        self.tp = tp
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
    def calculate_rsi(prices, period=14):
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
        cursor = self.db.market_data.find().sort('_id', -1).limit(10)  # Увеличено количество для EMA/SMA
        history_records = await cursor.to_list(length=10)

        if not history_records:
            return ["Error: No historical data found"]

        # last_data = history_records[0]['marketData']

        trends = {}
        for record in history_records:
            for ticker, data in record['marketData'].items():
                if ticker not in trends:
                    trends[ticker] = []
                trends[ticker].append(data['price'])

        for ticker, data in self.market_data.items():
            current_price = data['price']
            # last_price = last_data.get(ticker, {}).get('price', current_price)
            forecast_prob = self.forecast.get(ticker, 0)
            prices = trends.get(ticker, [])

            sma = self.calculate_sma(prices, period=5)  # 5-дневный SMA
            ema = self.calculate_ema(prices, period=5)  # 5-дневный EMA
            rsi = self.calculate_rsi(prices, period=14)

            if sma is not None and ema is not None:
                if (current_price > ema and current_price > sma and forecast_prob > 0.5) or (
                    rsi is not None and rsi < 30
                ):
                    messages.append(f"📈 BUY {ticker} - Good forecast probability")
                elif (current_price < ema and current_price < sma and forecast_prob < 0.5) or (
                    rsi is not None and rsi > 70
                ):
                    messages.append(f"📉 SELL {ticker} - Low forecast probability")
                else:
                    messages.append(f"⏳ HOLD {ticker} - No clear action")
        return messages
