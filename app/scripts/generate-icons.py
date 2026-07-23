"""Generate the PWA icon set and favicon.

Run from the app directory:  python scripts/generate-icons.py

The mark is a rounded square in the brand blue carrying "ER" in heavy weight,
with a small status dot. It has to stay legible at 48px on a home screen, so
there is no fine detail and contrast is deliberately extreme.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BRAND = (2, 132, 199)      # brand-600
BRAND_DARK = (3, 105, 161)  # brand-700
ACCENT = (52, 211, 153)     # the "you have a faster option" green
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    """Find a heavy sans face, falling back through common platform paths."""
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def rounded_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Maskable icons get cropped to a circle by Android, so the artwork must sit
    # inside the safe zone (the middle 80%) and the background must bleed edge
    # to edge.
    if maskable:
        draw.rectangle([0, 0, size, size], fill=BRAND)
        inset = size * 0.1
        content = size - inset * 2
    else:
        radius = int(size * 0.22)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BRAND)
        inset = size * 0.06
        content = size - inset * 2

    # "ER" sits slightly above centre, leaving room for the status bar beneath.
    font = load_font(int(content * 0.46))
    text = "ER"
    box = draw.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    draw.text(
        ((size - tw) / 2 - box[0], (size - th) / 2 - box[1] - size * 0.07),
        text,
        font=font,
        fill=WHITE,
    )

    # A short bar that reads as "wait time", with the green cap marking the
    # fast option — the whole product in one glyph.
    bar_h = max(2, int(size * 0.055))
    bar_w = content * 0.52
    bar_x = (size - bar_w) / 2
    bar_y = size * 0.70
    draw.rounded_rectangle(
        [bar_x, bar_y, bar_x + bar_w, bar_y + bar_h],
        radius=bar_h / 2,
        fill=BRAND_DARK,
    )
    draw.rounded_rectangle(
        [bar_x, bar_y, bar_x + bar_w * 0.34, bar_y + bar_h],
        radius=bar_h / 2,
        fill=ACCENT,
    )

    return img


def main() -> None:
    written = []

    for size in (48, 72, 96, 128, 144, 152, 192, 256, 384, 512):
        path = OUT / f"icon-{size}.png"
        rounded_icon(size).save(path, "PNG", optimize=True)
        written.append(path.name)

    for size in (192, 512):
        path = OUT / f"maskable-{size}.png"
        rounded_icon(size, maskable=True).save(path, "PNG", optimize=True)
        written.append(path.name)

    # iOS home-screen icon must be square with no transparency.
    apple = Image.new("RGB", (180, 180), BRAND)
    apple.paste(rounded_icon(180).convert("RGB"), (0, 0))
    apple.save(OUT / "apple-touch-icon.png", "PNG", optimize=True)
    written.append("apple-touch-icon.png")

    favicon = OUT.parent / "favicon.ico"
    rounded_icon(64).save(
        favicon, "ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    written.append("favicon.ico")

    print(f"Wrote {len(written)} files to {OUT}")
    for name in written:
        print(f"  {name}")


if __name__ == "__main__":
    main()
