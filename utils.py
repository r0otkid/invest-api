import json
from dataclasses import asdict
from datetime import datetime


def serializer(val):
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, list):
        return list(val)
    return val


def convert_to_json(obj):
    if hasattr(obj, "__dict__"):
        return json.dumps(asdict(obj), default=serializer, ensure_ascii=False)
    else:
        raise TypeError(f"Object of type {type(obj)} is not serializable to JSON")


async def get_account_id(accounts: list) -> str:
    account = json.loads(accounts["accounts"][0]) if accounts["accounts"] else {"id": ''}
    return account['id']
