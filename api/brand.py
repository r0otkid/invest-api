from tinkoff.invest import Client as Cli
from settings import TOKEN
from utils import convert_to_json

async def get_brands() -> dict:
    with Cli(TOKEN) as cli:
        response = cli.instruments.get_brands()
        return {
            'brands': [
                convert_to_json(brand)
                for brand in response.brands
            ]
        }