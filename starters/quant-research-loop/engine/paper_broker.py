"""Stage 4 — Execution (PAPER ONLY).

This broker fills orders against the last close with slippage and tracks an
equity curve in a JSON state file. It places ZERO real orders and has no
exchange credentials. Going live is a separate, deliberate, human-gated step
that is intentionally NOT implemented here — see LOOP.md.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict


@dataclass
class Account:
    cash: float
    units: float        # units of the asset held
    last_price: float
    equity: float
    realized_pnl: float
    history: list[dict]

    @classmethod
    def fresh(cls, starting_cash: float) -> "Account":
        return cls(cash=starting_cash, units=0.0, last_price=0.0,
                   equity=starting_cash, realized_pnl=0.0, history=[])


class PaperBroker:
    """A target-position broker. You tell it the fraction of equity you want in
    the asset (0..1); it rebalances to that with slippage and fees.
    """

    def __init__(self, state_path: str, starting_cash: float = 10_000.0,
                 fee_bps: float = 5.0, slippage_bps: float = 5.0):
        self.state_path = state_path
        self.fee = fee_bps / 10_000.0
        self.slip = slippage_bps / 10_000.0
        if os.path.exists(state_path):
            with open(state_path) as fh:
                self.acct = Account(**json.load(fh))
        else:
            self.acct = Account.fresh(starting_cash)

    def mark(self, price: float) -> None:
        self.acct.last_price = price
        self.acct.equity = self.acct.cash + self.acct.units * price

    def rebalance(self, target_fraction: float, price: float, ts: int) -> dict:
        """Move to target_fraction of equity in the asset. Returns a fill record."""
        target_fraction = max(0.0, min(1.0, target_fraction))
        self.mark(price)
        # Size the target in UNITS at the mark price; slippage is paid in cash,
        # not by distorting the unit count (so flatten() closes to exactly zero).
        target_units = (self.acct.equity * target_fraction) / price
        units_delta = target_units - self.acct.units
        if abs(units_delta * price) < 1e-6:
            return {"ts": ts, "action": "hold", "price": price, "equity": self.acct.equity}

        side = "buy" if units_delta > 0 else "sell"
        fill_price = price * (1 + self.slip) if side == "buy" else price * (1 - self.slip)
        notional = abs(units_delta) * fill_price
        fee = notional * self.fee

        self.acct.units += units_delta
        self.acct.cash -= units_delta * fill_price + fee
        self.mark(price)
        rec = {
            "ts": ts, "action": side, "price": round(fill_price, 2),
            "units_delta": round(units_delta, 6), "fee": round(fee, 4),
            "equity": round(self.acct.equity, 2),
            "target_fraction": target_fraction,
        }
        self.acct.history.append(rec)
        return rec

    def flatten(self, price: float, ts: int, reason: str = "kill-switch") -> dict:
        rec = self.rebalance(0.0, price, ts)
        rec["reason"] = reason
        return rec

    def save(self) -> None:
        with open(self.state_path, "w") as fh:
            json.dump(asdict(self.acct), fh, indent=2)
