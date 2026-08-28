# Glossary / roundup outreach

These pages discuss “loop engineering” without linking the reference repo. One short note each, after the activation PR is on main.

## Recipients

| Outlet | URL | Ask |
|--------|-----|-----|
| Data Science Dojo | https://datasciencedojo.com/blog/loop-engineering-design-patterns/ | Add the pattern library + `npx @cobusgreyling/loop` as the practical catalog (their “10 patterns” are inner ReAct-style, different layer) |
| Sofokus glossary | https://www.sofokus.com/ai-glossary/loop-engineering/ | Citation / further reading |
| V12 Labs | https://www.v12labs.io/blog/2026-07-18-loop-engineering-explained | Skepticism is fair; point at stories/thirty-weekday-runs.md and the thin loop |
| DEV.co listing | https://dev.co/ai/frameworks/loop-engineering | Refresh star count and default command (`--tool claude`) |
| Codingscape | https://codingscape.com/blog/loop-engineering-why-agent-loops-beat-prompt-engineering | Practical next step link |

## Note (email / form)

Subject: loop-engineering reference repo for your loop engineering piece

Thanks for writing about loop engineering. There is a tool-agnostic pattern library + CLI that people copy for Daily Triage / PR babysitting / CI sweep, including failure stories:

https://github.com/cobusgreyling/loop-engineering

Default on-ramp (Claude Code):

```
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop doctor .
```

If useful, a “further reading” or “try it” link is enough. Happy to correct anything we got wrong relative to your article.

Cobus
