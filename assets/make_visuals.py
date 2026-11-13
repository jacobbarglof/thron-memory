"""Generates assets/banner.svg and assets/how-it-works.svg in the ThronOS visual style:
deep blue-black, a faint light field, a fine grid that fades out, light living on hairline
edges, Saira Semi Condensed for display type and Fira Mono for small labels.

Text is converted to vector outlines, so the images look identical on GitHub and everywhere
else with no font loading. Fonts: SIL Open Font License (see assets/fonts).

Run: python assets/make_visuals.py   (needs: pip install fonttools)
"""

import re
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).parent
FONTS = {
    "light": TTFont(HERE / "fonts" / "SairaSemiCondensed-Light.ttf"),
    "medium": TTFont(HERE / "fonts" / "SairaSemiCondensed-Medium.ttf"),
    "mono": TTFont(HERE / "fonts" / "FiraMono-Regular.ttf"),
}
MARK = re.search(r' d="([^"]+)"', (HERE / "logo-mark.svg").read_text()).group(1)

BG, C, HI, DIM, TEXT, MUTED, LOGO = "#04070a", "#8fdbe3", "#ecfcfe", "#6f9ea4", "#dcebee", "#93abb0", "#5ce6f2"
LINE, LINE2 = "rgba(150,210,220,.13)", "rgba(150,210,220,.26)"


def text(s, x, y, size, font="light", fill=TEXT, spacing=0.0, anchor="start", opacity=1.0):
    """Text as an SVG path. spacing is extra space between letters, in pixels."""
    f = FONTS[font]
    glyphs, cmap, scale = f.getGlyphSet(), f.getBestCmap(), size / f["head"].unitsPerEm
    names = [cmap.get(ord(ch), cmap.get(ord("?"))) for ch in s]
    width = sum(glyphs[n].width * scale for n in names) + spacing * (len(names) - 1)
    cx = x - width if anchor == "end" else x - width / 2 if anchor == "middle" else x
    pen = SVGPathPen(glyphs)
    for n in names:
        glyphs[n].draw(TransformPen(pen, (scale, 0, 0, -scale, cx, y)))
        cx += glyphs[n].width * scale + spacing
    op = f' opacity="{opacity}"' if opacity != 1 else ""
    return f'<path d="{pen.getCommands()}" fill="{fill}"{op}/>'


def backdrop(w, h, i):
    return f"""
  <defs>
    <radialGradient id="{i}f1" cx="0.72" cy="-0.12" r="0.75"><stop offset="0" stop-color="rgb(90,180,200)" stop-opacity=".16"/><stop offset="1" stop-color="rgb(90,180,200)" stop-opacity="0"/></radialGradient>
    <radialGradient id="{i}f2" cx="0" cy="0" r="0.6"><stop offset="0" stop-color="rgb(90,140,200)" stop-opacity=".07"/><stop offset="1" stop-color="rgb(90,140,200)" stop-opacity="0"/></radialGradient>
    <pattern id="{i}g" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" fill="none" stroke="{C}" stroke-opacity=".06" stroke-width="1"/></pattern>
    <linearGradient id="{i}fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".35"/><stop offset=".9" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="{i}mask"><rect width="{w}" height="{h}" fill="url(#{i}fade)"/></mask>
    <filter id="{i}glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="{i}soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <rect width="{w}" height="{h}" fill="{BG}"/>
  <rect width="{w}" height="{h}" fill="url(#{i}f1)"/>
  <rect width="{w}" height="{h}" fill="url(#{i}f2)"/>
  <rect width="{w}" height="{h}" fill="url(#{i}g)" mask="url(#{i}mask)"/>"""


def hairline(x1, x2, y, i, moving=False):
    anim = (f'<animate attributeName="x" values="{x1};{x2 - 72};{x1}" dur="14s" repeatCount="indefinite" '
            f'calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>') if moving else ""
    return (f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{LINE2}" stroke-width="1"/>'
            f'<rect x="{x1}" y="{y - 0.75}" width="72" height="1.5" fill="{C}" filter="url(#{i}glow)">{anim}</rect>')


def panel(x, y, w, h, i):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{C}" fill-opacity=".03" stroke="{LINE}"/>'
            f'<rect x="{x + 14}" y="{y - 0.75}" width="48" height="1.5" fill="{C}" filter="url(#{i}glow)"/>')


def label(x, y, s):
    return text(s, x, y, 13, "medium", C, 2.4)


