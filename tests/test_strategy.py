import asyncio
import logging
from bson import ObjectId
import motor.motor_asyncio
from unittest import TestCase
from strategy.strategy2 import TradingStrategy
from support.calculator import BalanceCalculator
from utils import process_forecast


class BaseTestCase(TestCase):
    def setUp(self):
        # self.instrument_uid = 'e2bd2eba-75de-4127-b39c-2f2dbe3866c3'
        self.instrument_uid = '8e2b0325-0292-4654-8a18-4f63ed3b0e09'
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
        self.db = client.tin
        self.calculator = BalanceCalculator(motor=self.db)
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.DEBUG)
        self.logger.addHandler(logging.StreamHandler())

    def tearDown(self):
        self.loop.close()

    def async_run(self, coro):
        return self.loop.run_until_complete(coro)


class TestCalculator(BaseTestCase):
    def test_buy_price(self):
        lot_quantity = self.async_run(self.calculator.get_lot_quantity(instrument_id=self.instrument_uid))
        self.assertEqual(lot_quantity, 10000)
        securities_balance = self.async_run(self.calculator.get_securities_balance())
        self.assertIsNotNone(securities_balance)
        amount_for_buy = self.async_run(
            self.calculator.get_amount_for_buy(price=0.0233, instrument_id=self.instrument_uid)
        )
        self.assertGreater(amount_for_buy, 0)

    def test_sell_price(self):
        amount_for_sell = self.async_run(
            self.calculator.get_amount_for_sell(price=0.0233, instrument_id=self.instrument_uid)
        )
        self.assertGreater(amount_for_sell, 0)


class TestStrategy(BaseTestCase):
    def test_make_predicate(self):
        new_data = {
            "_id": ObjectId("662b7e3cb067878bccf18afe"),
            "marketData": {
                "VTBR": {"price": 0.0233, "timestamp": 1714126380258},
            },
            "analyticsData": {"VTBR": 50},
        }
        forecast_results = self.async_run(process_forecast(self.db.market_data, new_data))
        self.assertEqual(forecast_results, {'VTBR': 0.3333333333333333})
        strategy = TradingStrategy(
            sl=0.1, tp=0.2, balance=1000, db=self.db, forecast=forecast_results, market_data=new_data
        )
        predicate = self.async_run(strategy.make_predicate())
        print(predicate)
