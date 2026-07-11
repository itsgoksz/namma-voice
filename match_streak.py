import os
import re

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
    
    # Replace globals.css card bg
    if filepath.endswith('globals.css'):
        content = re.sub(r'--card-bg:.*;', '--card-bg: rgba(16, 185, 129, 0.1);', content)
        content = content.replace('/* Force CSS reload 2 */', '/* Force CSS reload 3 */')
    else:
        # Replace the hardcoded bg utility class
        content = content.replace('bg-[rgba(10,25,20,0.75)]', 'bg-[#10b981]/10')
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Updated glass to exactly match the streak pill emerald tint.")
