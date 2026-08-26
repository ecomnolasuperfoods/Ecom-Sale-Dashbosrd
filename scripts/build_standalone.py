"""รวมแดชบอร์ดทั้งหมดเป็นไฟล์ HTML ไฟล์เดียว เปิดได้โดยไม่ต้องมี server

วิธีใช้:
    python3 scripts/build_standalone.py

ผลลัพธ์: dist/nola-dashboard.html
"""
import os, json, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda *p: open(os.path.join(ROOT, *p), encoding='utf-8').read()

html = read('index.html')
css = read('assets', 'styles.css')
app = read('assets', 'app.js')
chart = read('assets', 'chart.umd.js')
data = read('data', 'data.json')

# ให้ app.js อ่านข้อมูลจากตัวแปรในหน้าเว็บแทนการ fetch
app = app.replace(
    "fetch('data/data.json', { cache: 'no-cache' })\n    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })",
    "Promise.resolve(window.__NOLA_DATA__)"
)

html = html.replace('<link rel="stylesheet" href="assets/styles.css">',
                    '<style>\n' + css + '\n</style>')
html = html.replace('<script src="assets/chart.umd.js"></script>',
                    '<script>\n' + chart + '\n</script>')
html = html.replace('<script src="assets/app.js"></script>',
                    '<script>window.__NOLA_DATA__ = ' + data + ';</script>\n<script>\n' + app + '\n</script>')

assert 'assets/' not in html, 'ยังมีลิงก์ไปยังไฟล์ภายนอกหลงเหลืออยู่'

out_dir = os.path.join(ROOT, 'dist')
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'nola-dashboard.html')
open(out, 'w', encoding='utf-8').write(html)
print('เขียน:', out, os.path.getsize(out), 'bytes')
