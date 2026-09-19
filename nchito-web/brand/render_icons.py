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

def write_png(path, size, raw):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)

for size in (16, 32, 180, 192, 512):
    # apple-touch-icon must be opaque: iOS puts no background behind it.
    write_png(f"icon-{size}.png", size, render(size, tile=True))
    print(f"  icon-{size}.png")

# Maskable icon: Android crops to a circle, so the mark sits inside the safe area.
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
                    mx = (dx - 32) / inset + 32
                    my = (dy - 32) / inset + 32
                    c = sample(mx, my, tile=False) or GREEN
                    r += c[0]; g += c[1]; b += c[2]; a += 255
            n = SS * SS
            px.extend([int(r / n), int(g / n), int(b / n), int(a / n)])
    return bytes(px)

write_png("icon-maskable-512.png", 512, render_maskable(512))
print("  icon-maskable-512.png")
