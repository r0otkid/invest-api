import logging

from support.calculator import BalanceCalculator


class TradeExecutor:
    def __init__(self, db, calculator: BalanceCalculator):
        self.db = db
        self.last_trades = {}
        self.calculator = calculator

    async def execute_trades(self, predicates, market_data: dict):
        actions = []

        for predicate in predicates:
            # Парсим строку предиката для извлечения действия и тикера
            parts = predicate.split()  # Разбиваем по пробелам
            action = parts[0]  # Должно быть 📈 BUY или 📉 SELL
            ticker = parts[2]  # Символьный код акции
            instrument = await self.db.instruments.find_one({'ticker': ticker})
            if action in ['📈', '📉']:
                # Проверяем, когда в последний раз выполнялась операция по этому тикеру
                if ticker not in self.last_trades or self._can_trade_again(instrument['uid']):
                    price = market_data.get(ticker, {}).get('price', 0)  # Получаем цену из данных рынка
                    amount = await self._calculate_amount(action, instrument['uid'], price)
                    if amount > 0:
                        self.last_trades[ticker] = self.get_current_time()  # Обновляем время последней операции
                        actions.append(f"{action} {amount} of {ticker}")
                        logging.warning(f"{action} {amount} of {ticker}")
                    else:
                        logging.warning(f"No available balance to {action} {ticker}")

        return actions

    def _can_trade_again(self, instrument_uid):
        # Проверяем, прошло ли достаточно времени с последней торговой операции
        time_elapsed = self.get_current_time() - self.last_trades[instrument_uid]
        return time_elapsed > 30  # Предполагаем, что время в секундах

    async def _calculate_amount(self, action, instrument_uid, price):
        # Расчет количества акций для покупки или продажи
        if action == '📈':
            available_money = await self.calculator.get_money()  # Получаем доступные денежные средства
            lot_size = await self.calculator.get_lot_quantity(instrument_uid)  # Получаем количество акций в лоте
            max_affordable_lots = available_money // (
                price * lot_size
            )  # Вычисляем максимальное число лотов, на которое хватит средств
            return int(max_affordable_lots * lot_size)  # Возвращаем количество акций к покупке
        elif action == '📉':
            securities = await self.calculator.db.find_one()  # Получаем текущие активы из базы данных
            for security in securities['securities']:
                if security['instrument_uid'] == instrument_uid:
                    return security['balance']  # Возвращаем количество акций, которое можно продать
        return 0  # Если условия не выполнены, возвращаем 0

    @staticmethod
    def get_current_time():
        import time

        return int(time.time())
