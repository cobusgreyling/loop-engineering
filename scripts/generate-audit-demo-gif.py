#!/usr/bin/env python3
"""Render loop-audit-demo.gif — score climbing 10 → 70 → 100."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "visuals" / "loop-audit-demo.gif"
AUDIT = ROOT / "tools" / "loop-audit" / "dist" / "cli.js"
FONT_CANDIDATES = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/Supplemental/Courier New.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
]

BG = (5, 8, 16)
FG = (220, 228, 240)
MUTED = (130, 145, 170)
ACCENT = (62, 232, 197)
WARN = (210, 153, 34)
BAR_FILL = (62, 232, 197)
BAR_EMPTY = (30, 40, 58)
TITLE = "#0d1117"
BORDER = (30, 45, 68)

STAGES = [
    ("Stage 0 — empty project", 10, "L0", "Not loop-ready — start with a starter."),
    ("Stage 1 — after loop-init", 70, "L2", "Good foundation — triage + state in place."),
    ("Stage 2 — verifier + AGENTS.md", 100, "L2", "Strong loop — paste your badge."),
]

WIDTH, HEIGHT = 900, 520
FPS = 2


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def score_bar(score: int, width: int = 24) -> str:
    filled = max(0, min(width, round(score / 100 * width)))
    return "█" * filled + "░" * (width - filled)


def render_frame(stage_title: str, score: int, level: str, assessment: str) -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    font_sm = load_font(16)
    font_md = load_font(20)
    font_lg = load_font(28)
    font_xl = load_font(40)

    draw.rounded_rectangle((24, 24, WIDTH - 24, HEIGHT - 24), radius=12, fill=TITLE, outline=BORDER, width=2)

    # window chrome
    for i, color in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        draw.ellipse((44 + i * 22, 44, 56 + i * 22, 56), fill=color)
    draw.text((120, 42), "terminal — loop-audit", fill=MUTED, font=font_sm)

    y = 100
    draw.text((48, y), "Loop Readiness — before/after demo", fill=MUTED, font=font_sm)
    y += 36
    draw.text((48, y), stage_title, fill=FG, font=font_md)
    y += 48

    draw.text((48, y), f"Score: {score}/100  Level: {level}", fill=FG, font=font_lg)
    y += 44
    bar = score_bar(score)
    bar_color = ACCENT if score >= 40 else WARN
    draw.text((48, y), bar, fill=bar_color, font=font_md)
    draw.text((48 + len(bar) * 12 + 16, y), f"{score}/100", fill=bar_color, font=font_md)
    y += 52

    draw.text((48, y), assessment, fill=MUTED, font=font_sm)
    y += 56

    if score >= 70:
        draw.text((48, y), "✓ Triage skill present", fill=ACCENT, font=font_sm)
        y += 28
        draw.text((48, y), "✓ State file(s): STATE.md", fill=ACCENT, font=font_sm)
        y += 28
    if score >= 100:
        draw.text((48, y), "✓ Verifier skill present", fill=ACCENT, font=font_sm)
        y += 28

    draw.text((48, HEIGHT - 88), "npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok", fill=FG, font=font_sm)
    draw.text((48, HEIGHT - 56), "npx @cobusgreyling/loop-audit . --badge", fill=ACCENT, font=font_sm)

    # big score watermark
    draw.text((WIDTH - 200, 130), str(score), fill=(20, 32, 48), font=font_xl)

    return img


def build_gif() -> None:
    frames: list[Image.Image] = []

    intro = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(intro)
    font_lg = load_font(32)
    font_md = load_font(22)
    font_sm = load_font(18)
    draw.text((48, 180), "Stop prompting.", fill=FG, font=font_lg)
    draw.text((48, 230), "Design the loop.", fill=FG, font=font_lg)
    draw.text((48, 280), "Get a score.", fill=ACCENT, font=font_lg)
    draw.text((48, 360), "loop-init → loop-audit", fill=MUTED, font=font_md)
    draw.text((48, 400), "10  →  70  →  100", fill=ACCENT, font=font_sm)
    for _ in range(3):
        frames.append(intro)

    for title, score, level, assessment in STAGES:
        frame = render_frame(title, score, level, assessment)
        hold = 5 if score == 100 else 4
        frames.extend([frame] * hold)

    cta = render_frame("Done — paste your badge", 100, "L2", "Share your Loop Ready score in README.")
    frames.extend([cta] * 4)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    duration_ms = int(1000 / FPS)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=duration_ms,
        loop=0,
        optimize=True,
    )
    print(f"Wrote {OUT} ({len(frames)} frames, {OUT.stat().st_size // 1024} KB)")


def ensure_audit_built() -> None:
    if AUDIT.exists():
        return
    subprocess.run(["npm", "ci"], cwd=ROOT / "tools" / "loop-audit", check=True)
    subprocess.run(["npm", "run", "build"], cwd=ROOT / "tools" / "loop-audit", check=True)


if __name__ == "__main__":
    ensure_audit_built()
    build_gif()