"""Offline preview of the composed case art.

Mirrors the layer stack in components/visuals/CaseVisual.tsx so the crate and
featured-skin placement can be eyeballed without booting the dev server.
Development helper only — nothing imports this at runtime.
"""

from __future__ import annotations

import colorsys
import io
import math
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "public" / "assets" / "cases" / "_base"
CACHE = ROOT / "tmp" / "case-art-cache"

GAP = 16
LABEL_H = 28
# Steam art already carries its own angle. Extra CSS rotate clips the hugging img.
SKIN_ROT = 0.0

TIER_GLOW_HUE = {"standard": 174.0, "elite": 275.0, "gold": 45.0}

# High product-shot slot (top 8–14%, height ~45–50%). No lower melee box.
CARD_LAYOUT = {
    "w": 380,
    "h": 304,
    "crate_inset_x": 0.08,
    "crate_bottom": 0.02,
    "crate_h": 0.72,
    "skin": {
        "long": {"left": 0.08, "top": 0.10, "width": 0.84, "height": 0.47},
        "mid": {"left": 0.12, "top": 0.09, "width": 0.76, "height": 0.48},
        "compact": {"left": 0.14, "top": 0.08, "width": 0.72, "height": 0.50},
    },
}

HERO_LAYOUT = {
    "w": 288,
    "h": 288,
    "crate_inset_x": 0.06,
    "crate_bottom": 0.03,
    "crate_h": 0.72,
    "skin": {
        "long": {"left": 0.08, "top": 0.12, "width": 0.84, "height": 0.46},
        "mid": {"left": 0.12, "top": 0.11, "width": 0.76, "height": 0.48},
        "compact": {"left": 0.14, "top": 0.10, "width": 0.72, "height": 0.50},
    },
}

# Genesis (pistol), Apex (knife), Gold Rush (knife), Scope Protocol (AWP).
# name, id, tier, silhouette, accent, accent2, glow, skin_url
CARDS = [
    (
        "Genesis",
        "genesis-case",
        "standard",
        "compact",
        "#67e8f9",
        "#34d399",
        "#d32ce6",
        "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnj9h1Y-s2pZKtuK72fB3aFxP11te99cCW6khUz_TjVyompc3-QOFR2DJQkFOMJtBbqk9LlY-7n5QLZjtkTxCWqhixPv311o7FVIf8eASQ",
    ),
    (
        "Apex Case",
        "apex-protocol",
        "elite",
        "compact",
        "#e879f9",
        "#22d3ee",
        "#e4ae39",
        "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Q7uCvZaZkNM-SA1iSze91u_FsTju_qhAmoT-Jn4bjJC_4Ml93UtZuRLQPsBawkNfiMbnl5AKMiopCnin7iCJBv31j4rkBBKEg-6zUjV3GY6p9v8dpLWT3Fg",
    ),
    (
        "Gold Rush",
        "gold-rush",
        "elite",
        "compact",
        "#facc15",
        "#b45309",
        "#e4ae39",
        "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Z-ua6bbZrLOmsD2avx-9ytd5lRi67gVNwsDvSwtqqc3iXZg4kCZYjReYLtRbum9XgYuvm5wbWjtgUzCn3iSsf8G81tFEeH9rw",
    ),
    (
        "Scope Protocol",
        "scope-protocol",
        "standard",
        "long",
        "#84cc16",
        "#38bdf8",
        "#eb4b4b",
        "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6V-Kf2cGFidxOp_pewnF3nhxEt0sGnSzN76dH3GOg9xC8FyEORftRe-x9PuYurq71bW3d8UnjK-0H0YSTpMGQ",
    ),
]


def hexrgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def hex_hsl(h: str) -> tuple[float, float, float]:
    r, g, b = hexrgb(h)
    hh, s, l = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return hh * 360, s, l


def tint_hex(accent: str, accent2: str, glow: str) -> str:
    def pick(hex_color: str) -> str | None:
        _, s, l = hex_hsl(hex_color)
        return hex_color if s >= 0.18 and 0.16 <= l <= 0.86 else None

    return pick(accent) or pick(accent2) or glow


def hue_delta(src: float, dst: float) -> float:
    return ((dst - src + 540) % 360) - 180


def seed_from_id(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def contain(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    r = min(box_w / img.width, box_h / img.height)
    return img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))), Image.LANCZOS)


