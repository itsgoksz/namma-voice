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
    
    # Update globals.css card bg to dark ocean green tint
    if filepath.endswith('globals.css'):
        content = re.sub(r'--card-bg:.*;', '--card-bg: rgba(10, 25, 20, 0.75);', content)
        
        # force another rebuild
        if '/* Force CSS reload 2 */' not in content:
            content = content.replace('/* Force CSS reload */', '/* Force CSS reload 2 */')
    else:
        # Give the subtle grey backgrounds a slight ocean green tint
        content = content.replace('bg-white/5', 'bg-[#10b981]/5')
        content = content.replace('bg-white/10', 'bg-[#10b981]/10')
        
        # Also give borders a slight tint if they are white/10
        content = content.replace('border-white/10', 'border-[#10b981]/20')
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Applied dark ocean green tinted glass.")
