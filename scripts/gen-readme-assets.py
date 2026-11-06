#!/usr/bin/env python3
"""Generate README visuals for dsh-data-quality (docs/assets/).

Outputs (idempotent overwrite):
  dsh-data-quality-hero-{zh,en}-{light,dark}.webp   1440x576 raster hero (Pillow)
  dsh-data-quality-flow-v5-{light,dark}.svg         1100x660 hand-written SVG
  dsh-data-quality-evidence-{zh,en}-{light,dark}.webp
      six-dimension DAMA bar chart (kept from the measured-run asset; the
      numbers are quoted verbatim from docs/assets/dsh-data-quality-evidence.png)

Design notes
------------
* Hero: the left column is prose (kicker / title / two value lines / one
  subtitle / one meta line / footer). The right column is this repository's
  own semantic figure: a six-axis DAMA radar drawn from the measured run on
  fixtures/dirty-fund-holdings.csv -- completeness 96.7%, uniqueness 90.0%,
  validity 91.4%, consistency 87.9%, timeliness 100.0% (weighted overall
  93.2%), with accuracy left as a dashed, value-less spoke because the
  engine reports it undetermined when no schema is declared. Under the radar
  sits the report-key strip: the durable-report contract
  (<17-digit UTC stamp>-<kind>-<8-hex path fingerprint>), not an invented key.
* Flow: a "one snapshot, three instruments, one keyed ledger" grammar -- NOT
  a row of nodes. A single read-only snapshot card fans out to the profile /
  clean / verify instruments (with the two real cross-wires: clean writes the
  clean-diff profile delta, and the cleaned table is the verify input), all
  three fan into one report ledger keyed by the deterministic reportKey, and a
  read-back wire loops from the ledger to the snapshot for the
  verifyCitations statuses. Text is tokens and short labels only (tool names,
  field names, key shapes), so all five README languages share one pair.

Run once:  python scripts/gen-readme-assets.py
Requires:  Python 3.10+ with Pillow; Windows fonts msyh.ttc / msyhbd.ttc /
           consola.ttf / consolab.ttf / segoeui.ttf / segoeuib.ttf.
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

FONT_CJK = r"C:\Windows\Fonts\msyh.ttc"
FONT_CJK_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"
FONT_MONO_BOLD = r"C:\Windows\Fonts\consolab.ttf"
FONT_EN = r"C:\Windows\Fonts\segoeui.ttf"
FONT_EN_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"

for _path in (FONT_CJK, FONT_CJK_BOLD, FONT_MONO, FONT_MONO_BOLD, FONT_EN,
              FONT_EN_BOLD):
    if not os.path.exists(_path):
        raise SystemExit(f"FATAL: font missing: {_path}")

WARNINGS: list[str] = []

SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8", card="#ffffff",
        card_edge="#e4e1ee", zone="#f7f4fc", zone_edge="#e5e0f1",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", good="#16a34a", warn="#c2410c",
        pill="#ece7f9", track="#eae6f3", grid="#e7e4f0",
        good_bg="#e9f6ee", warn_bg="#fdf0e7", radar="#dfe5f7",
        shadow=(32, 26, 64),
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016", card="#1b2231",
        card_edge="#2e374b", zone="#171e2d", zone_edge="#2b3448",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", good="#3fb950", warn="#e0a85a",
        pill="#242d42", track="#243049", grid="#1e2636",
        good_bg="#16301f", warn_bg="#35271b", radar="#242e4a",
        shadow=(0, 0, 0),
    ),
}

# Measured on fixtures/dirty-fund-holdings.csv (10 rows x 6 columns); the
# same numbers are recorded in docs/assets/dsh-data-quality-evidence.png and
# quoted in all five READMEs. accuracy is undetermined without a declared
# schema -- never fabricated.
RADAR = [
    ("completeness", 0.967, "96.7%"),
    ("uniqueness", 0.900, "90.0%"),
    ("validity", 0.914, "91.4%"),
    ("timeliness", 1.000, "100.0%"),
    ("consistency", 0.879, "87.9%"),
    ("accuracy", None, None),
]

HERO = {
    "zh": dict(
        kicker="DeepSeek Harness · dsh-data-quality",
        title="数据质检",
        value=["一份 CSV 读成结构化数据集", "清洗与核查都走声明式规则"],
        sub="报告带 reportKey · 数字可回查复算",
        meta="纯 TypeScript · 无网络 · 无凭据 · 不调模型",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        card_kicker="DAMA 六维计分卡 · 实测",
        card_corner="10 行 × 6 列 · 重复 1",
        card_title="总体 93.2%",
        card_file="dirty-fund-holdings.csv",
        card_sub="五维可判定 · accuracy 未声明 schema → undetermined",
        key_label="reportKey",
        key_value="YYYYMMDDHHmmssSSS(UTC)-profile-<8hex>",
        key_note="键做路径安全校验 · 用 data_report(key) 回读同一份报告",
        key_strip="清洗 6 类规则 · 核查 7 类规则 · 期望 5 指标",
        undetermined="未判定",
        undetermined_note="未声明 schema",
    ),
    "en": dict(
        kicker="DeepSeek Harness · dsh-data-quality",
        title="Data quality",
        value=["One CSV in, a structured dataset out",
               "Clean and check as declarative rules"],
        sub="reports carry a reportKey you can re-open",
        meta="pure TypeScript · no network · no credentials · no model",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        card_kicker="DAMA scorecard · measured",
        card_corner="10 rows × 6 cols · 1 dup",
        card_title="overall 93.2%",
        card_file="dirty-fund-holdings.csv",
        card_sub="5 dimensions determinable · accuracy undetermined without schema",
        key_label="reportKey",
        key_value="YYYYMMDDHHmmssSSS(UTC)-profile-<8hex>",
        key_note="path-safe key · re-open the same report with data_report(key)",
        key_strip="clean 6 rule kinds · verify 7 rule kinds · 5 expectations",
        undetermined="undetermined",
        undetermined_note="no declared schema",
    ),
}


def font(size, kind="cjk"):
    return ImageFont.truetype(
        {"cjk": FONT_CJK, "cjk_bold": FONT_CJK_BOLD, "mono": FONT_MONO,
         "mono_bold": FONT_MONO_BOLD, "en": FONT_EN,
         "en_bold": FONT_EN_BOLD}[kind], max(8, int(size)))


def hx(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def gradient(w, h, c1, c2):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = 0.25 * (y / h) + 0.75 * (y / h) ** 1.6
        d.line([(0, y), (w, y)],
               fill=tuple(int(p + (q - p) * t) for p, q in zip(hx(c1), hx(c2))))
    return img


def glow(img, cx, cy, r, color, alpha=40):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(10, 0, -1):
        rr = r * i / 10
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=color + (int(alpha * (1 - i / 11)),))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def card(img, box, skin, radius=22, shadow=28):
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for i in range(shadow, 0, -3):
        sd.rounded_rectangle([x0 - i // 5, y0 + i // 2, x1 + i // 5, y1 + i],
                             radius=radius + i // 5,
                             fill=skin["shadow"] + (int(7 * (1 - i / shadow)),))
    base = Image.alpha_composite(
        img.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(13)))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=hx(skin["card"]),
                        outline=hx(skin["card_edge"]), width=2)
    return base.convert("RGB")


def fit(d, text, kind, max_w, size, min_size=13):
    size = int(size)
    while size > min_size:
        if d.textlength(text, font=font(size, kind)) <= max_w:
            return size
        size -= 1
    return max(min_size, size)


def write(img, xy, text, skin, size, kind="cjk", color="text",
          max_w=None, min_size=13, tag="", anchor=None):
    d = ImageDraw.Draw(img)
    if max_w is not None:
        size = fit(d, text, kind, max_w, size, min_size)
        if d.textlength(text, font=font(size, kind)) > max_w:
            WARNINGS.append(f"{tag}: {text!r} exceeds {max_w}px at {size}px")
            print(f"WARN {tag}: {text!r} exceeds {max_w}px at {size}px")
    d.text(xy, text, font=font(size, kind), fill=hx(skin[color]), anchor=anchor)
    return size


def pill(img, xy, text, skin, size=19, kind="cjk_bold",
         fg="accent", bg="pill", pad_x=18, pad_y=10):
    d = ImageDraw.Draw(img)
    f = font(size, kind)
    tw = d.textlength(text, font=f)
    x, y = xy
    h = size + pad_y * 2
    d.rounded_rectangle([x, y, x + tw + pad_x * 2, y + h], radius=h // 2,
                        fill=hx(skin[bg]))
    d.text((x + pad_x, y + pad_y - 1), text, font=f, fill=hx(skin[fg]))
    return img, x + tw + pad_x * 2


def dashed(img, p0, p1, color, width=2, dash=8, gap=6):
    d = ImageDraw.Draw(img)
    (x0, y0), (x1, y1) = p0, p1
    length = math.hypot(x1 - x0, y1 - y0)
    if length == 0:
        return
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    pos = 0.0
    while pos < length:
        end = min(pos + dash, length)
        d.line([x0 + ux * pos, y0 + uy * pos,
                x0 + ux * end, y0 + uy * end], fill=color, width=width)
        pos = end + gap


def lerp(a, b, t):
    return a + (b - a) * t


# --------------------------------------------------------------- hero radar
AXES = [(-90, "top"), (-30, "right"), (30, "right"), (90, "bottom"),
        (150, "left"), (210, "left")]
CX, CY, R = 1000, 300, 104


def axis_point(index, scale=1.0):
    angle = math.radians(AXES[index][0])
    return (CX + math.cos(angle) * R * scale,
            CY + math.sin(angle) * R * scale)


def draw_radar(img, skin, m):
    s = skin
    d = ImageDraw.Draw(img)
    grid = hx(s["grid"])
    accent = hx(s["accent"])
    faint = hx(s["faint"])
    warn = hx(s["warn"])

    # concentric hexrings + spokes
    for k in (0.25, 0.5, 0.75, 1.0):
        pts = [axis_point(i, k) for i in range(6)]
        d.line(pts + [pts[0]], fill=grid, width=2 if k == 1.0 else 1)
    for i in range(6):
        x, y = axis_point(i)
        d.line([CX, CY, x, y], fill=grid, width=1)
    # accuracy: no value -- dashed spoke only, deliberately no marker
    ax, ay = axis_point(5)
    dashed(img, (CX, CY), (ax, ay), warn, width=2, dash=7, gap=6)

    # measured polygon over the five determinable axes
    pts = []
    for i in range(5):
        value = RADAR[i][1]
        pts.append(axis_point(i, value))
    d.polygon(pts, fill=hx(s["radar"]))
    d.line(pts + [pts[0]], fill=accent, width=3, joint="curve")
    for x, y in pts:
        d.ellipse([x - 4.5, y - 4.5, x + 4.5, y + 4.5], fill=accent)

    # axis labels: name above value, outside the ring
    label_kind = "cjk" if m["undetermined"] == "未判定" else "en"
    mono_kind = "mono_bold"
    name_size, value_size = 15, 15
    offsets = {
        "top": (0, -20, "mm"), "bottom": (0, 34, "mm"),
        "right": (18, 0, "lm"), "left": (-18, 0, "rm"),
    }
    for i, (name, value, value_text) in enumerate(RADAR):
        x, y = axis_point(i)
        dx, dy, anchor = offsets[AXES[i][1]]
        lx, ly = x + dx, y + dy
        d.text((lx, ly - 14), name, font=font(name_size, "mono"),
               fill=warn if value is None else faint, anchor=anchor)
        if value is None:
            d.text((lx, ly + 3), m["undetermined"],
                   font=font(value_size, label_kind), fill=warn, anchor=anchor)
            d.text((lx, ly + 18), m["undetermined_note"],
                   font=font(11, "cjk" if label_kind == "cjk" else "en"),
                   fill=warn, anchor=anchor)
        else:
            d.text((lx, ly + 3), value_text, font=font(value_size, mono_kind),
                   fill=hx(s["text"]), anchor=anchor)
    return img


def hero(lang, skin_name):
    s = SKIN[skin_name]
    m = HERO[lang]
    w, h = 1440, 576
    img = gradient(w, h, s["bg_from"], s["bg_to"])
    img = glow(img, 1220, 30, 430, hx(s["accent"]),
               18 if skin_name == "light" else 34)
    img = glow(img, 110, 570, 300, hx(s["accent"]),
               8 if skin_name == "light" else 14)

    # ------------------------------------------------------------- left copy
    img, _ = pill(img, (58, 64), m["kicker"], s,
                  size=19 if lang == "zh" else 18,
                  kind="cjk_bold" if lang == "zh" else "en_bold")

    d = ImageDraw.Draw(img)
    title_kind = "cjk_bold" if lang == "zh" else "en_bold"
    tsize = fit(d, m["title"], title_kind, 570, 96 if lang == "zh" else 88, 78)
    d.text((58, 120), m["title"], font=font(tsize, title_kind),
           fill=hx(s["text"]))
    if tsize * 880 / 1440 < 48:
        WARNINGS.append(f"hero.{lang}.title below 48px displayed")
        print(f"WARN hero.{lang}.title below 48px displayed")

    vkind = "cjk_bold" if lang == "zh" else "en_bold"
    vsize = 36 if lang == "zh" else 31
    for line in m["value"]:
        vsize = min(vsize, fit(d, line, vkind, 570, vsize, 24))
    y = 258
    for i, line in enumerate(m["value"]):
        write(img, (58, y), line, s, vsize, vkind, "text", 570, 24,
              f"hero.{lang}.value{i}")
        y += vsize + 14

    sub_size = write(img, (58, 384), m["sub"], s, 26,
                     "cjk" if lang == "zh" else "en", "sub", 570, 24,
                     f"hero.{lang}.sub")
    if sub_size * 880 / 1440 < 15:
        WARNINGS.append(f"hero.{lang}.sub below 15px displayed")
        print(f"WARN hero.{lang}.sub below 15px displayed")

    meta_size = write(img, (58, 436), m["meta"], s, 20,
                      "cjk" if lang == "zh" else "en", "faint", 570, 19,
                      f"hero.{lang}.meta")
    if meta_size * 880 / 1440 < 12:
        WARNINGS.append(f"hero.{lang}.meta below 12px displayed")
        print(f"WARN hero.{lang}.meta below 12px displayed")

    d = ImageDraw.Draw(img)
    d.line([58, 476, 620, 476], fill=hx(s["grid"]), width=2)
    write(img, (58, 494), m["foot"], s, 17, "en", "faint", 560, 14,
          f"hero.{lang}.foot")

    # ------------------------------------------------------ scorecard board
    img = card(img, (652, 44, 1392, 552), s, radius=22)
    d = ImageDraw.Draw(img)

    write(img, (678, 66), m["card_kicker"], s, 17,
          "cjk_bold" if lang == "zh" else "mono_bold", "accent",
          470, 13, f"hero.{lang}.card_kicker")
    write(img, (1366, 66), m["card_corner"], s, 15,
          "cjk" if lang == "zh" else "mono", "faint", 300, 11,
          f"hero.{lang}.card_corner", anchor="ra")

    write(img, (678, 92), m["card_title"], s, 30,
          "cjk_bold" if lang == "zh" else "en_bold", "text", 420, 22,
          f"hero.{lang}.card_title")
    d.text((1366, 94), m["card_file"], font=font(13, "mono"),
           fill=hx(s["faint"]), anchor="ra")

    write(img, (678, 126), m["card_sub"], s, 15,
          "cjk" if lang == "zh" else "en", "sub", 688, 12,
          f"hero.{lang}.card_sub")

    d.line([678, 146, 1366, 146], fill=hx(s["grid"]), width=2)

    img = draw_radar(img, s, m)

    d = ImageDraw.Draw(img)
    d.line([678, 470, 1366, 470], fill=hx(s["grid"]), width=2)

    write(img, (678, 490), m["key_label"], s, 14,
          "cjk_bold" if lang == "zh" else "mono_bold", "accent",
          120, 11, f"hero.{lang}.key_label")
    write(img, (768, 490), m["key_value"], s, 14, "mono", "text", 594, 11,
          f"hero.{lang}.key_value")
    write(img, (678, 512), m["key_note"], s, 13.5,
          "cjk" if lang == "zh" else "en", "faint", 688, 11,
          f"hero.{lang}.key_note")
    write(img, (678, 534), m["key_strip"], s, 13.5,
          "cjk" if lang == "zh" else "en", "faint", 688, 11,
          f"hero.{lang}.key_strip")

    img.save(os.path.join(OUT, f"dsh-data-quality-hero-{lang}-{skin_name}.webp"),
             "WEBP", quality=92, method=6)
    print(f"wrote dsh-data-quality-hero-{lang}-{skin_name}.webp")


# --------------------------------------------------------------- flow (SVG)
FLOW = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8", card="#ffffff",
        edge="#e4e1ee", zone="#f5f2fb", zone_edge="#e3def1",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", good="#16a34a", warn="#c2410c",
        pill="#ece7f9", track="#eae6f3", grid="#e7e4f0", dot="#d9d3ea",
        good_bg="#e9f6ee", warn_bg="#fdf0e7",
        shadow="#1b1735", shadow_op="0.10",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016", card="#1b2231",
        edge="#2e374b", zone="#171e2d", zone_edge="#2b3448",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", good="#3fb950", warn="#d9a03c",
        pill="#242d42", track="#243049", grid="#1e2636", dot="#26314a",
        good_bg="#16301f", warn_bg="#35271b",
        shadow="#000000", shadow_op="0.55",
    ),
}

MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
SANS = ("ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', "
        "sans-serif")


def width_estimate(text, size, mono=True):
    return len(text) * size * (0.60 if mono else 0.55)


def flow_svg(skin_name):
    s = FLOW[skin_name]
    p: list[str] = []

    def esc(text):
        return (text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;"))

    def t(x, y, text, size, color="text", family=MONO, weight=400,
          anchor="start", opacity=None, max_w=None, tag=""):
        extra = f' opacity="{opacity}"' if opacity else ""
        if max_w is not None and width_estimate(text, size, family == MONO) > max_w:
            msg = f"flow.{tag}: {text!r} ~{width_estimate(text, size, family == MONO):.0f}px > {max_w}px"
            WARNINGS.append(msg)
            print(f"WARN {msg}")
        p.append(
            f'<text x="{x}" y="{y}" fill="{s[color]}" font-family="{family}" '
            f'font-size="{size}" font-weight="{weight}" '
            f'text-anchor="{anchor}"{extra}>{esc(text)}</text>')

    def box(x, y, w, h, fill="card", stroke="edge", r=18, sw=1.5, soft=True):
        if soft:
            p.append('<g filter="url(#soft)">')
        p.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" '
            f'fill="{s[fill]}" stroke="{s[stroke]}" stroke-width="{sw}"/>')
        if soft:
            p.append('</g>')

    def line(x1, y1, x2, y2, color="grid", width=1.5, dash=None, opacity=None):
        dd = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{opacity}"' if opacity else ""
        p.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{s[color]}" stroke-width="{width}"{dd}{o}/>')

    def arrow(x1, y1, x2, y2, color="accent", width=2, dash=None):
        dd = f' stroke-dasharray="{dash}"' if dash else ""
        p.append(
            f'<path d="M{x1} {y1} L{x2} {y2} M{x2 - 7} {y2 - 4.5} '
            f'L{x2} {y2} L{x2 - 7} {y2 + 4.5}" fill="none" '
            f'stroke="{s[color]}" stroke-width="{width}" stroke-linecap="round" '
            f'stroke-linejoin="round"{dd}/>')

    def chip(x, y, text, size=12.5, fg="accent", bg="pill", pad=9, h=20):
        w = width_estimate(text, size) + pad * 2
        p.append(f'<rect x="{x}" y="{y}" width="{w:.1f}" height="{h}" '
                 f'rx="{h / 2}" fill="{s[bg]}"/>')
        t(x + pad, y + h / 2 + size * 0.36, text, size, fg, MONO)
        return x + w

    p.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="660" '
        f'viewBox="0 0 1100 660" role="img" aria-labelledby="flowTitle flowDesc">\n'
        f'<title id="flowTitle">dsh-data-quality: one read-only dataset, '
        f'three deterministic instruments, one keyed report ledger</title>\n'
        f'<desc id="flowDesc">A workspace-confined dataset file is read-only '
        f'and re-loaded per run under maxRows / maxFileSizeMB / '
        f'allowedExtensions guards; the same input fans out to the profile, '
        f'clean, and verify instruments (clean additionally writes the '
        f'clean-diff profile delta and hands its output table to verify); all '
        f'runs fan into one data_quality report ledger keyed by the '
        f'deterministic reportKey, and a read-back wire returns from the ledger '
        f'to the dataset for verifyCitations statuses.</desc>\n'
        f'<defs>\n'
        f'  <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">\n'
        f'    <stop offset="0" stop-color="{s["bg_from"]}"/>\n'
        f'    <stop offset="1" stop-color="{s["bg_to"]}"/>\n'
        f'  </linearGradient>\n'
        f'  <filter id="soft" x="-30%" y="-30%" width="160%" height="180%">\n'
        f'    <feDropShadow dx="0" dy="8" stdDeviation="11" '
        f'flood-color="{s["shadow"]}" flood-opacity="{s["shadow_op"]}"/>\n'
        f'  </filter>\n'
        f'  <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">\n'
        f'    <circle cx="1.4" cy="1.4" r="1.4" fill="{s["dot"]}"/>\n'
        f'  </pattern>\n'
        f'</defs>\n'
        f'<rect width="1100" height="660" fill="url(#bg)"/>\n'
        f'<rect width="1100" height="660" fill="url(#dots)" opacity=".4"/>')

    # ---- header
    t(44, 56, "dsh-data-quality", 32, "text", MONO, 700)
    t(44, 82, "one read-only dataset · three instruments · one keyed ledger",
      14.5, "sub", SANS)
    p.append(f'<rect x="766" y="40" width="290" height="34" rx="17" '
             f'fill="{s["pill"]}"/>')
    t(911, 62, "pure TypeScript · no network", 14, "accent", MONO,
      anchor="middle")
    line(44, 100, 1056, 100, "grid", 1.5)

    # ---- column 1: immutable snapshot
    box(40, 118, 242, 402)
    t(58, 144, "SNAPSHOT", 15, "accent", MONO, 700, max_w=190,
      tag="snapshot.title")
    t(264, 144, "read-only", 12.5, "faint", MONO, anchor="end")
    t(58, 174, "holdings.csv", 17, "text", MONO, 700, max_w=200,
      tag="snapshot.file")
    t(58, 196, ".csv  .tsv  .json  .jsonl", 12.5, "sub", MONO, max_w=200,
      tag="snapshot.ext")
    t(58, 216, "immutable · read per run", 12.5, "sub", MONO, max_w=200,
      tag="snapshot.immutable")
    line(58, 230, 264, 230, "grid", 1.3)
    t(58, 252, "load guards", 12.5, "accent", MONO, 700)
    for row, (label, value) in enumerate((
            ("maxRows", "200000"),
            ("maxFileSizeMB", "64"),
            ("encoding", "UTF-8 BOM check"),
            ("sample", "deterministic stride"))):
        y = 276 + row * 20
        t(58, y, label, 12.5, "sub", MONO)
        t(264, y, value, 12.5, "text", MONO, 700, anchor="end")
    line(58, 352, 264, 352, "grid", 1.3)
    t(58, 374, "workspace-confined", 12.5, "accent", MONO, 700)
    t(58, 396, "path.resolve → containment", 12, "sub", MONO, max_w=200,
      tag="snapshot.confine")
    t(58, 414, "service root: workspaceRoot", 12, "sub", MONO, max_w=200,
      tag="snapshot.root")
    line(58, 430, 264, 430, "grid", 1.3)
    t(58, 454, "read once · never mutated", 13, "good", MONO, 700, max_w=200,
      tag="snapshot.mutate")
    t(58, 476, "source file untouched", 12.5, "sub", SANS)
    t(58, 496, "no network · no model calls", 12, "faint", SANS)

    # ---- column 2: three instruments
    # profile
    box(306, 118, 394, 120)
    t(324, 142, "PROFILE", 15, "accent", MONO, 700)
    t(682, 142, "data_profile", 12.5, "faint", MONO, anchor="end")
    t(324, 166, "rows × cols · types · missing · unique", 13, "text", MONO,
      max_w=360, tag="profile.1")
    t(324, 186, "numeric dist · IQR outliers · sha256 dupes", 13, "sub", MONO,
      max_w=360, tag="profile.2")
    t(324, 206, "DAMA scorecard 6 dims · weights", 13, "sub", MONO,
      max_w=360, tag="profile.3")
    t(324, 226, "industryPreset → accuracy determinable", 13, "sub", MONO,
      max_w=360, tag="profile.4")

    # clean
    box(306, 262, 394, 126)
    t(324, 286, "CLEAN", 15, "accent", MONO, 700)
    t(682, 286, "data_clean", 12.5, "faint", MONO, anchor="end")
    t(324, 310, "dedupe · fill-missing · coerce-type", 13, "text", MONO,
      max_w=360, tag="clean.1")
    t(324, 330, "normalize-unit · trim · map-values", 13, "text", MONO,
      max_w=360, tag="clean.2")
    t(324, 350, "ordered: each rule sees previous output", 13, "sub", MONO,
      max_w=360, tag="clean.3")
    chip(324, 362, "contract + preview", 12, "accent", "pill", h=19)
    chip(474, 362, "never overwrite source", 12, "warn", "warn_bg", h=19)

    # verify
    box(306, 412, 394, 108)
    t(324, 436, "VERIFY", 15, "accent", MONO, 700)
    t(682, 436, "data_verify", 12.5, "faint", MONO, anchor="end")
    t(324, 460, "not-null · unique · range · regex · enum", 13, "text", MONO,
      max_w=360, tag="verify.1")
    t(324, 480, "cross-column · freshness · expectations", 13, "sub", MONO,
      max_w=360, tag="verify.2")
    t(324, 500, "passed:false is a verdict · evidence ≤ 20", 12, "faint",
      MONO, max_w=360, tag="verify.3")

    # fan-out arrows (snapshot -> instruments)
    for y in (178, 325, 466):
        arrow(286, y, 304, y)
    # fan-in arrows (instruments -> ledger)
    for y in (178, 325, 466):
        arrow(702, y, 722, y)
    # cross-wires between instruments
    arrow(676, 258, 676, 242, "accent", 1.8, "4 4")
    t(666, 256, "clean-diff · before/after profile", 11.5, "sub", MONO,
      anchor="end", max_w=250, tag="cross.1")
    arrow(676, 392, 676, 408, "accent", 1.8, "4 4")
    t(666, 407, "output table → verify input", 11.5, "sub", MONO,
      anchor="end", max_w=250, tag="cross.2")

    # ---- column 3: report ledger
    box(724, 118, 336, 402)
    t(742, 144, "REPORT LEDGER", 15, "accent", MONO, 700, max_w=200,
      tag="ledger.title")
    t(1042, 144, "data_quality", 12.5, "faint", MONO, anchor="end")
    t(742, 166, "domain: data_quality · table: reports", 12, "sub", MONO,
      max_w=300, tag="ledger.domain")
    line(742, 178, 1042, 178, "grid", 1.3)

    kinds = [
        ("-profile", "types · missing · dupes"),
        ("-clean", "rules[] · contract"),
        ("-clean-diff", "before / after"),
        ("-verify", "rules[] · expectations"),
        ("-citations", "verified · mismatch"),
    ]
    for i, (kind, desc) in enumerate(kinds):
        y = 202 + i * 26
        p.append(f'<circle cx="748" cy="{y - 4}" r="3.2" fill="{s["accent"]}"/>')
        t(758, y, kind, 13.5, "text", MONO, 700)
        t(1042, y, desc, 11.5, "sub", MONO, anchor="end")

    line(742, 326, 1042, 326, "grid", 1.3)
    t(742, 348, "key = <17-digit UTC stamp>", 13, "text", MONO, 700, max_w=300,
      tag="ledger.key1")
    t(742, 368, "    + <kind> + <8-hex path fp>", 13, "sub", MONO, max_w=300,
      tag="ledger.key2")
    t(742, 388, "isValidReportKey · path-safe check", 11.5, "sub", MONO,
      max_w=300, tag="ledger.keysafe")

    line(742, 406, 1042, 406, "grid", 1.3)
    t(742, 428, "data_report(key | kind)", 13.5, "text", MONO, 700, max_w=300,
      tag="ledger.report")
    t(742, 448, "→ report · format: html", 12, "sub", MONO)
    t(742, 468, "invalid / missing key → loud error", 12, "sub", MONO,
      max_w=300, tag="ledger.loud")
    line(742, 486, 1042, 486, "grid", 1.3)
    t(742, 506, "durable across restart · JSON backend", 12, "accent", MONO,
      700, max_w=300, tag="ledger.durable")

    # ---- read-back wire (ledger -> snapshot), with the citation statuses
    p.append(f'<path d="M892 520 L892 544 L790 544" fill="none" '
             f'stroke="{s["accent"]}" stroke-width="2"/>')
    p.append(f'<path d="M330 544 L160 544 L160 524" fill="none" '
             f'stroke="{s["accent"]}" stroke-width="2"/>')
    p.append(f'<path d="M155 530 L160 522 L165 530" fill="none" '
             f'stroke="{s["accent"]}" stroke-width="2" stroke-linecap="round" '
             f'stroke-linejoin="round"/>')
    p.append(f'<rect x="330" y="524" width="460" height="42" rx="14" '
             f'fill="{s["card"]}" stroke="{s["edge"]}" stroke-width="1.4"/>')
    t(348, 543, "READ-BACK · verifyCitations: citation vs snapshot", 12.5,
      "accent", MONO, 700, max_w=430, tag="readback.1")
    t(348, 559, "verified · mismatch · not-found · unverifiable", 12, "sub",
      MONO, max_w=430, tag="readback.2")

    # ---- footer annotations
    t(44, 588, "load: workspace-confined · .csv/.tsv/.json/.jsonl · "
      "maxRows 200000 · maxFileSizeMB 64", 13, "sub", MONO, max_w=1010,
      tag="foot.1")
    t(44, 610, "engines: profileTable · applyCleanRules · verifyTable — pure: "
      "no I/O, no clock, no RNG", 13, "sub", MONO, max_w=1010, tag="foot.2")
    t(44, 632, "persist: data_quality reports (storeReports) + adaptive "
      "data-quality/profile · clean · verify events", 13, "sub", SANS,
      max_w=1010, tag="foot.3")

    p.append('</svg>')

    path = os.path.join(OUT, f"dsh-data-quality-flow-v5-{skin_name}.svg")
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(p) + "\n")
    print(f"wrote dsh-data-quality-flow-v5-{skin_name}.svg")


# ------------------------------------------------- measured scorecard chart
# Six-dimension DAMA scorecard over the committed fixture. Numbers are quoted
# verbatim from the measured run recorded in
# docs/assets/dsh-data-quality-evidence.png (10 rows x 6 columns; accuracy is
# undetermined without a declared schema, so five dimensions are shown).
SCORECARD = [("completeness", 0.967), ("uniqueness", 0.900),
             ("validity", 0.914), ("consistency", 0.879),
             ("timeliness", 1.000)]
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
ORANGE = {"light": "#bc4c00", "dark": "#d29922"}
EVIDENCE_SKIN = {
    "light": dict(bg="#ffffff", text="#1f2328", sub="#57606a", track="#eaeef2"),
    "dark": dict(bg="#0d1117", text="#f0f6fc", sub="#8b949e", track="#21262d"),
}

TEXT = {
    "zh": dict(
        title="dsh-data-quality — 六维 DAMA 计分卡（实测）",
        sub="fixtures/dirty-fund-holdings.csv（10 行 × 6 列）· 可判定 5 维 · overall 93.2%",
        note1="数据出自 docs/assets/dsh-data-quality-evidence.png 记录的实测运行："
              "本仓自带引擎跑自带 fixture，generatedAt 2026-10-09 UTC",
        note2="accuracy 在未声明 schema 时报告 undetermined —— 不做假数据填充",
    ),
    "en": dict(
        title="dsh-data-quality — six-dimension DAMA scorecard (measured)",
        sub="fixtures/dirty-fund-holdings.csv (10 rows x 6 columns) · "
            "5 determinable dimensions · overall 93.2%",
        note1="Data from the measured run recorded in "
              "docs/assets/dsh-data-quality-evidence.png: the repo's own "
              "engine over its own fixture, generatedAt 2026-10-09 UTC",
        note2="accuracy is reported undetermined without a declared schema "
              "— never fabricated",
    ),
}


def evidence(lang, skin_name):
    e = EVIDENCE_SKIN[skin_name]
    tx = TEXT[lang]
    w, h = 1600, 560
    img = Image.new("RGB", (w, h), hx(e["bg"]))
    d = ImageDraw.Draw(img)
    pad = 70
    d.text((pad, 40), tx["title"], font=font(34), fill=hx(e["text"]))
    d.text((pad, 92), tx["sub"], font=font(18), fill=hx(e["sub"]))
    bar_x, bar_max = pad + 324, 1000
    row_h, bar_h = 56, 34
    top = 160
    for i, (name, val) in enumerate(SCORECARD):
        y = top + i * row_h
        label = d.textbbox((0, 0), name, font=font(22))
        d.text((bar_x - 24 - (label[2] - label[0]), y + 4), name,
               font=font(22), fill=hx(e["text"]))
        d.rounded_rectangle([bar_x, y, bar_x + bar_max, y + bar_h],
                            radius=9, fill=hx(e["track"]))
        color = GREEN[skin_name] if val >= 0.90 else ORANGE[skin_name]
        d.rounded_rectangle([bar_x, y, bar_x + int(bar_max * val), y + bar_h],
                            radius=9, fill=hx(color))
        d.text((bar_x + bar_max + 18, y + 2), f"{val * 100:.1f}%",
               font=font(24), fill=hx(e["text"]))
    ny = top + len(SCORECARD) * row_h + 20
    d.text((pad, ny), tx["note1"], font=font(16), fill=hx(e["sub"]))
    d.text((pad, ny + 30), tx["note2"], font=font(16), fill=hx(e["sub"]))
    img.save(os.path.join(OUT, f"dsh-data-quality-evidence-{lang}-{skin_name}.webp"),
             "WEBP", quality=90)
    print(f"wrote dsh-data-quality-evidence-{lang}-{skin_name}.webp")


def main():
    os.makedirs(OUT, exist_ok=True)
    for skin_name in ("light", "dark"):
        for lang in ("zh", "en"):
            hero(lang, skin_name)
        flow_svg(skin_name)
    for lang in ("zh", "en"):
        for skin_name in ("light", "dark"):
            evidence(lang, skin_name)
    if WARNINGS:
        print(f"{len(WARNINGS)} layout warning(s)")
    else:
        print("no layout warnings")


if __name__ == "__main__":
    main()
