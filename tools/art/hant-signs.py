"""Repaint simplified characters on painted signboards with their traditional forms.

Gemini edits can't be trusted to change only the lettering (they keep the simplified glyph and shift the whole
picture), so the background is generated with whatever it paints and the changed glyphs are redrawn here.

    python3 tools/art/hant-signs.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / "assets/fonts-src/LXGWWenKai-Regular.ttf"
SS = 4
STROKE = 4

# Whole signs are redrawn in one hand so new and old glyphs match.
# box: the old glyph's bounding box in the 1x background; angle: board tilt in degrees (clockwise).
JOBS = []


def board_colour(im: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    x0, y0, x1, y1 = box
    ring = [im.getpixel((x, y)) for x in range(x0 - 3, x1 + 3) for y in (y0 - 3, y1 + 2)]
    ring += [im.getpixel((x, y)) for y in range(y0, y1) for x in (x0 - 3, x1 + 2)]
    ring = [p for p in ring if sum(p[:3]) > 300]  # skip ink
    ring.sort(key=lambda p: sum(p[:3]))
    return ring[len(ring) // 2][:3]


def repaint(job: dict) -> None:
    im = Image.open(ROOT / job["src"]).convert("RGB")
    for g in job["glyphs"]:
        x0, y0, x1, y1 = g["box"]
        bg = board_colour(im, g["box"])
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).rectangle(g["box"], fill=255)
        im.paste(Image.new("RGB", im.size, bg), mask=mask.filter(ImageFilter.GaussianBlur(1)))
        # Draw at SS x and downsample: a sub-pixel stroke matches the painted brush weight without blur.
        n = g["size"] * SS
        font = ImageFont.truetype(str(FONT), n)
        tile = Image.new("L", (n * 2, n * 2), 0)
        ImageDraw.Draw(tile).text((n, n), g["char"], font=font, fill=255, anchor="mm", stroke_width=STROKE, stroke_fill=255)
        tile = tile.rotate(-g["angle"], resample=Image.BICUBIC).resize((g["size"] * 2, g["size"] * 2), Image.LANCZOS)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        im.paste(Image.new("RGB", tile.size, (24, 18, 14)), (cx - g["size"], cy - g["size"]), tile)
    im.save(ROOT / job["out"])
    print("wrote", job["out"])


for j in JOBS:
    repaint(j)
