import sqlite3
import os

db_path = os.path.join("backend", "namma.db")

try:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("ALTER TABLE reports ADD COLUMN cleanup_image_base64 VARCHAR")
    conn.commit()
    conn.close()
    print("Added cleanup_image_base64 to reports table.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("Column already exists.")
    else:
        print(f"Error: {e}")
