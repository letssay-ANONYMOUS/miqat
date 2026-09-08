#!/usr/bin/env python3
"""
Turn the source artwork into icons the platforms can mask.

The artwork arrives on a cream page with its own rounded corners. Both iOS and
Android apply their own mask, so those corners end up as a pale halo around a
dark icon — the giveaway of an icon that was never prepared for a home screen.

Cropping cannot fix it: the cream lies outside a curve, so any square crop keeps
some of it. Instead the cream is flood-filled from the four corners, which only
ever touches the connected outer background and can never reach the artwork.

    python3 scripts/make-icons.py

Pure standard library — no ImageMagick, no Pillow.
"""

import struct
import zlib
from collections import deque
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
PUBLIC = HERE / "public"
SOURCE = PUBLIC / "icon-512.png"

# Sampled from the flat field just inside the border.
FIELD = (12, 32, 74)
# How far a pixel may sit from the corner colour and still count as background.
TOLERANCE = 105


def read_png(path):
    data = path.read_bytes()
    pos, idat, width, height, colour = 8, b"", None, None, None
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        if kind == b"IHDR":
            width, height, depth, colour = struct.unpack(">IIBB", data[pos + 8 : pos + 18])
            if depth != 8 or colour not in (2, 6):
                raise SystemExit(f"unsupported PNG: depth {depth}, colour type {colour}")
        elif kind == b"IDAT":
            idat += data[pos + 8 : pos + 8 + length]
        pos += 12 + length

    channels = 4 if colour == 6 else 3
    raw = zlib.decompress(idat)
    stride = width * channels + 1
    rows, previous = [], bytearray(width * channels)

    for y in range(height):
        filter_type = raw[y * stride]
        line = bytearray(raw[y * stride + 1 : (y + 1) * stride])
        for i in range(len(line)):
            left = line[i - channels] if i >= channels else 0
            up = previous[i]
            up_left = previous[i - channels] if i >= channels else 0
            if filter_type == 1:
                line[i] = (line[i] + left) & 255
            elif filter_type == 2:
                line[i] = (line[i] + up) & 255
            elif filter_type == 3:
                line[i] = (line[i] + (left + up) // 2) & 255
            elif filter_type == 4:
                estimate = left + up - up_left
                da, db, dc = (
                    abs(estimate - left),
                    abs(estimate - up),
                    abs(estimate - up_left),
                )
                nearest = left if (da <= db and da <= dc) else (up if db <= dc else up_left)
                line[i] = (line[i] + nearest) & 255
        rows.append(line)
        previous = line

    return width, height, channels, rows


def write_png(path, width, height, channels, rows):
    raw = b"".join(b"\x00" + bytes(row) for row in rows)
    colour = 6 if channels == 4 else 2

    def chunk(kind, payload):
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
        )

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, colour, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def flood_fill_background(width, height, channels, rows, fill):
    """Replace the connected outer background, starting from each corner."""
    seeds = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    reference = tuple(rows[0][0:3])
    seen = bytearray(width * height)
    queue = deque(seeds)
    filled = 0

    while queue:
        x, y = queue.popleft()
        if not (0 <= x < width and 0 <= y < height):
            continue
        index = y * width + x
        if seen[index]:
            continue
        offset = x * channels
        pixel = rows[y][offset : offset + 3]
        distance = sum(abs(pixel[i] - reference[i]) for i in range(3))
        if distance > TOLERANCE:
            continue

        seen[index] = 1
        rows[y][offset : offset + 3] = bytes(fill)
        filled += 1
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    return filled


def resize(width, height, channels, rows, size):
    """Nearest-neighbour is enough: we only ever scale down from 512."""
    out = []
    for y in range(size):
        src_y = min(height - 1, y * height // size)
        line = bytearray(size * channels)
        source = rows[src_y]
        for x in range(size):
            src_x = min(width - 1, x * width // size)
            line[x * channels : (x + 1) * channels] = source[
                src_x * channels : (src_x + 1) * channels
            ]
        out.append(line)
    return out


def main():
    width, height, channels, rows = read_png(SOURCE)
    filled = flood_fill_background(width, height, channels, rows, FIELD)
    share = filled / (width * height)
    print(f"filled {filled} background pixels ({share:.1%} of the icon)")
    if share > 0.35:
        raise SystemExit("refusing to write: the fill spread into the artwork")

    targets = {
        "icon-512.png": 512,
        "icon-192.png": 192,
        "apple-touch-icon.png": 180,
        "apple-touch-icon-180x180.png": 180,
        "apple-touch-icon-180x180-precomposed.png": 180,
        "apple-touch-icon-precomposed.png": 180,
        "apple-touch-icon-167x167.png": 167,
        "apple-touch-icon-152x152.png": 152,
        "apple-touch-icon-120x120.png": 120,
        "favicon-32.png": 32,
    }
    for name, size in targets.items():
        scaled = rows if size == width else resize(width, height, channels, rows, size)
        write_png(PUBLIC / name, size, size, channels, scaled)
        print(f"  wrote {name} at {size}px")


if __name__ == "__main__":
    main()
