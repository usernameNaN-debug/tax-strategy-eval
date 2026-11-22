# Changelog

## 0.1.0 — 2026-11-23

First public prototype.

- Five simulated households for tax year 2025, built by a Python engine, with planted opportunities, decoys, and dry wells.
- A 2025 federal tax engine in JavaScript, checked against the Python reference return in CI.
- Six simulated agents plus a human CPA baseline; one runs under a free-tier token quota.
- Rollouts with an optional grill-and-resubmit second pass.
- Grader: dollar score against the best known strategy, the four-step chain for every miss, and a status for every source.
- Leaderboard: Bradley–Terry on paired rollouts with bootstrap intervals, and score against tokens.
- Site: a short tour, a pixel replay of the rollout with a scene for each room, the written strategy, a postmortem map with X-ray, and the leaderboard.
- A three.js sketch of the building.
