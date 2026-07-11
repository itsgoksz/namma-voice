import os

dirs = ['src/']
files_to_update = []
for d in dirs:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith('.tsx') or f.endswith('.ts') or f.endswith('.css'):
                files_to_update.append(os.path.join(root, f))

for filepath in files_to_update:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace the plain dark grey bg with the dark ocean green tint
    new_content = content.replace('bg-[rgba(24,24,27,0.6)]', 'bg-[rgba(10,25,20,0.75)]')
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)

print("Removed hardcoded plain grey and applied ocean green tint directly.")
