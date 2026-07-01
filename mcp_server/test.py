from googleads import ad_manager

client = ad_manager.AdManagerClient.LoadFromStorage(
    "config/googleads.yaml"
)

order_service = client.GetService(
    "OrderService",
    version="v202602"
)

statement = ad_manager.StatementBuilder(version="v202602")
statement.limit = 5

response = order_service.getOrdersByStatement(
    statement.ToStatement()
)

if "results" in response:
    for order in response["results"]:
        print(order["id"], "-", order["name"])
else:
    print("No orders found.")