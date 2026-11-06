#!/usr/bin/env python3
"""Generate README image assets for dsh-data-quality (docs/assets/).

Outputs (idempotent overwrite):
  dsh-data-quality-flow-light.svg / dsh-data-quality-flow-dark.svg
      Hero pipeline diagram. Two hand-written SVG files (vector — never
      rasterized to webp). Text inside is command-surface tokens only
      (data_profile, data_clean, data_verify, ctx.dataQuality, ...), so all
      five README languages share the same pair.
  dsh-data-quality-evidence-{zh,en}-{light,dark}.webp
      Six-dimension DAMA scorecard bar chart, data quoted verbatim from the
      measured run recorded in docs/assets/dsh-data-quality-evidence.png
      (repo's own engine over fixtures/dirty-fund-holdings.csv). Chinese
      needs an explicit CJK font — probed below; the script aborts loudly
      when none is found.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow (pip install pillow)
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

# --- palette: PerryLink family (accent) + GitHub page backgrounds ----------
FAMILY = "#4B67B4"   # family accent (badges labelColor family uses #2B3245)
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
ORANGE = {"light": "#bc4c00", "dark": "#d29922"}
SKIN = {
    "light": dict(bg="#ffffff", box="#f6f8fa", border="#d0d7de",
                  text="#1f2328", sub="#57606a", track="#eaeef2"),
    "dark": dict(bg="#0d1117", box="#161b22", border="#30363d",
                 text="#f0f6fc", sub="#8b949e", track="#21262d"),
}

# --- CJK font probe: Chinese must never render as tofu boxes ----------------
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",      # Microsoft YaHei
    r"C:\Windows\Fonts\simhei.ttf",    # SimHei
    r"C:\Windows\Fonts\Deng.ttf",      # DengXian
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
]
FONT_PATH = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
if FONT_PATH is None:
    sys.exit("FATAL: no CJK font found (looked for msyh.ttc, simhei.ttf, "
             "Deng.ttf, Noto Sans CJK, PingFang). Refusing to render Chinese "
             "as tofu boxes; install one of the probed fonts and re-run.")


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


# ---------------------------------------------------------------------------
# 1. Hero pipeline SVG (light + dark)
# ---------------------------------------------------------------------------
FLOW_NODES = [
    ("holdings.csv", "maxRows · maxFileSizeMB"),
    ("data_profile", "types · missing · dupes"),
    ("data_clean", "rules[] · outputPath"),
    ("data_verify", "rules[] · expectations"),
    ("data_quality", "reportKey"),
]


def flow_svg(skin: str) -> str:
    s = SKIN[skin]
    w, h = 1200, 400
    nw, nh, gap = 180, 96, 45
    y0 = 150
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}" role="img" aria-label="dsh-data-quality pipeline">',
        f'<title>dsh-data-quality pipeline</title>',
        f'<rect width="{w}" height="{h}" rx="18" fill="{s["bg"]}"/>',
        f'<text x="60" y="62" fill="{s["text"]}" font-family="ui-sans-serif,'
        f'system-ui,sans-serif" font-size="30" font-weight="700">dsh-data-quality</text>',
        f'<text x="60" y="94" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="16">data_profile · data_clean · data_verify · '
        f'data_report</text>',
        f'<line x1="60" y1="116" x2="1140" y2="116" stroke="{s["border"]}"/>',
    ]
    for i, (label, sub) in enumerate(FLOW_NODES):
        x = 60 + i * (nw + gap)
        accent = GREEN[skin] if i == len(FLOW_NODES) - 1 else (
            FAMILY if i in (1, 2, 3) else s["border"])
        parts.append(
            f'<rect x="{x}" y="{y0}" width="{nw}" height="{nh}" rx="14" '
            f'fill="{s["box"]}" stroke="{accent}" stroke-width="2"/>')
        parts.append(
            f'<text x="{x + nw // 2}" y="{y0 + 40}" fill="{s["text"]}" '
            f'text-anchor="middle" font-family="ui-monospace,monospace" '
            f'font-size="16" font-weight="700">{label}</text>')
        parts.append(
            f'<text x="{x + nw // 2}" y="{y0 + 68}" fill="{s["sub"]}" '
            f'text-anchor="middle" font-family="ui-monospace,monospace" '
            f'font-size="11">{sub}</text>')
        if i < len(FLOW_NODES) - 1:
            ax = x + nw + 6
            ay = y0 + nh // 2
            parts.append(
                f'<path d="M{ax} {ay}h{gap - 12}" stroke="{s["sub"]}" '
                f'stroke-width="3"/>')
            parts.append(
                f'<path d="M{ax + gap - 14} {ay - 7}l10 7-10 7" fill="none" '
                f'stroke="{s["sub"]}" stroke-width="3" '
                f'stroke-linecap="round" stroke-linejoin="round"/>')
    # service-plane bar under nodes 2..4
    bx, bw, by, bh = 285, 630, 285, 52
    for cx in (285 + 90, 735 + 90):
        parts.append(
            f'<path d="M{cx} {y0 + nh}v{by - y0 - nh}" '
            f'stroke="{FAMILY}" stroke-width="2" stroke-dasharray="5 5"/>')
    parts.append(
        f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="12" '
        f'fill="{s["box"]}" stroke="{FAMILY}" stroke-width="2"/>')
    parts.append(
        f'<text x="{bx + bw // 2}" y="{by + 33}" fill="{s["text"]}" '
        f'text-anchor="middle" font-family="ui-monospace,monospace" '
        f'font-size="14">ctx.dataQuality · verifyCitations · '
        f'data_quality domain · JSON backend</text>')
    parts.append(
        f'<text x="60" y="378" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="13">deterministic TypeScript in the harness '
        f'process · no network · no model arithmetic</text>')
    parts.append('</svg>')
    return "\n".join(parts) + "\n"


# ---------------------------------------------------------------------------
# 2. Evidence bar chart (zh/en x light/dark)
# ---------------------------------------------------------------------------
# Six-dimension DAMA scorecard over the committed fixture, quoted verbatim
# from the measured run recorded in docs/assets/dsh-data-quality-evidence.png
# (10 rows x 6 columns; accuracy is reported undetermined without a declared
# schema, so five dimensions are shown).
SCORECARD = [("completeness", 0.967), ("uniqueness", 0.900),
             ("validity", 0.914), ("consistency", 0.879),
             ("timeliness", 1.000)]

TEXT = {
    "zh": dict(
        title="dsh-data-quality — 六维 DAMA 计分卡（实测）",
        sub="fixtures/dirty-fund-holdings.csv（10 行 × 6 列）· 可判定 5 维 · overall 93.2%",
        note1="数据出自 docs/assets/dsh-data-quality-evidence.png 记录的实测运行："
              "本仓自带引擎跑自带 fixture，generatedAt 2026-10-09 UTC",
        note2="accuracy 在未声明 schema 时报告 undetermined —— 不做假数据填充"),
    "en": dict(
        title="dsh-data-quality — six-dimension DAMA scorecard (measured)",
        sub="fixtures/dirty-fund-holdings.csv (10 rows x 6 columns) · "
            "5 determinable dimensions · overall 93.2%",
        note1="Data from the measured run recorded in "
              "docs/assets/dsh-data-quality-evidence.png: the repo's own "
              "engine over its own fixture, generatedAt 2026-10-09 UTC",
        note2="accuracy is reported undetermined without a declared schema "
              "— never fabricated"),
}


def evidence(lang: str, skin: str) -> None:
    s = SKIN[skin]
    t = TEXT[lang]
    w, h = 1600, 560
    img = Image.new("RGB", (w, h), s["bg"])
    d = ImageDraw.Draw(img)
    pad = 70
    d.text((pad, 40), t["title"], font=font(34), fill=s["text"])
    d.text((pad, 92), t["sub"], font=font(18), fill=s["sub"])
    label_w = 300
    bar_x, bar_max = pad + label_w + 24, 1000
    row_h, bar_h = 56, 34
    top = 160
    for i, (name, val) in enumerate(SCORECARD):
        y = top + i * row_h
        lb = d.textbbox((0, 0), name, font=font(22))
        d.text((bar_x - 24 - (lb[2] - lb[0]), y + 4), name,
               font=font(22), fill=s["text"])
        d.rounded_rectangle([bar_x, y, bar_x + bar_max, y + bar_h],
                            radius=9, fill=s["track"])
        color = GREEN[skin] if val >= 0.90 else ORANGE[skin]
        d.rounded_rectangle([bar_x, y, bar_x + int(bar_max * val), y + bar_h],
                            radius=9, fill=color)
        d.text((bar_x + bar_max + 18, y + 2), f"{val * 100:.1f}%",
               font=font(24), fill=s["text"])
    ny = top + len(SCORECARD) * row_h + 20
    d.text((pad, ny), t["note1"], font=font(16), fill=s["sub"])
    d.text((pad, ny + 30), t["note2"], font=font(16), fill=s["sub"])
    img.save(os.path.join(OUT, f"dsh-data-quality-evidence-{lang}-{skin}.webp"),
             "WEBP", quality=90)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        with open(os.path.join(OUT, f"dsh-data-quality-flow-{skin}.svg"),
                  "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(skin))
    for lang in ("zh", "en"):
        for skin in ("light", "dark"):
            evidence(lang, skin)
    print("wrote 2 SVG + 4 WebP assets to docs/assets/")


if __name__ == "__main__":
    main()
