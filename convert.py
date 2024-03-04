import base64

with open('src/index.html') as f:
    html = f.read()

with open('src/main.css') as f:
    css = f.read()

with open('src/rtop.js') as f:
    js = f.read()

html = html.replace('<link rel="stylesheet" href="main.css"></link>', '<style>' + css + '</style>')
html = html.replace('<script src="rtop.js"></script>', '<script>' + js + '</script>')

b64_bytes = base64.b64encode(html.encode('utf-8'))
data_url = 'data:text/html;base64,' + b64_bytes.decode('utf-8')

with open('data-url', 'w') as f:
    f.write(data_url)
