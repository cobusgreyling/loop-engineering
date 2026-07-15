#!/usr/bin/env python3
"""Generate a static star-history timeline SVG from GitHub stargazers data.

Used while api.star-history.com live embeds are unavailable (GitHub restricted
stargazer API access for third-party services, Jul 2026). CI requires the
``STAR_HISTORY_TOKEN`` repo secret (fine-grained PAT with read access to this
repo). Locally, use ``gh auth`` / ``GH_TOKEN``.

Interactive browser UI (token in localStorage): docs/star-history.html
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = os.environ.get("STAR_HISTORY_REPO", "cobusgreyling/loop-engineering")
OUT_DIR = Path(os.environ.get("STAR_HISTORY_OUT_DIR", "assets/visuals"))


def _api_token() -> str:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    if shutil.which("gh"):
        proc = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    raise RuntimeError(
        "GH_TOKEN/GITHUB_TOKEN or gh auth required "
        "(CI: set STAR_HISTORY_TOKEN repo secret)"
    )


def fetch_star_timestamps() -> list[datetime]:
    """Paginate the stargazers REST API (gh CLI auth is unreliable in Actions)."""
    token = _api_token()
    timestamps: list[datetime] = []
    page = 1
    while True:
        url = f"https://api.github.com/repos/{REPO}/stargazers?per_page=100&page={page}"
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/vnd.github.v3.star+json",
                "Authorization": f"Bearer {token}",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            raise RuntimeError(
                f"GitHub stargazers API failed (HTTP {exc.code}): {body}"
            ) from exc
        if not payload:
            break
        for item in payload:
            starred_at = item.get("starred_at")
            if starred_at:
                timestamps.append(
                    datetime.fromisoformat(starred_at.replace("Z", "+00:00"))
                )
        if len(payload) < 100:
            break
        page += 1
    timestamps.sort()
    return timestamps


def build_series(timestamps: list[datetime]) -> list[tuple[datetime, int]]:
    if not timestamps:
        created = datetime.now(timezone.utc)
        return [(created, 0)]

    series: list[tuple[datetime, int]] = []
    for i, ts in enumerate(timestamps, start=1):
        series.append((ts, i))
    return series


def svg_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_svg(series: list[tuple[datetime, int]], *, dark: bool) -> str:
    width, height = 900, 360
    margin = {"top": 36, "right": 28, "bottom": 52, "left": 64}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]

    if dark:
        bg, fg, grid, line, accent = "#0d1117", "#e6edf3", "#30363d", "#3ee8c5", "#58d5c4"
    else:
        bg, fg, grid, line, accent = "#ffffff", "#24292f", "#d0d7de", "#0969da", "#0550ae"

    start = series[0][0]
    end = series[-1][0]
    max_stars = series[-1][1]
    span = max((end - start).total_seconds(), 1.0)

    def x_pos(ts: datetime) -> float:
        return margin["left"] + ((ts - start).total_seconds() / span) * plot_w

    def y_pos(count: int) -> float:
        return margin["top"] + plot_h - (count / max(max_stars, 1)) * plot_h

    points = " ".join(
        f"{x_pos(ts):.1f},{y_pos(count):.1f}" for ts, count in series
    )
    area_points = (
        f"{margin['left']},{margin['top'] + plot_h} "
        f"{points} "
        f"{margin['left'] + plot_w},{margin['top'] + plot_h}"
    )

    # x-axis month ticks
    ticks: list[str] = []
    cursor = datetime(start.year, start.month, 1, tzinfo=timezone.utc)
    if cursor < start:
        month = cursor.month + 1
        year = cursor.year
        if month > 12:
            month, year = 1, year + 1
        cursor = datetime(year, month, 1, tzinfo=timezone.utc)

    while cursor <= end:
        if cursor >= start:
            x = x_pos(cursor)
            label = cursor.strftime("%b '%y")
            ticks.append(
                f'<line x1="{x:.1f}" y1="{margin["top"] + plot_h}" '
                f'x2="{x:.1f}" y2="{margin["top"] + plot_h + 4}" stroke="{grid}" />'
            )
            ticks.append(
                f'<text x="{x:.1f}" y="{height - 18}" text-anchor="middle" '
                f'font-size="11" fill="{fg}" font-family="ui-sans-serif, system-ui, sans-serif">'
                f"{svg_escape(label)}</text>"
            )
        month = cursor.month + 1
        year = cursor.year
        if month > 12:
            month, year = 1, year + 1
        cursor = datetime(year, month, 1, tzinfo=timezone.utc)

    y_ticks: list[str] = []
    step = max(500, (max_stars // 4 // 500 + 1) * 500) if max_stars > 1000 else max(100, (max_stars // 4 // 100 + 1) * 100)
    value = 0
    while value <= max_stars:
        y = y_pos(value)
        y_ticks.append(
            f'<line x1="{margin["left"] - 4}" y1="{y:.1f}" '
            f'x2="{margin["left"]}" y2="{y:.1f}" stroke="{grid}" />'
        )
        y_ticks.append(
            f'<text x="{margin["left"] - 8}" y="{y + 4:.1f}" text-anchor="end" '
            f'font-size="11" fill="{fg}" font-family="ui-sans-serif, system-ui, sans-serif">'
            f"{value:,}</text>"
        )
        value += step

    legend = (
        f'<text x="{margin["left"]}" y="22" font-size="13" font-weight="600" '
        f'fill="{fg}" font-family="ui-sans-serif, system-ui, sans-serif">'
        f"{svg_escape(REPO)}</text>"
        f'<text x="{margin["left"]}" y="38" font-size="11" fill="{fg}" '
        f'font-family="ui-sans-serif, system-ui, sans-serif">'
        f"{max_stars:,} stars · updated {datetime.now(timezone.utc).strftime('%Y-%m-%d')}</text>"
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="Star history for {svg_escape(REPO)}">
  <rect width="100%" height="100%" fill="{bg}" rx="8"/>
  {legend}
  <line x1="{margin['left']}" y1="{margin['top'] + plot_h}" x2="{margin['left'] + plot_w}" y2="{margin['top'] + plot_h}" stroke="{grid}"/>
  <line x1="{margin['left']}" y1="{margin['top']}" x2="{margin['left']}" y2="{margin['top'] + plot_h}" stroke="{grid}"/>
  {''.join(y_ticks)}
  {''.join(ticks)}
  <polygon points="{area_points}" fill="{accent}" fill-opacity="0.12"/>
  <polyline points="{points}" fill="none" stroke="{line}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="{x_pos(end):.1f}" cy="{y_pos(max_stars):.1f}" r="4" fill="{line}"/>
</svg>
"""


def main() -> int:
    try:
        _api_token()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Fetching stargazers for {REPO}...")
    timestamps = fetch_star_timestamps()
    series = build_series(timestamps)
    print(f"Built series: {len(series)} points, peak {series[-1][1]:,} stars")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    light_path = OUT_DIR / "star-history.svg"
    dark_path = OUT_DIR / "star-history-dark.svg"
    light_path.write_text(render_svg(series, dark=False), encoding="utf-8")
    dark_path.write_text(render_svg(series, dark=True), encoding="utf-8")
    print(f"Wrote {light_path} and {dark_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())