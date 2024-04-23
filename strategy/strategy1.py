from collections import deque
import numpy as np
from scipy.stats import linregress
import time
import json


class Strategy:
    def __init__(self, min_data_duration=30, history_duration=600):
        self.data = deque()
        self.min_data_duration = min_data_duration
        self.history_duration = history_duration
        self.signal = True

    def add_data(self, request):
        current_time = time.time()
        data_point = {
            'time': current_time,
            'sl': int(request.query.get('sl')),
            'tp': int(request.query.get('tp')),
            'analyze': json.loads(request.query.get('analyze')),
            'best_to_buy': json.loads(request.query.get('best_to_buy')),
            'best_to_sell': json.loads(request.query.get('best_to_sell')),
            'close_price': float(request.query.get('close_price')),
            'previous_price': float(request.query.get('previous_price')),
        }
        self.data.append(data_point)
        self.clean_old_data()

    def clean_old_data(self):
        current_time = time.time()
        while self.data and current_time - self.data[0]['time'] > self.history_duration:
            self.data.popleft()

    def analyze_data(self):
        if not self.is_data_sufficient():
            sec = int(self.min_data_duration - (time.time() - self.data[0]['time']))
            return f"💿 Сбор данных... {sec} sec.", None, None

        best_buy, best_sell = self.calculate_best_options()
        if best_buy is None or best_sell is None:
            return "⏳ Ожидаем динамику рынка.", None, None
        return None, best_buy, best_sell

    def is_data_sufficient(self):
        if not self.data:
            return False
        return time.time() - self.data[0]['time'] >= self.min_data_duration

    def calculate_best_options(self):
        probabilities_buy = []
        probabilities_sell = []
        for point in self.data:
            probabilities_buy.append(float(point['best_to_buy']['probability']))
            probabilities_sell.append(float(point['best_to_sell']['probability']))

        mean_buy = np.mean(probabilities_buy)
        mean_sell = np.mean(probabilities_sell)
        trend_buy = linregress(range(len(probabilities_buy)), probabilities_buy).slope
        trend_sell = linregress(range(len(probabilities_sell)), probabilities_sell).slope

        if trend_buy > 0 and mean_buy > 50:
            best_buy = max(self.data, key=lambda x: float(x['best_to_buy']['probability']))['best_to_buy']['ticker']
        else:
            best_buy = None

        if trend_sell < 0 and mean_sell < 50:
            best_sell = min(self.data, key=lambda x: float(x['best_to_sell']['probability']))['best_to_sell']['ticker']
        else:
            best_sell = None

        return best_buy, best_sell
        # if self.signal:
        #     self.signal = False
        #     return best_buy, best_sell
        # else:
        #     return None, None
