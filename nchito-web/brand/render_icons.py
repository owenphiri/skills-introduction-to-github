"""
Rasterises the Nchito mark to PNG at the sizes a PWA needs.

No rasteriser is installed here, and the mark is deliberately built from four
straight shapes, so drawing it directly is both possible and exact. Supersampled
4x4 for clean edges at small sizes, which is where an icon is usually judged.
"""
import struct, zlib

GREEN  = (0x0E, 0x7A, 0x18)
COPPER = (0xF0, 0x8A, 0x1D)
WHITE  = (0xFF, 0xFF, 0xFF)
SS = 4                      # supersampling factor

def in_rounded_rect(x, y, rx, ry, w, h, r):
    if not (rx <= x <= rx + w and ry <= y <= ry + h):
        return False
    for cx, cy in ((rx + r, ry + r), (rx + w - r, ry + r),
                   (rx + r, ry + h - r), (rx + w - r, ry + h - r)):
        # Only the corner quadrants need the circle test.
        if ((x < rx + r) == (cx == rx + r)) and ((y < ry + r) == (cy == ry + r)):
            if (x < rx + r or x > rx + w - r) and (y < ry + r or y > ry + h - r):
                return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    return True

def in_polygon(x, y, pts):
    inside = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xint = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < xint:
                inside = not inside
    return inside

def sample(x, y, tile):
    """Colour at a point in the 64-unit design space, or None for transparent."""
    # copper rise above the line — square, so it joins the stem seamlessly
    if 40 <= x <= 49 and 10 <= y <= 23: return COPPER
    # the N: square joins, so stems and diagonal meet without notches
    if 15 <= x <= 24 and 21 <= y <= 51: return WHITE if tile else GREEN
    if 40 <= x <= 49 and 21 <= y <= 51: return WHITE if tile else GREEN
    if in_polygon(x, y, [(15, 21), (24, 21), (49, 51), (40, 51)]):
        return WHITE if tile else GREEN
    # background tile
    if tile and in_rounded_rect(x, y, 0, 0, 64, 64, 15): return GREEN
    return None

def render(size, tile=True, bg=None):
    """Returns RGBA bytes, size x size."""
    px = bytearray()
    scale = 64.0 / size
    for py in range(size):
        px.append(0)                                  # PNG filter: none
        for pxx in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    dx = (pxx + (sx + 0.5) / SS) * scale
                    dy = (py + (sy + 0.5) / SS) * scale
                    c = sample(dx, dy, tile) or bg
                    if c:
                        r += c[0]; g += c[1]; b += c[2]; a += 255
            n = SS * SS
            if a:
                # Average only over covered samples so edges don't darken.
                covered = a / 255
                px.extend([int(r / covered), int(g / covered), int(b / covered), int(a / n)])
            else:
                px.extend([0, 0, 0, 0])
    return bytes(px)

def to_rgb(raw, size):
    """Strips the alpha channel, compositing onto the brand green."""
    out = bytearray()
    i = 0
    for _ in range(size):
        out.append(raw[i]); i += 1              # filter byte
        for _ in range(size):
            r, g, b, a = raw[i], raw[i+1], raw[i+2], raw[i+3]; i += 4
            if a == 255:
                out.extend([r, g, b])
            else:
                f = a / 255
                out.extend([int(r * f + GREEN[0] * (1 - f)),
                            int(g * f + GREEN[1] * (1 - f)),
                            int(b * f + GREEN[2] * (1 - f))])
    return bytes(out)


def write_png(path, size, raw, rgb=False):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    # Colour type 6 is RGBA, 2 is RGB. Apple requires no alpha on the icon.
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2 if rgb else 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)

import os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "."

def emit(path, size, rgb=False, **kw):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full) or ".", exist_ok=True)
    raw = render(size, **kw)
    write_png(full, size, to_rgb(raw, size) if rgb else raw, rgb=rgb)
    print(f"  {path}  ({size}x{size}{', no alpha' if rgb else ''})")

# --- Web / PWA -------------------------------------------------------------
for size in (16, 32, 180, 192, 512):
    # An opaque tile: iOS puts no background behind apple-touch-icon.
    emit(f"icon-{size}.png", size, tile=True)

# Maskable: Android crops to a circle, so the mark sits inside the safe area.
def render_maskable(size):
    px = bytearray()
    scale = 64.0 / size
    inset = 0.72          # mark occupies the middle ~72%, per the maskable spec
    for py in range(size):
        px.append(0)
        for pxx in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    dx = (pxx + (sx + 0.5) / SS) * scale
                    dy = (py + (sy + 0.5) / SS) * scale
                    c = sample((dx - 32) / inset + 32, (dy - 32) / inset + 32,
                               tile=False) or GREEN
                    r += c[0]; g += c[1]; b += c[2]; a += 255
            n = SS * SS
            px.extend([int(r / n), int(g / n), int(b / n), int(a / n)])
    return bytes(px)

write_png(os.path.join(OUT, "icon-maskable-512.png"), 512, render_maskable(512))
print("  icon-maskable-512.png  (512x512)")

# --- iOS -------------------------------------------------------------------
# Xcode 14+ takes a single 1024 marketing icon and derives the rest. It must be
# fully opaque with no alpha, or App Store Connect rejects the upload.
ios = "ios/AppIcon.appiconset"
emit(f"{ios}/icon-1024.png", 1024, rgb=True, tile=True)
os.makedirs(os.path.join(OUT, ios), exist_ok=True)
open(os.path.join(OUT, ios, "Contents.json"), "w").write("""{
  "images" : [
    {
      "filename" : "icon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
""")
print("  ios/AppIcon.appiconset/Contents.json")

# --- Android ---------------------------------------------------------------
# Legacy launcher bitmaps for pre-API-26 devices, at the five density buckets.
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for bucket, size in DENSITIES.items():
    emit(f"android/mipmap-{bucket}/ic_launcher.png", size, tile=True)
    # The round variant is what launchers use on circular-icon devices.
    emit(f"android/mipmap-{bucket}/ic_launcher_round.png", size, tile=True)

# Adaptive-icon foreground. Android crops the outer ~28%, so the mark is inset
# and the layer is transparent — the background layer supplies the colour.
for bucket, size in DENSITIES.items():
    full = os.path.join(OUT, f"android/mipmap-{bucket}/ic_launcher_foreground.png")
    os.makedirs(os.path.dirname(full), exist_ok=True)
    fg = int(size * 108 / 48)          # adaptive icons are authored at 108dp
    px = bytearray()
    scale = 64.0 / fg
    inset = 0.62                        # leaves the 28% Android may crop
    for py in range(fg):
        px.append(0)
        for pxx in range(fg):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    dx = (pxx + (sx + 0.5) / SS) * scale
                    dy = (py + (sy + 0.5) / SS) * scale
                    c = sample((dx - 32) / inset + 32, (dy - 32) / inset + 32, tile=False)
                    if c:
                        r += c[0]; g += c[1]; b += c[2]; a += 255
            n = SS * SS
            if a:
                cov = a / 255
                px.extend([int(r / cov), int(g / cov), int(b / cov), int(a / n)])
            else:
                px.extend([0, 0, 0, 0])
    write_png(full, fg, bytes(px))
    print(f"  android/mipmap-{bucket}/ic_launcher_foreground.png  ({fg}x{fg})")

# --- Play Store ------------------------------------------------------------
emit("store/play-icon-512.png", 512, rgb=True, tile=True)
