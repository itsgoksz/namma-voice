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
    
    # 1. Emoji replace
    content = content.replace('🌏', '🌱')
    
    # 2. globals.css updates
    if filepath.endswith('globals.css'):
        content = re.sub(r'--background:.*;', '--background: #080808;', content)
        content = re.sub(r'--coral:.*;', '--coral: #10b981;', content)
        content = re.sub(r'--coral-dim:.*;', '--coral-dim: rgba(16, 185, 129, 0.2);', content)
        content = re.sub(r'--card-bg:.*;', '--card-bg: rgba(24, 24, 27, 0.65);', content)
        content = re.sub(r'--card-border:.*;', '--card-border: rgba(255, 255, 255, 0.1);', content)
        content = re.sub(r'body\s*{[^}]*}', 'body {\n  background: var(--background);\n  color: var(--foreground);\n  overflow-x: hidden;\n  -webkit-tap-highlight-color: transparent;\n}', content)
    
    # 3. Component styling replaces
    # Backgrounds
    content = content.replace('bg-[rgba(85,107,47,0.6)]', 'bg-[rgba(24,24,27,0.6)]')
    content = content.replace('bg-[rgba(85,107,47,0.85)]', 'bg-zinc-900/80')
    content = content.replace('bg-[#556b2f]/30', 'bg-white/5')
    content = content.replace('bg-[#556b2f]/20', 'bg-white/5')
    content = content.replace('bg-[#556b2f]/10', 'bg-white/5')
    content = content.replace('bg-[#556b2f]', 'bg-[#10b981]') # things like progress bar
    
    # Borders
    content = content.replace('border-[#556b2f]/50', 'border-white/10')
    content = content.replace('border-[#556b2f]/30', 'border-white/10')
    content = content.replace('border-[#556b2f]/20', 'border-white/10')
    content = content.replace('border-[#556b2f]', 'border-white/10')
    
    # Texts
    # For Starfield, make it white/5
    if filepath.endswith('Starfield.tsx'):
        content = content.replace('text-[#556b2f]', 'text-white/5')
    else:
        # General text -> zinc-400
        content = content.replace('text-[#556b2f]', 'text-zinc-400')
    
    # Shadows
    content = re.sub(r'shadow-\[0_0_.*?rgba\(85,107,47,.*?\]', 'shadow-none', content)
    
    # Buttons
    # Navigate button
    content = content.replace('bg-[#ADEBB3] text-[#555D00]', 'bg-[#10b981] text-white')
    content = content.replace('rgba(173,235,179', 'rgba(16,185,129')
    
    # BottomNav + button
    content = content.replace('bg-[#ADEBB3]', 'bg-[#10b981]')
    content = content.replace('text-[#555D00]', 'text-white')
    
    # Hover states
    content = content.replace('hover:bg-[#556b2f]/30', 'hover:bg-white/10')
    content = content.replace('hover:bg-[#556b2f]/60', 'hover:bg-white/20')
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Redesign complete.")
