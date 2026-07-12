from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)
response = client.post("/add_xp", json={"username": "g", "amount": 50})
print(response.json())