def fetch_skin(url: str) -> Image.Image:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = f"{abs(hash(url)) & 0xFFFFFFFF:08x}.png"
    path = CACHE / key
    if path.exists():
        return Image.open(path).convert("RGBA")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=30).read()
    path.write_bytes(data)
    return Image.open(io.BytesIO(data)).convert("RGBA")


def hue_rotate(im: Image.Image, degrees: float, sat_mul: float) -> Image.Image:
    """Approximate CSS hue-rotate. Near-grey metal stays put because sat ≈ 0."""
    if abs(degrees) < 0.2 and abs(sat_mul - 1) < 0.02:
        return im
    src = im.convert("RGBA")
    px = src.load()
    shift = degrees / 360.0
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            h = (h + shift) % 1.0
            s = min(1.0, s * sat_mul)
            rr, gg, bb = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    return src


def color_wash(im: Image.Image, tint: str, opacity: float) -> Image.Image:
    """mix-blend-mode: color — keep crate luminosity, take hue/sat from tint."""
    tr, tg, tb = hexrgb(tint)
    th, ts, _ = colorsys.rgb_to_hls(tr / 255, tg / 255, tb / 255)
    src = im.convert("RGBA")
    px = src.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            _, _, lum = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            nr, ng, nb = colorsys.hls_to_rgb(th, lum, ts)
            px[x, y] = (
                int(r + (nr * 255 - r) * opacity),
                int(g + (ng * 255 - g) * opacity),
                int(b + (nb * 255 - b) * opacity),
                a,
            )
    return src


def tint_crate(im: Image.Image, tier: str, tint: str) -> Image.Image:
    th, ts, _ = hex_hsl(tint)
    delta = hue_delta(TIER_GLOW_HUE[tier], th)
    if tier == "gold":
        delta = max(-22.0, min(22.0, delta))
    sat = 0.92 if ts < 0.22 else (1.06 if tier == "gold" else 1.12)
    shifted = hue_rotate(im, delta, sat)
    opacity = 0.22 if tier == "gold" else 0.38
    return color_wash(shifted, tint, opacity)


def backdrop(crate_id: str, accent: str, accent2: str, glow: str, tint: str, w: int, h: int) -> Image.Image:
    seed = seed_from_id(crate_id)
    rot = (seed % 21) - 10
    kind = seed % 3
    ox = 46 + ((seed >> 2) % 9)
    oy = 4 + ((seed >> 5) % 8)
    img = Image.new("RGB", (w, h), (10, 10, 12))
    px = img.load()
    a, a2, g = hexrgb(tint), hexrgb(accent2), hexrgb(glow)
    for y in range(h):
        for x in range(w):
            base = (18, 18, 24) if y < h / 2 else (10, 10, 12)
            d1 = math.hypot((x - w * ox / 100) / (w * 0.6), (y - h * oy / 100) / (h * 0.44))
            w1 = max(0.0, 1 - d1) * 0.21
            d2 = math.hypot((x - w * (100 - ox) / 100) / (w * 0.44), (y - h * 1.08) / (h * 0.36))
            w2 = max(0.0, 1 - d2) * 0.20
            d3 = math.hypot((x - w / 2) / (w * 0.36), (y - h * 0.44) / (h * 0.27))
            w3 = max(0.0, 1 - d3) * 0.28
            r = base[0] + a[0] * w1 + a2[0] * w2 + g[0] * w3
            gg = base[1] + a[1] * w1 + a2[1] * w2 + g[1] * w3
            b = base[2] + a[2] * w1 + a2[2] * w2 + g[2] * w3
            v = 1 - 0.55 * max(0.0, math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2)) - 0.42)
            px[x, y] = (min(255, int(r * v)), min(255, int(gg * v)), min(255, int(b * v)))

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    if kind == 2:
        for y in range(4, h, 17):
            for x in range(4, w, 17):
                d.ellipse((x, y, x + 2, y + 2), fill=(255, 255, 255, 12))
    else:
        step = 16 if kind == 0 else 18
        ang = math.radians(rot if kind == 0 else 36 + rot)
        ca, sa = math.cos(ang), math.sin(ang)
        diag = int(math.hypot(w, h))
        if kind == 0:
            for t in range(-diag, diag, step):
                d.line([(t * ca, t * sa), (t * ca + -sa * diag, t * sa + ca * diag)], fill=(255, 255, 255, 10), width=1)
            ang2 = ang + math.pi / 2
            ca2, sa2 = math.cos(ang2), math.sin(ang2)
            for t in range(-diag, diag, step):
                d.line(
                    [(t * ca2, t * sa2), (t * ca2 + -sa2 * diag, t * sa2 + ca2 * diag)],
                    fill=(255, 255, 255, 10),
                    width=1,
                )
        else:
            for t in range(-diag, diag, step):
                x0 = w / 2 + t * ca - sa * diag
                y0 = h / 2 + t * sa + ca * diag
                x1 = w / 2 + t * ca + sa * diag
                y1 = h / 2 + t * sa - ca * diag
                d.line([(x0, y0), (x1, y1)], fill=(255, 255, 255, 12), width=1)

    return Image.alpha_composite(img.convert("RGBA"), overlay)


