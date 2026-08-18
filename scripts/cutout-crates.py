"""Strip the baked light background from generated crate art.

The image generator returns RGB (no alpha) with a near-white backdrop. The crates
themselves are dark, so a flood fill from the borders removes the backdrop without
eating into the artwork. The mask is blurred by a sub-pixel radius afterwards so
the cutout keeps a soft anti-aliased edge instead of a hard jagged one.
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

BASE = Path(__file__).resolve().parent.parent / "public" / "assets" / "cases" / "_base"
# A pixel counts as backdrop when every channel is at least this bright.
BACKDROP_MIN = 224


def cutout(path: Path) -> None:
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()

    keep = bytearray([255]) * (w * h)  # 255 = opaque artwork, 0 = removed backdrop
    seen = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    def is_backdrop(x: int, y: int) -> bool:
        r, g, b = px[x, y]
        return r >= BACKDROP_MIN and g >= BACKDROP_MIN and b >= BACKDROP_MIN

    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and is_backdrop(x, y):
                seen[y * w + x] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and is_backdrop(x, y):
                seen[y * w + x] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        keep[y * w + x] = 0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not seen[i] and is_backdrop(nx, ny):
                    seen[i] = 1
                    queue.append((nx, ny))

    alpha = Image.frombytes("L", (w, h), bytes(keep)).filter(ImageFilter.GaussianBlur(0.7))
    img.putalpha(alpha)

    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        img = img.crop(bbox)

    img.save(path)
    removed = keep.count(0) * 100 // (w * h)
    print(f"{path.name}: removed {removed}% backdrop, cropped to {img.size}")


if __name__ == "__main__":
    for name in ("crate-standard.png", "crate-gold.png", "crate-elite.png"):
        cutout(BASE / name)
