# Changelog

## 0.2.0 — 2026-11-23

A new office, and the site split into three pages.

- Header is now Leaderboard, Office, Methodology. The leaderboard is the front page.
- The office starts with a short intro and a reel that grows to fill the window as you scroll. Nothing opens until you press play.
- The background is one shader: a sky, a clock face, and worksheets drifting through, with a slow rack focus between them.
- Households are end-tab case folders. Open one to read the intake, what's in the folder, and the reference return, then explore the household or start a rollout.
- The rollout plays back without characters: a reticle moves between rooms, the light changes with the room, and the strategy fills in as the agent pins items.
- Explore and rollout each end on a hero with numbered contents, then a reading with a side contents list.
- The pixel office and the 3D sketch are retired but kept in the repo, unlinked.

## 0.1.1 — 2026-11-23

- Header no longer wraps the site name on phones.

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
