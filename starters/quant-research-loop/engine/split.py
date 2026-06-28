"""Three-way chronological split — the structural fix for data snooping.

    TRAIN ──────► fit / optimize (the search hammers this freely)
    VALIDATION ─► rank candidates during search (gets "used up" — expected)
    LOCKBOX ────► touched ONCE, on the winner only (see ledger + verifier)

Splits are chronological (no shuffling) because this is a time series: shuffling
leaks the future into the past. The lockbox is always the most-recent slice, so
it is the closest thing to "data the strategy was not designed on."
"""
from __future__ import annotations

from dataclasses import dataclass

from .data import Bar


@dataclass
class Split:
    train: list[Bar]
    validation: list[Bar]
    lockbox: list[Bar]

    def summary(self) -> dict:
        return {
            "train_bars": len(self.train),
            "validation_bars": len(self.validation),
            "lockbox_bars": len(self.lockbox),
        }


def three_way(bars: list[Bar], train_frac: float = 0.5,
              validation_frac: float = 0.25) -> Split:
    assert 0 < train_frac < 1 and 0 < validation_frac < 1
    assert train_frac + validation_frac < 1, "lockbox needs a non-empty remainder"
    n = len(bars)
    t = int(n * train_frac)
    v = int(n * (train_frac + validation_frac))
    return Split(train=bars[:t], validation=bars[t:v], lockbox=bars[v:])
