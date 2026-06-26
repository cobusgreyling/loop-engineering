"""Quant research loop — pure-stdlib reference engine.

Stages map 1:1 onto the loop-engineering primitives:
  data.py        -> Automation / ingestion
  strategy.py    -> Maker (signal generation)
  backtest.py    -> Backtest math
  verifier.py    -> Checker (the real maker/checker split)
  paper_broker.py-> Execution (paper only)
  risk.py        -> Kill switch
  loop.py        -> Orchestrator + STATE writer
"""
