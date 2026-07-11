import sqlite3
import os

db_path = os.path.join("backend", "namma.db")

# 1. Alter DB Schema
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

# 2. Modify main.py
main_py_path = os.path.join("backend", "main.py")
with open(main_py_path, 'r') as f:
    content = f.read()

# Update DBReport model
if "cleanup_image_base64 = Column(String, nullable=True)" not in content:
    content = content.replace(
        "image_base64 = Column(String, nullable=True)",
        "image_base64 = Column(String, nullable=True)\n    cleanup_image_base64 = Column(String, nullable=True)"
    )

# Update ReportResponse
if "cleanup_image_base64: Optional[str] = None" not in content.split("class ReportResponse(BaseModel):")[1].split("class ")[0]:
    content = content.replace(
        "image_base64: Optional[str] = None",
        "image_base64: Optional[str] = None\n    cleanup_image_base64: Optional[str] = None"
    )

# Update FeedResponse
if "cleanup_image_base64: Optional[str] = None" not in content.split("class FeedResponse(BaseModel):")[1].split("def get_db():")[0]:
    # We already replaced image_base64 in the previous step... Wait, that was a global replace.
    pass # Wait, let me just do a more robust string replacement

with open(main_py_path, 'w') as f:
    f.write(content)
