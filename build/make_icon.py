from PIL import Image, ImageDraw

BG   = (27, 29, 33, 255)      # #1b1d21 — тёмный фон, как в приложении
BLUE = (76, 141, 255, 255)    # #4c8dff — фирменный синий (--accent)

def make_icon(size):
    # Рисуем при 8-кратном разрешении, потом сжимаем — так края гладкие
    SS = size * 8
    img = Image.new('RGBA', (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Скруглённый квадрат — фон
    radius = int(SS * 0.20)
    d.rounded_rectangle([0, 0, SS - 1, SS - 1], radius=radius, fill=BG)

    # Ромб — контур
    cx, cy = SS / 2, SS / 2
    r = SS * 0.30
    t = max(1, int(SS * 0.075))
    pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy), (cx, cy - r)]
    d.line(pts, fill=BLUE, width=t, joint='curve')

    return img.resize((size, size), Image.LANCZOS)

sizes = [256, 128, 64, 48, 32, 24, 16]
base = make_icon(256)
base.save('icon.ico', format='ICO', sizes=[(s, s) for s in sizes])

# Заодно сохраним PNG 256 — пригодится для README, магазинов и т.п.
make_icon(256).save('icon.png', format='PNG')
print('Готово: icon.ico + icon.png')