"""
generate_icons.py — SaveSocial App Icon & Splash Generator
Generates Android mipmap icons in all required densities and splash images.
"""

from PIL import Image, ImageDraw
import os

def draw_icon(size):
    """Draw the SaveSocial icon with emerald green rounded background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(size * 0.22)
    # Emerald green gradient base
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=(16, 185, 129, 255))

    # Inner subtle glow
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([2, 2, size - 3, int(size * 0.55)], radius=radius, fill=(52, 211, 153, 90))
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    cx = size / 2
    sw = max(2, int(size * 0.08))

    # Arrow shaft
    draw.line([(cx, size * 0.24), (cx, size * 0.56)], fill=(2, 32, 22, 255), width=sw)

    # Arrow head
    aw = size * 0.18
    draw.polygon([
        (cx - aw, size * 0.50),
        (cx,      size * 0.68),
        (cx + aw, size * 0.50),
    ], fill=(2, 32, 22, 255))

    # Bottom tray/line
    bw = size * 0.26
    draw.line([(cx - bw, size * 0.78), (cx + bw, size * 0.78)], fill=(2, 32, 22, 255), width=sw)

    return img

def draw_foreground(size):
    """Draw adaptive icon foreground with transparent background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = size / 2
    cy = size / 2
    r = int(size * 0.30)

    # Emerald circle
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(16, 185, 129, 255), outline=(52, 211, 153, 255), width=max(1, int(size * 0.02)))

    # White/dark icon inside circle
    sw = max(2, int(size * 0.055))
    draw.line([(cx, cy - r * 0.50), (cx, cy + r * 0.18)], fill=(2, 32, 22, 255), width=sw)

    aw = r * 0.45
    draw.polygon([
        (cx - aw, cy + r * 0.05),
        (cx,      cy + r * 0.45),
        (cx + aw, cy + r * 0.05),
    ], fill=(2, 32, 22, 255))

    bw = r * 0.60
    draw.line([(cx - bw, cy + r * 0.65), (cx + bw, cy + r * 0.65)], fill=(2, 32, 22, 255), width=sw)

    return img

def draw_splash(w, h):
    """Generate dark splash screen with centered SaveSocial icon."""
    img = Image.new("RGBA", (w, h), (6, 17, 14, 255))
    icon_size = min(w, h) // 4
    icon = draw_icon(icon_size)
    x = (w - icon_size) // 2
    y = (h - icon_size) // 2
    img.paste(icon, (x, y), icon)
    return img

DENSITIES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

BASE = os.path.join(os.path.dirname(__file__), "android", "app", "src", "main", "res")

for density, size in DENSITIES.items():
    out_dir = os.path.join(BASE, density)
    os.makedirs(out_dir, exist_ok=True)

    icon = draw_icon(size)
    icon.save(os.path.join(out_dir, "ic_launcher.png"))

    round_icon = draw_icon(size)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([0, 0, size - 1, size - 1], fill=255)
    round_icon.putalpha(mask)
    round_icon.save(os.path.join(out_dir, "ic_launcher_round.png"))

    fg = draw_foreground(size)
    fg.save(os.path.join(out_dir, "ic_launcher_foreground.png"))

    print(f"Generated {density} ({size}px)")

# Splash screens in drawable folders
SPLASH_SIZES = {
    "drawable": (480, 800),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (1080, 1920),
    "drawable-port-xxxhdpi": (1440, 2560),
}

for folder, (w, h) in SPLASH_SIZES.items():
    sdir = os.path.join(BASE, folder)
    os.makedirs(sdir, exist_ok=True)
    splash = draw_splash(w, h)
    splash.save(os.path.join(sdir, "splash.png"))
    print(f"Generated splash in {folder} ({w}x{h})")

store_icon = draw_icon(1024)
store_icon.save(os.path.join(os.path.dirname(__file__), "store_icon_1024.png"))
print("Generated store_icon_1024.png")
print("\nSaveSocial assets successfully generated!")