def compose(name, crate_id, tier, shape, accent, accent2, glow, skin_url, layout) -> tuple[Image.Image, tuple[int, int, int, int]]:
    w, h = layout["w"], layout["h"]
    tint = tint_hex(accent, accent2, glow)
    card = backdrop(crate_id, accent, accent2, glow, tint, w, h)

    crate = Image.open(BASE / f"crate-{tier}.png").convert("RGBA")
    crate = tint_crate(crate, tier, tint)
    box_w = int(w * (1 - 2 * layout["crate_inset_x"]))
    box_h = int(h * layout["crate_h"])
    crate = contain(crate, box_w, box_h)
    crate_x = (w - crate.width) // 2
    crate_y = int(h * (1 - layout["crate_bottom"])) - crate.height
    shadow = crate.split()[-1].filter(ImageFilter.GaussianBlur(8))
    shade = Image.new("RGBA", crate.size, (0, 0, 0, 140))
    shade.putalpha(shadow)
    card.alpha_composite(shade, (crate_x, crate_y + 8))
    card.alpha_composite(crate, (crate_x, crate_y))

    skin = fetch_skin(skin_url)
    box = layout["skin"][shape]
    sw, sh = int(w * box["width"]), int(h * box["height"])
    sx, sy = int(w * box["left"]), int(h * box["top"])
    fitted = contain(skin, sw, sh)
    rotated = fitted.rotate(SKIN_ROT, expand=True, resample=Image.BICUBIC)
    cx = sx + sw // 2
    cy = sy + sh // 2
    px = cx - rotated.width // 2
    py = cy - rotated.height // 2
    card.alpha_composite(rotated, (px, py))
    return card, (px, py, px + rotated.width, py + rotated.height)


def clip_report(bbox, name, w, h) -> str:
    x0, y0, x1, y1 = bbox
    flags = []
    if x0 < 0:
        flags.append(f"left {x0}")
    if y0 < 0:
        flags.append(f"top {y0}")
    if x1 > w:
        flags.append(f"right {x1 - w}")
    if y1 > h:
        flags.append(f"bottom {y1 - h}")
    return f"{name}: CLIP {' '.join(flags)}" if flags else f"{name}: fits  skin-aabb=({x0},{y0})-({x1},{y1})"


def paste_row(sheet, items, layout, origin_y, font, prefix):
    w, h = layout["w"], layout["h"]
    draw = ImageDraw.Draw(sheet)
    for i, card in enumerate(items):
        composed, bbox = compose(*card, layout)
        x = GAP + i * (w + GAP)
        y = origin_y
        sheet.alpha_composite(composed, (x, y))
        draw.text((x + 4, y + h + 6), f"{prefix}{card[0]}  ·  {card[2]}  ·  {card[3]}", fill=(210, 210, 220, 255), font=font)
        print(prefix + clip_report(bbox, card[0], w, h))
    return origin_y + h + LABEL_H + GAP


if __name__ == "__main__":
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()

    n = len(CARDS)
    hw, hh = HERO_LAYOUT["w"], HERO_LAYOUT["h"]
    cw, ch = CARD_LAYOUT["w"], CARD_LAYOUT["h"]
    sheet_w = max(n * hw + GAP * (n + 1), n * cw + GAP * (n + 1))
    sheet_h = GAP + (hh + LABEL_H + GAP) + (ch + LABEL_H + GAP)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (18, 18, 22, 255))

    y = GAP
    paste_row(sheet, CARDS, HERO_LAYOUT, y, font, "hero ")
    y += hh + LABEL_H + GAP
    paste_row(sheet, CARDS, CARD_LAYOUT, y, font, "card ")

    out = ROOT / "case-art-preview.png"
    sheet.convert("RGB").save(out, quality=95)
    print("wrote", out)
