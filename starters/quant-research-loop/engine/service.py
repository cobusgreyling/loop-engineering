"""Always-on forward-tracking service (Railway-ready, pure stdlib).

Runs the frozen-strategy forward check on a schedule, persists the record and a
scoreboard to QUANT_DATA_DIR (mount a persistent Volume there), and serves a live
status page on $PORT. No dependencies.

Env:
  PORT                   HTTP port (Railway sets this automatically; default 8080)
  QUANT_DATA_DIR         where the record persists (mount a Volume here, e.g. /data)
  CHECK_INTERVAL_SECONDS how often to check prices (default 86400 = daily)
  AUTO_REGISTER          "1" (default) auto-registers any new FROZEN thesis on boot

Add a new thesis: define it in forward_paper.FROZEN_STRATEGIES, redeploy — the
service auto-registers it (write-once) and starts tracking it from that point.
"""
from __future__ import annotations

import json
import os
import threading
import time
import traceback
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import forward_paper as fp


PORT = int(os.environ.get("PORT", "8080"))
INTERVAL = int(os.environ.get("CHECK_INTERVAL_SECONDS", "86400"))
AUTO_REGISTER = os.environ.get("AUTO_REGISTER", "1") == "1"
SCORE_PATH = os.path.join(fp.DATA_DIR, "scoreboard.json")


def scoreboard_from_results(results: dict, checked_utc: str) -> dict:
    """Pure: turn forward_paper.run() output into a persisted scoreboard."""
    board = {"checked_utc": checked_utc, "interval_seconds": INTERVAL, "strategies": {}}
    for name, r in results.items():
        m = r["forward"]
        n_days = m.get("n_days", 0)
        status = "awaiting_data" if n_days == 0 else ("within_mandate" if r["within_mandate"] else "breached")
        board["strategies"][name] = {
            "status": status,
            "kind": r.get("kind"),
            "registered_as_of": r["registered_as_of"],
            "mandate_max_drawdown": r["mandate_max_drawdown"],
            "forward_days": n_days,
            "equity_mult": m.get("equity_mult"),
            "total_return": m.get("total_return"),
            "sharpe": m.get("sharpe"),
            "max_drawdown": m.get("max_drawdown"),
            "latest_data": m.get("last_forward") or m.get("last_data"),
        }
    return board


def run_check() -> dict:
    results = fp.run(refresh=True)
    board = scoreboard_from_results(results, datetime.utcnow().strftime("%Y-%m-%d %H:%M:%SZ"))
    tmp = SCORE_PATH + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(board, fh, indent=2)
    os.replace(tmp, SCORE_PATH)  # atomic
    return board


def _scheduler():
    while True:
        try:
            b = run_check()
            print(f"[check] {b['checked_utc']} — "
                  + ", ".join(f"{n}:{s['status']}" for n, s in b["strategies"].items()), flush=True)
        except Exception:
            traceback.print_exc()
        time.sleep(INTERVAL)


def _load_board() -> dict | None:
    if os.path.exists(SCORE_PATH):
        with open(SCORE_PATH) as fh:
            return json.load(fh)
    return None


def _render_html(board: dict | None) -> str:
    if not board:
        return "<h1>Quant Forward Tracker</h1><p>Initializing — first check running…</p>"
    rows = []
    color = {"within_mandate": "#3ee8c5", "breached": "#e5687a", "awaiting_data": "#7a879a"}
    for name, s in board["strategies"].items():
        c = color.get(s["status"], "#c9d4e2")
        eq = f"{s['equity_mult']}x" if s.get("equity_mult") is not None else "—"
        sh = s.get("sharpe") if s.get("sharpe") is not None else "—"
        dd = f"{s['max_drawdown']:.0%}" if s.get("max_drawdown") is not None else "—"
        rows.append(
            f"<tr><td>{name}</td>"
            f"<td style='color:{c};font-weight:600'>{s['status'].replace('_',' ')}</td>"
            f"<td>{s['registered_as_of']}</td><td>{s['forward_days']}</td>"
            f"<td>{eq}</td><td>{sh}</td><td>{dd}</td><td>{s.get('latest_data','—')}</td></tr>")
    return f"""<!doctype html><meta charset=utf-8>
<title>Quant Forward Tracker</title>
<style>body{{font-family:ui-monospace,Menlo,monospace;background:#0d1117;color:#c9d4e2;
max-width:900px;margin:40px auto;padding:0 20px;line-height:1.6}}
h1{{color:#3ee8c5;font-size:20px}} table{{width:100%;border-collapse:collapse;font-size:13px}}
th,td{{text-align:left;padding:8px 10px;border-bottom:1px solid #20303f}}
th{{color:#7a879a;font-size:11px;text-transform:uppercase;letter-spacing:.06em}}
.meta{{color:#7a879a;font-size:12px}}</style>
<h1>◈ Quant Forward Tracker</h1>
<p class=meta>Last check: {board['checked_utc']} · interval {board['interval_seconds']}s ·
paper only · forward equity is the verdict</p>
<table><tr><th>strategy</th><th>status</th><th>registered</th><th>fwd days</th>
<th>equity</th><th>Sharpe</th><th>maxDD</th><th>latest data</th></tr>
{''.join(rows)}</table>
<p class=meta>Statuses: <b style='color:#3ee8c5'>within mandate</b> ·
<b style='color:#e5687a'>breached</b> · <b style='color:#7a879a'>awaiting data</b>.
Add a thesis in forward_paper.FROZEN_STRATEGIES and redeploy.</p>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/health"):
            self._send(200, "text/plain", b"ok")
        elif self.path.startswith("/scoreboard.json"):
            b = _load_board() or {}
            self._send(200, "application/json", json.dumps(b, indent=2).encode())
        else:
            self._send(200, "text/html; charset=utf-8", _render_html(_load_board()).encode())

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):  # quiet default access logging
        pass


def main():
    if AUTO_REGISTER:
        added = fp.auto_register_pending()
        if added:
            print(f"[boot] auto-registered: {added}", flush=True)
    threading.Thread(target=_scheduler, daemon=True).start()
    print(f"[boot] serving on :{PORT} · data dir {fp.DATA_DIR} · interval {INTERVAL}s", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
