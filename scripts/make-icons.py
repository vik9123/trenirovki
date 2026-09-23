"""Иконки PWA: гантель цвета акцента на тёмном фоне. Запуск: python scripts/make-icons.py"""
from PIL import Image, ImageDraw

BG = (14, 16, 18)
ACCENT = (255, 176, 32)


def dumbbell(size: int, scale: float, rounded: bool) -> Image.Image:
    s = 4  # суперсэмплинг для гладких краёв
    n = size * s
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, n, n], fill=BG)
    c = n / 2
    u = n * scale / 100  # единица рисунка

    def r(x0, y0, x1, y1, rad):
        d.rounded_rectangle([c + x0 * u, c + y0 * u, c + x1 * u, c + y1 * u], radius=rad * u, fill=ACCENT)

    r(-26, -3.5, 26, 3.5, 2)      # гриф
    r(-24, -18, -15, 18, 3)       # внутренние блины
    r(15, -18, 24, 18, 3)
    r(-33, -12, -25, 12, 3)       # внешние блины
    r(25, -12, 33, 12, 3)
    return img.resize((size, size), Image.LANCZOS)


dumbbell(512, 1.0, True).save('public/icon-512.png')
dumbbell(192, 1.0, True).save('public/icon-192.png')
dumbbell(512, 0.8, False).save('public/icon-maskable-512.png')
dumbbell(180, 0.9, False).convert('RGB').save('public/apple-touch-icon.png')
dumbbell(64, 1.0, True).save('public/favicon.png')
print('ok')
