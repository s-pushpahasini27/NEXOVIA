"""Create a standalone, anonymous landing-page preview from the built frontend."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
dist = root / 'frontend' / 'dist'
css = next((dist / 'assets').glob('*.css')).read_text(encoding='utf-8')
js = next((dist / 'assets').glob('*.js')).read_text(encoding='utf-8')
output = root.parents[1] / 'release' / 'NEXOVIA-Liquid-Film-Preview.html'
output.parent.mkdir(parents=True, exist_ok=True)
session = '''<script>
const originalFetch = window.fetch.bind(window);
window.fetch = (input, options) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === '/api/auth/session') return Promise.resolve(new Response(JSON.stringify({user:null,googleEnabled:false}), {status:200,headers:{'Content-Type':'application/json'}}));
  return originalFetch(input, options);
};
</script>'''
html = f'''<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nexovia · Liquid Film preview</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet"><style>{css.replace('</style', '<\\/style')}</style></head><body><div id="root"></div>{session}<script type="module">{js.replace('</script', '<\\/script')}</script></body></html>'''
output.write_text(html, encoding='utf-8')
assert 'LiquidFilm' in js and 'liquid-environment' in html
print(output)
