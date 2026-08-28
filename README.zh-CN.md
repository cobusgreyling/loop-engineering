# Loop Engineering（中文）

> **别再逐条提示。设计循环。拿一个分数。**

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/cobusgreyling/loop-engineering@main/assets/visuals/LE5.jpeg" alt="Loop Engineering — 设计会提示你的 agent 的系统" width="100%" />
</p>

[English README](README.md) · [5 分钟快速开始](docs/QUICKSTART.md) · [我想重构项目](docs/refactor.md)

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop doctor .
```

省略 `--tool` 时默认 `claude`。可换成 `grok`、`codex`、`opencode`。第一周只做 **L1 报告**，不要自动改代码、不要自动合并。

## 这是什么

这是一套围绕代码库 **运转 coding agent** 的模式库（分诊、看护 PR、扫 CI、升依赖），不是「一键重写整个项目」的按钮。

| 我想… | 从这里开始 |
|--------|------------|
| 每天知道仓库里该干什么 | [Quickstart](docs/QUICKSTART.md) → `daily-triage` |
| 几乎不新增文件，只用 GitHub Action 跑循环 | [Thin loop](starters/thin-loop/) |
| **重构 / 拆 todo / 自动推进** | **[重构路径](docs/refactor.md)**（Issue #522 的完整回答） |

## 重构怎么做（摘要）

**没有「L3 无人值守重构整个仓库」这种模式。** 那是故意的：大范围改文件落在 [safety.md](docs/safety.md) 的 denylist 里。

正确路径：

1. `loop init` 只搭治理框架（`STATE.md`、预算、约束），第一周只读扫描。
2. Daily Triage 把「大重构」拆成 **足够小、一个 PR 能做完** 的 High Priority 行。
3. 每一项：worktree → implementer 改 → **独立** verifier 跑测试 → **你** 审 PR。
4. 只对已经信任的路径（测试、文档）考虑自动合并 allowlist。核心逻辑永远升级给人类。

逐步说明、反例、和 Goal Engineering 的边界：请读 **[docs/refactor.md](docs/refactor.md)**。

## 第一周命令

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop doctor .
# 报告-only，例如 Claude Code：
# /loop 1d $loop-triage — 更新 STATE.md。第一周不要改代码。
```

空仓库走到第一份 `STATE.md`：[scripts/empty-to-state-demo.sh](scripts/empty-to-state-demo.sh)

## 分数说明

Loop Ready **更看最近有没有真正跑过循环**，而不是仓库里堆了多少模板文件。一份 30 天没更新的 `STATE.md` 不能算 L3。

## 许可

MIT
