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
    
    # Old peacock green / teal
    content = content.replace('#455d49', '#556b2f') # to Dark Olive
    content = content.replace('rgba(69, 93, 73, 0.2)', 'rgba(85, 107, 47, 0.2)')
    content = content.replace('rgba(69,93,73', 'rgba(85,107,47')
    
    content = content.replace('rgba(21, 57, 57, 0.85)', 'rgba(85, 107, 47, 0.85)')
    content = content.replace('rgba(21,57,57,0.85)', 'rgba(85, 107, 47, 0.85)')
    
    # Remove any stray teal backgrounds
    content = content.replace('#0d1b0a', '#000000')
    content = content.replace('#0a0a0a', '#000000')
    
    # Also I had added bg-[rgba(0,106,80,0.6)] and bg-[rgba(85,107,47,0.6)] which are redundant 
    # since .glass-panel provides it. But keeping them is fine if they are consistent.
    content = content.replace('rgba(0,106,80,0.6)', 'rgba(85,107,47,0.6)')
    content = content.replace('rgba(11,46,30,0.6)', 'rgba(85,107,47,0.6)')
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Updated colors globally to Olive Green and true black.")