# ---------- banner ----------
W, H = 1280, 400
banner = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="thron-memory. One private memory for all your AI apps. Part of ThronOS.">
  {backdrop(W, H, "b")}
  <g transform="translate(96,96) scale({208 / 490:.5f}) translate(-266,-119)">
    <path d="{MARK}" fill="{LOGO}" fill-rule="evenodd" filter="url(#bsoft)" opacity=".5">
      <animate attributeName="opacity" values=".3;.65;.3" dur="6s" repeatCount="indefinite"/>
    </path>
    <path d="{MARK}" fill="{LOGO}" fill-rule="evenodd"/>
  </g>
  {text("THRON-MEMORY", 352, 184, 70, "light", HI, 9)}
  {hairline(354, 1184, 214, "b", moving=True)}
  {text("One private memory for all your AI apps.", 354, 262, 30, "light", TEXT, 0.4)}
  {text("CHATGPT · CLAUDE · GEMINI · CURSOR · VS CODE · CODEX · ANY MCP APP", 356, 304, 14.5, "mono", DIM, 2.2)}
  {text("PART OF THRONOS", 1184, 364, 12, "mono", DIM, 2.2, "end", 0.85)}
</svg>
"""

# ---------- how it works ----------
W2, H2 = 1280, 470


def row(x, y, name, hint):
    return text(name, x, y, 23, "light", TEXT, 0.3) + text(hint, x, y + 22, 12.5, "mono", MUTED)


def chip(x, y, s):
    return (f'<rect x="{x}" y="{y}" width="136" height="36" rx="18" fill="none" stroke="{LINE2}"/>'
            + text(s, x + 68, y + 24, 18, "light", TEXT, 0.3, "middle"))


def wire(x1, x2, y, dur):
    return (f'<path d="M{x1} {y} H{x2}" stroke="{LINE2}" stroke-width="1" fill="none"/>'
            f'<path d="M{x2 - 7} {y - 5} L{x2} {y} L{x2 - 7} {y + 5}" stroke="{C}" stroke-width="1.2" fill="none"/>'
            f'<circle r="2.6" fill="{HI}" filter="url(#hglow)"><animateMotion dur="{dur}s" repeatCount="indefinite" path="M{x1} {y} H{x2}"/></circle>')


page_lines = [("alex-kim.md", C), ("", TEXT), ("My manager at Acme.", TEXT), ("", TEXT), ("## Current", HI),
              ("- Prefers afternoon meetings", TEXT), ("", TEXT), ("## History", HI), ("- was: Prefers mornings", MUTED)]
md = "".join(text(s, 944, 144 + n * 24, 14, "mono", col) for n, (s, col) in enumerate(page_lines) if s)

apps = ["ChatGPT", "Claude", "Gemini CLI", "Cursor", "VS Code", "Codex", "Windsurf", "Claude Code"]
chips = "".join(chip(488 + (n % 2) * 158, 132 + (n // 2) * 54, a) for n, a in enumerate(apps))

how = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W2} {H2}" width="{W2}" height="{H2}" role="img" aria-label="How it works: your phone, laptop and browser use AI apps like ChatGPT, Claude, Gemini and Cursor, which all read and write the same private memory.">
  {backdrop(W2, H2, "h")}
  {label(64, 74, "WHERE YOU ARE")}
  {panel(56, 96, 300, 300, "h")}
  {row(88, 158, "Phone", "claude, chatgpt apps")}
  {row(88, 242, "Laptop", "desktop and coding apps")}
  {row(88, 326, "Browser", "claude.ai, chatgpt.com")}
  {wire(372, 446, 246, 3.2)}
  {label(470, 74, "YOUR AI APPS")}
  {panel(462, 96, 346, 300, "h")}
  {chips}
  {text("+ any app that supports MCP", 635, 366, 12.5, "mono", MUTED, 0, "middle")}
  {wire(824, 898, 246, 2.7)}
  {label(922, 74, "ONE PRIVATE MEMORY")}
  {panel(914, 96, 310, 300, "h")}
  {md}
  {hairline(56, 1224, 432, "h")}
  {text("Encrypted in your own Cloudflare account, or plain files on your computer. Nothing in between.", 56, 458, 17, "light", MUTED, 0.3)}
</svg>
"""

(HERE / "banner.svg").write_text(banner, encoding="utf-8")
(HERE / "how-it-works.svg").write_text(how, encoding="utf-8")
print("Wrote assets/banner.svg and assets/how-it-works.svg")
