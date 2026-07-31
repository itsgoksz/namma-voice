from supabase import create_client, Client
import os

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5MzU3Mzk0NCwiZXhwIjoyMDEwMzMzOTQ0fQ.YOUR_KEY_HERE")

supabase: Client = create_client(url, key)
response = supabase.table("reports").select("id, username, cleanup_squad").execute()
print(response.data)
