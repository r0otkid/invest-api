import asyncio
import time
import logging
from typing import Callable

from api.account import get_account_positions, get_balance
from support.calculator import BalanceCalculator


class StopLoss:
    def __init__(self, db, sl: float) -> None:
        self.db = db
        self.sl = sl

    async def check_loss(self, price: float, amount: int, instrument_uid: str) -> int:
        cursor = self.db.orders.find({'instrument_uid': instrument_uid, 'order_type': 'buy'}).sort('_id', -1).limit(1)
        last_buy_orders = await cursor.to_list(length=None)
        orders_count = len(last_buy_orders)
        if orders_count:
            average_price = sum([order['price'] for order in last_buy_orders]) / orders_count
            if average_price >= price:
                current_cost = price * amount
                buy_cost = average_price * amount
                if buy_cost:
                    loss_percent = ((buy_cost - current_cost) / buy_cost) * 100
                else:
                    loss_percent = 0
                if loss_percent > self.sl:
                    return amount
                return 0
        return amount


class TakeProfit:
    def __init__(self, db, tp: float) -> None:
        self.db = db
        self.tp = tp

    async def check_profit(self, price: float, amount: int, instrument_uid: str) -> int:
        cursor = self.db.orders.find({'instrument_uid': instrument_uid, 'order_type': 'buy'}).sort('_id', -1).limit(1)
        last_buy_orders = await cursor.to_list(length=None)
        orders_count = len(last_buy_orders)
        if orders_count:
            average_price = sum([order['price'] for order in last_buy_orders]) / orders_count
            if average_price <= price:
                current_profit = price * amount
                sell_profit = average_price * amount
                if sell_profit != 0:
                    profit_percent = ((current_profit - sell_profit) / sell_profit) * 100
                else:
                    profit_percent = 0
                if profit_percent > self.tp:
                    return amount
                return 0
        return amount


class TradeExecutor:
    def __init__(self, db, calculator: BalanceCalculator, sl: float, tp: float):
        self.sl = sl
        self.tp = tp
        self.db = db
        self.calculator = calculator
        self.stop_loss = StopLoss(db, sl)
        self.take_profit = TakeProfit(db, tp)

    async def get_last_order(self, instrument_uid):
        cursor = self.db.orders.find({'instrument_uid': instrument_uid, 'order_type': 'buy'}).sort('_id', -1).limit(1)
        last_order = await cursor.to_list(length=1)
        if last_order:
            return last_order[0]
        else:
            return None

    async def get_any_last_order(self, instrument_uid):
        cursor = self.db.orders.find({'instrument_uid': instrument_uid}).sort('_id', -1).limit(1)
        last_order = await cursor.to_list(length=1)
        if last_order:
            return last_order[0]
        else:
            return None

    async def execute_trades(
        self,
        predicates,
        market_data: dict,
        create_order: Callable,
    ) -> bool:
        order_was_created = False
        for predicate in predicates:
            parts = predicate.split()
            action = parts[0]  # Должно быть 📈 или 📉
            ticker = parts[2]  # Символьный код акции
            instrument = await self.db.instruments.find_one({'ticker': ticker})
            account = await self.db.account.find_one()
            account_id = account.get('account_id')
            if account_id and instrument and action in ['📈', '📉']:
                logging.warning(f'Get recommendation: {action} {ticker}')
                last_order = await self.get_last_order(instrument['uid'])
                real_last_order = await self.get_any_last_order(instrument_uid=instrument['uid'])
                # Проверяем, когда в последний раз выполнялась операция по этому тикеру
                if not last_order or self._can_trade_again(real_last_order['timestamp']):
                    price = market_data.get(ticker, {}).get('price', 0)
                    amount = await self._calculate_amount(action, instrument['uid'], price)
                    is_sell = action == '📉'
                    is_buy = action == '📈'

                    if is_sell:
                        amount = await self.stop_loss.check_loss(price, amount, instrument['uid'])
                        amount = await self.take_profit.check_profit(price, amount, instrument['uid'])

                    if amount > 0:
                        # ПОКУПКА
                        if is_buy:
                            resp = await create_order(account_id, amount, instrument['uid'], 'buy', price)
                            order = {
                                'account_id': account_id,
                                'lots': amount,
                                'instrument_uid': instrument['uid'],
                                'order_type': 'buy',
                                'price': resp.executed_order_price if 'executed_order_price' in resp else price,
                            }
                        # ПРОДАЖА
                        elif is_sell:
                            resp = await create_order(account_id, amount, instrument['uid'], 'sell', price)
                            order = {
                                'account_id': account_id,
                                'lots': amount,
                                'instrument_uid': instrument['uid'],
                                'order_type': 'sell',
                                'price': resp.executed_order_price if 'executed_order_price' in resp else price,
                            }
                        order['timestamp'] = time.time()
                        await self.db.orders.insert_one(order)
                        order_was_created = True
                        logging.warning(f"Order for {action} {ticker} was created.")
                        # обновляем баланс и securities
                        await self.db.securities.delete_many({})
                        await self.db.securities.insert_one({'money': await get_balance(account_id=account_id)})
                        positions = await get_account_positions(account_id=account_id, money_only=False)
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
                        await self.db.securities.update_one({}, {"$set": {"securities": securities}})
                        break
                else:
                    logging.warning(f"Cannot trade {ticker} again so soon.")
        return order_was_created

    def _can_trade_again(self, last_trade_timestamp):
        # Проверяем, прошло ли достаточно времени с последней торговой операции
        current_time = self.get_current_time()
        time_elapsed = current_time - last_trade_timestamp
        return time_elapsed > 60  # секунд

    @staticmethod
    def _calculate_profit_percentage(buy_price, price):
        if buy_price == 0:
            raise ValueError("Buy price cannot be zero.")

        # Расчет процентного изменения
        profit_percentage = ((price - buy_price) / buy_price) * 100
        return profit_percentage

    async def _calculate_amount(self, action, instrument_uid, price):
        # Расчет количества акций для покупки или продажи
        if action == '📈':
            return await self.calculator.get_amount_for_buy(price, instrument_uid)
        elif action == '📉':
            order = await self.get_last_order(instrument_uid=instrument_uid)
            if not order:
                return 0
            profit_percent = self._calculate_profit_percentage(order['price'], price)
            if profit_percent > self.tp or profit_percent < -self.sl:
                return await self.calculator.get_amount_for_sell(instrument_uid, stop_loss_take_profit=True)
            return await self.calculator.get_amount_for_sell(instrument_uid)
        return 0

    @staticmethod
    def get_current_time():
        return time.time()
