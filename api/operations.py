from tinkoff.invest import Client as Cli,GetOperationsByCursorRequest
from settings import TOKEN
from utils import convert_to_json

async def get_operations_by_cursor() -> dict:
    with Cli(TOKEN) as client:
        accounts = client.users.get_accounts()
        account_id = accounts.accounts[0].id

        def get_request(cursor="", insrument_id: str = 'BBG004730N88'):
            return GetOperationsByCursorRequest(
                account_id=account_id,
                instrument_id=insrument_id,
                cursor=cursor,
                limit=1,
            )

        operations = client.operations.get_operations_by_cursor(get_request())
        operation_list = [convert_to_json(op) for op in operations.operations]
        while operations.has_next:
            request = get_request(cursor=operations.next_cursor)
            operations = client.operations.get_operations_by_cursor(request)
            operation_list.extend([convert_to_json(op) for op in operations.operations])
        
        return {
            'operations': operation_list
        }

async def get_positions_stream() -> dict:
    with Cli(TOKEN) as client:
        response = client.users.get_accounts()
        accounts = [account.id for account in response.accounts]
        positions_list = []

        for position in client.operations_stream.positions_stream(accounts=accounts):
            positions_list.append(convert_to_json(position))
        
        return {
            'positions': positions_list
        }