"""Research ledger — persistent accounting for the two things you can no longer
track by hand once the loop searches for you:

1. Cumulative trial count. Every candidate the search evaluates is a trial. The
   ledger sums them ACROSS cycles, so the deflated-Sharpe bar keeps rising the
   more you search. You cannot reset it by claiming `--n-trials 1`.

2. Lockbox openings. The lockbox is write-once per dataset. The ledger fingerprints
   the lockbox data and refuses to open it more than `max_openings` times. The
   first peek spends its statistical power; a second peek on the same data is you
   fooling yourself, so the ledger blocks it.
"""
from __future__ import annotations

import hashlib
import json
import os

from .data import Bar


def fingerprint(bars: list[Bar]) -> str:
    """Stable hash of a data slice — identifies a specific lockbox."""
    h = hashlib.sha256()
    for b in bars:
        h.update(f"{b.ts}:{round(b.close, 4)}".encode())
    return h.hexdigest()[:16]


class ResearchLedger:
    def __init__(self, path: str):
        self.path = path
        self.data = {"cumulative_trials": 0, "lockbox": {}, "quarantine": {}}
        if os.path.exists(path):
            with open(path) as fh:
                self.data = json.load(fh)
        self.data.setdefault("cumulative_trials", 0)
        self.data.setdefault("lockbox", {})
        self.data.setdefault("quarantine", {})

    # --- trial counting (enforced) ---------------------------------------
    def add_trials(self, n: int) -> None:
        self.data["cumulative_trials"] += int(n)

    @property
    def cumulative_trials(self) -> int:
        return int(self.data["cumulative_trials"])

    def budget_exhausted(self, budget: int) -> bool:
        """#4 — has the campaign spent its research budget? A loop that searches
        forever turns the whole dataset into in-sample data; the budget forces a
        stop. budget <= 0 means unlimited (no auto-halt)."""
        return budget > 0 and self.cumulative_trials >= budget

    # --- forward quarantine (#5) -----------------------------------------
    # Each strategy forward-tested on a given out-of-time window spends a little
    # of that window's power, exactly like the lockbox. Track and cap it.
    def quarantine_count(self, fp: str) -> int:
        return len(self.data["quarantine"].get(fp, []))

    def quarantine_can_test(self, fp: str, max_evals: int) -> bool:
        return self.quarantine_count(fp) < max_evals

    def record_quarantine(self, fp: str, record: dict) -> None:
        self.data["quarantine"].setdefault(fp, []).append(record)

    # --- lockbox write-once ----------------------------------------------
    def openings(self, fp: str) -> list[dict]:
        return self.data["lockbox"].get(fp, [])

    def can_open(self, fp: str, max_openings: int = 1) -> bool:
        return len(self.openings(fp)) < max_openings

    def record_open(self, fp: str, record: dict) -> None:
        self.data["lockbox"].setdefault(fp, []).append(record)

    def save(self) -> None:
        with open(self.path, "w") as fh:
            json.dump(self.data, fh, indent=2)

    def reset(self) -> None:
        """Wipe the ledger. Honest only when you have genuinely new data — not a
        way to keep re-peeking at the same lockbox until it passes."""
        self.data = {"cumulative_trials": 0, "lockbox": {}, "quarantine": {}}
