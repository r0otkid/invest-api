import talib
from typing import Dict, List, Tuple
import numpy as np


class TradingStrategy:
    def __init__(
        self, db, balance: float, sl: float, tp: float, forecast: dict, market_data: dict, is_reverse: bool = False
    ) -> None:
        self.db = db
        self.balance = balance
        self.buy = '📈 BUY'
        self.sell = '📉 SELL'
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

    @staticmethod
    def calculate_atr(prices, period=14):
        high = prices['high']
        low = prices['low']
        close = prices['close']

        tr1 = np.abs(high - low)
        tr2 = np.abs(high - close.shift())
        tr3 = np.abs(low - close.shift())

        tr = np.maximum.reduce([tr1, tr2, tr3])

        atr = np.zeros_like(tr)
        atr[period - 1] = np.mean(tr[:period])

        for i in range(period, len(atr)):
            atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period

        return atr[-1]

    async def _get_trends(self) -> Dict[str, List[float]]:
        cursor = self.db.market_data.find().sort('_id', -1).limit(1000)
        history_records = await cursor.to_list(length=None)

        if not history_records:
            return ["Error: No historical data found"]

        trends = {}
        for record in history_records:
            for ticker, data in record['marketData'].items():
                if ticker not in trends:
                    trends[ticker] = []
                trends[ticker].append(data['price'])
        return trends

    async def _get_security_balance(self, instrument: dict) -> float:
        security_obj = await self.db.securities.find_one({})
        securities = security_obj.get('securities', []) if security_obj else []
        sec_balance = 0
        for sec in securities:
            if sec['instrument_uid'] == instrument['uid']:
                sec_balance = sec['balance']
                break
        return float(sec_balance)

    def _cal_sl_tp(self, instrument: dict, atr_value: float) -> Tuple[float, float]:
        sl = self.sl if instrument['instrument_type'] == 'share' else self.sl / 2
        tp = self.tp if instrument['instrument_type'] == 'share' else self.tp / 2
        sl_multiplier = sl / atr_value  # Множитель для уровня SL
        tp_multiplier = tp / atr_value  # Множитель для уровня TP
        return sl_multiplier, tp_multiplier

    async def _get_predicate(
        self, messages: list, instrument: dict, current_price: float, price_change: float, trends: dict
    ) -> List[str]:
        ticker = instrument['ticker']
        prices = trends.get(ticker, [])

        # волотильность
        atr_value = self.calculate_atr(prices, period=14)
        sl_multiplier, tp_multiplier = self._cal_sl_tp(instrument, atr_value)

        stop_loss = current_price - sl_multiplier * atr_value
        take_profit = current_price + tp_multiplier * atr_value

        forecast_prob = self.forecast.get(ticker, 0)

        # скользящие средние
        sma = self.calculate_sma(prices, period=20)  # период по 20 штук на 1000 цен
        ema = self.calculate_ema(prices, period=20)
        rsi = self.calculate_rsi(prices, period=20)

        sec_balance = await self._get_security_balance(instrument)

        if price_change <= -sl_multiplier and sec_balance > 0:
            messages.append(f"{self.sell} {ticker} SL: {stop_loss:.2f}")  # - Stop Loss
        elif price_change >= tp_multiplier and sec_balance > 0:
            messages.append(f"{self.sell} {ticker} TP: {take_profit:.2f}")  # - Take Profit
        else:
            if sma is not None and ema is not None:
                if (current_price > ema and current_price > sma and forecast_prob >= 0.45) and (
                    rsi is not None and rsi < 30
                ):
                    action = self.buy if not self.is_reverse else self.sell
                    messages.append(f"{action} {ticker}")
                elif (current_price < ema and current_price < sma and forecast_prob >= 0.6) and (
                    rsi is not None and rsi > 70
                ):
                    action = self.sell if not self.is_reverse else self.buy
                    messages.append(f"{action} {ticker}")
                else:
                    messages.append(f"⏳ HOLD {ticker} - No clear action")
        return messages

    async def make_predicate(self) -> List[str]:
        messages = []
        trends = await self._get_trends()
        for ticker, data in self.market_data.items():
            current_price = data['price']
            instrument = await self.db.instruments.find_one({'ticker': ticker})
            cursor = self.db.orders.find({'order_type': 'buy', 'instrument_uid': instrument['uid']})
            buy_orders = await cursor.to_list(length=None)
            prices = [order['price'] for order in buy_orders]
            buy_price = np.mean(prices) if prices else current_price  #  среднее арифметическое цен покупки или текущая

            # Рассчитать процент изменения цены
            price_change = (current_price - buy_price) / buy_price * 100

            messages = await self._get_predicate(messages, instrument, current_price, price_change, trends)
        return messages
