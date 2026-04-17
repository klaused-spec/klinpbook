import os, json, base64, re

PUBLISHED_DIR = r'c:\src\2ndproject\published\vila-oblitus'
OUT_FILE = r'c:\src\2ndproject\vila-oblitus-standalone.html'

with open(os.path.join(PUBLISHED_DIR, 'index.html'), 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Inline CSS
with open(os.path.join(PUBLISHED_DIR, 'css', 'viewer.css'), 'r', encoding='utf-8') as f:
    css = f.read()
html = html.replace('<link rel="stylesheet" href="./css/viewer.css">', f'<style>{css}</style>')

# 2. Inline images in FLIPBOOK_DATA
match = re.search(r'window\.FLIPBOOK_DATA\s*=\s*(\{.*?\});</script>', html, re.DOTALL)
if match:
    data_str = match.group(1)
    data = json.loads(data_str)
    
    # Iterate and convert images to base64
    for page in data.get('pages', []):
        # page['src'] might be 'pages/page_0000.jpg'
        img_path = os.path.join(PUBLISHED_DIR, page['src'].replace('/', os.sep))
        if os.path.exists(img_path):
            with open(img_path, 'rb') as img_f:
                b64 = base64.b64encode(img_f.read()).decode('ascii')
                page['src'] = f'data:image/jpeg;base64,{b64}'
                
    new_data_str = json.dumps(data)
    html = html.replace(data_str, new_data_str)

# 3. Inline JS files
js_files = [
    '<script src="./js/page-flip.min.js"></script>',
    '<script src="./js/sounds.js"></script>',
    '<script src="./js/viewer.js"></script>'
]

for tag in js_files:
    # Extract filename from tag
    filename = tag.split('"')[1].split('/')[-1]
    js_path = os.path.join(PUBLISHED_DIR, 'js', filename)
    if os.path.exists(js_path):
        with open(js_path, 'r', encoding='utf-8') as f:
            js_code = f.read()
        
        # Disable service worker for standalone
        if filename == 'viewer.js':
            js_code = js_code.replace('registerSW();', '// registerSW disabled for standalone')
        
        html = html.replace(tag, f'<script>\n{js_code}\n</script>')

# Remove manifest
html = re.sub(r'<link rel="manifest" href="\./manifest\.json">', '', html)

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(html)

size_mb = os.path.getsize(OUT_FILE) / (1024*1024)
print(f"POC created successfully at {OUT_FILE}!")
print(f"File size: {size_mb:.2f} MB")
