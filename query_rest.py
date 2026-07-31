import requests
import json
import os

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}
res = requests.get(f"{url}/rest/v1/reports?select=id,username,cleanup_squad", headers=headers)
print(json.dumps(res.json(), indent=2))
