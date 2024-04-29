import logging
from typing import Callable

from api.account import get_account_positions, get_balance
from support.calculator import BalanceCalculator


class TradeExecutor:
    def __init__(self, db, calculator: BalanceCalculator, sl: float, tp: float):
        self.sl = sl
        self.tp = tp
        self.db = db
        self.last_trades = {}
        self.calculator = calculator

    async def get_last_order(self, instrument_uid):
        cursor = self.db.orders.find({'instrument_uid': instrument_uid, 'order_type': 'buy'}).sort('_id', 1).limit(1)
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
    ):
        for predicate in predicates:
            parts = predicate.split()
            action = parts[0]  # Должно быть 📈 BUY или 📉 SELL
            ticker = parts[2]  # Символьный код акции
            instrument = await self.db.instruments.find_one({'ticker': ticker})
            account = await self.db.account.find_one()
            account_id = account['account_id']
            if instrument and action in ['📈', '📉']:
                logging.warning(f'Get recommendation: {action} {ticker}')
                # Проверяем, когда в последний раз выполнялась операция по этому тикеру
                if ticker not in self.last_trades or self._can_trade_again(instrument['uid']):
                    price = market_data.get(ticker, {}).get('price', 0)
                    amount = await self._calculate_amount(action, instrument['uid'], price)
                    logging.warning(f"Amount for {action} {ticker}: {amount}")
                    if amount > 0:
                        self.last_trades[ticker] = self.get_current_time()  # Обновляем время последней операции
                        # ПОКУПКА
                        if action == '📈':
                            await create_order(account_id, amount, instrument['uid'], 'buy')
                            order = {
                                'account_id': account_id,
                                'lots': amount,
                                'instrument_uid': instrument['uid'],
                                'order_type': 'buy',
                                'price': price,
                            }
                        # ПРОДАЖА
                        elif action == '📉':
                            await create_order(account_id, amount, instrument['uid'], 'sell')
                            order = {
                                'account_id': account_id,
                                'lots': amount,
                                'instrument_uid': instrument['uid'],
                                'order_type': 'sell',
                                'price': price,
                            }
                        await self.db.orders.insert_one(order)
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
                    else:
                        logging.warning(f"Amount for {action} {ticker} is zero.")
                else:
                    logging.warning(f"Cannot trade {ticker} again so soon.")

    def _can_trade_again(self, instrument_uid):
        # Проверяем, прошло ли достаточно времени с последней торговой операции
        time_elapsed = self.get_current_time() - self.last_trades[instrument_uid]
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
        import time

        return int(time.time())
