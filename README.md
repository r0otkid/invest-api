# Trade Executor

![Trade Executor](https://i.ibb.co/mDpFwsy/image.png)

## Установка

Для установки необходимо выполнить следующие шаги:

0. Создать файл settings.py со следующим содержанием

    ```python
import os
from tinkoff.invest.constants import INVEST_GRPC_API, INVEST_GRPC_API_SANDBOX

IS_PROD = os.getenv("GRPC_PRODUCTION")
TOKEN = 'ХХХХ ЗАМЕНИТЬ НА ТОКЕН TINKOFF ХХХХ'
BOT_TOKEN = 'ХХХХ ЗАМЕНИТЬ НА ТОКЕН TELEGRAM ХХХХ'
ROOT_ID = "ХХХХ ЗАМЕНИТЬ НА АЙДИ В TELEGRAM ХХХХ"
TARGET = INVEST_GRPC_API if IS_PROD else INVEST_GRPC_API_SANDBOX
    ```

1. Установить все необходимые зависимости с помощью pip:

    ```bash
    pip install -r requirements.txt
    ```

## Запуск

Чтобы запустить приложение, выполните следующую команду:

```bash
python main.py
```

# Доступ

После запуска приложение будет доступно по адресу localhost:8080.


# Стратегии Технического Анализа

## SMA (скользящее среднее арифметическое)

    Краткосрочные стратегии: 5-20 периодов
    Среднесрочные стратегии: 20-50 периодов
    Долгосрочные стратегии: 100-200 периодов

## EMA (экспоненциальное скользящее среднее)

    Краткосрочные стратегии: 5-20 периодов
    Среднесрочные стратегии: 20-50 периодов
    Долгосрочные стратегии: 100-200 периодов

## WMA (взвешенное скользящее среднее)

    Краткосрочные стратегии: 5-20 периодов
    Среднесрочные стратегии: 20-50 периодов
    Долгосрочные стратегии: 50-100 периодов

## RSI (индекс относительной силы)

    Общепринятый диапазон: 14 периодов (стандарт)
    Краткосрочные стратегии: 5-10 периодов
    Долгосрочные стратегии: 20-30 периодов