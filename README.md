# tax-strategy-eval

An agent gets one household's 2025 tax paperwork and a building full of sources. It writes a strategy. We score the strategy in dollars against the best one we know exists, then look at what it never opened.

Site: https://usernamenan-debug.github.io/tax-strategy-eval/

This is a prototype. The households, the market, and the agents are all simulated. The tax law is real: 2025 rules, including the July 2025 bill.

## Why tax strategy

Most finance evals are question answering. You hand the model the facts and ask it to compute something. That tests whether a model knows the code. It doesn't test whether the model will go find the facts in the first place, and that's where the money is.

A real household's savings are rarely in the folder they hand you. They're one hop away (the HSA eligibility that's only visible on the benefits portal), two hops away (the 2022 return in a basement box that still has a refund window open), or only in the client's head (the daycare that changes in June). An agent that knows the code cold and never leaves the folder will lose to a weaker one that reads widely and picks up the phone. The leaderboard here is built to show that gap. We call it capability versus disposition.

Tax is a good place to measure this because the answer is a number. Every opportunity in a household has a dollar value computed by a tax engine, so the score isn't a vibe or a rubric. It's the change in federal tax.

## A rollout

A rollout is one agent working one household until it says it's done. "Now" is March 2026 and the job is to review tax year 2025: what to file with the return, what's still open before April 15, what was missed, and what to set up for 2026.

The agent has a small tool surface:

| tool | what it does |
| --- | --- |
| `open(doc)` | read a source: a W-2, a publication, a portal page, an old return |
| `search(facility)` | look along a shelf; reveals what's there without reading it |
| `ask(question)` | call the client; some facts only exist here |
| `compute(inputs)` | run the 2025 tax engine |
| `pin(item)` | write an opportunity into the strategy with a claimed dollar value |
| `submit()` | hand in the strategy |

Every call costs tokens and is logged to a trace. The office page on the site replays that trace, not a script: the agent moves to the room that holds the source it opened, in the order it opened it.

After the first submit there's an optional second pass. The strategy comes back flagged and the agent is told to grill its own work and resubmit. We run one or two rollouts per agent per household. Running many more than that is a post-training budget, not an eval budget.

## Scoring

Each household has a best known strategy (BKS): the sum of every planted legal opportunity, each valued by the engine alone against a reference return.

- **Right idea, right number** (within 10%): full value.
- **Right idea, wrong number**: half the value, minus 20% of any overclaim. Overclaiming carries accuracy-penalty risk in real life, so it costs more than underclaiming.
- **Decoys**: every household has a few things that look like savings and aren't (an Ohio 529 deduction claimed on the federal return, a full Section 179 write-off on a heavy pickup). Taking one subtracts.
- **Unsourced claims**: subtract 20% of what was claimed.

The score is judged dollars over BKS. It can go negative.

The postmortem asks, for every opportunity missed, where the chain broke: the agent never saw a clue, saw one but didn't go looking, read the source but didn't write anything down, or wrote it down at the wrong amount. Every source in the building was available, so a dotted outline on the postmortem map (a source that held money and was never opened) is the agent's miss, not the client's.

## Leaderboard

Bradley–Terry ratings fit on paired outcomes (same household, same seed), shown as Elo with 90% bootstrap intervals. Score alone hides cost, so the leaderboard also plots score against tokens spent, as a multiple of a free-tier quota of 150k tokens. One agent, Sparrow, runs under that quota and gets cut off when it crosses it.

The agents are parametric policies standing in for models. Each has knobs for reach (how far from the folder it reads), insight (does it recognize an opportunity once the facts are in front of it), follow-through, credulity toward decoys, willingness to call the client, and so on. They exist to make the infrastructure honest before real models go in. To run a real model, implement the same tool calls against an API in `src/world/world.js`; nothing else changes.

The world doesn't care who calls its tools, so a planner fanning out readers against the same building works. The harness supports it; we haven't tested it.

## Run it

It's a static site. Any file server works:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. The backend (world, agents, grader, leaderboard) runs in your browser inside a Web Worker. The same modules run under Node for tests and to precompute the leaderboard:

```bash
node --test test/*.test.mjs
node scripts/build-leaderboard.mjs
```

The households are generated by a Python engine. CI rebuilds them and fails if the result differs from what's committed, then checks the JavaScript engine against the Python reference return for every household:

```bash
python3 scripts/py/build.py && node scripts/import-households.mjs
```

The site has three pages: the leaderboard (`index.html`), the office (`office.html`), and methodology (`methodology.html`). The retired pixel version of the office is still in the repo, unlinked: `pixel.html`, `3d.html`, `app/pixel/` and `dev/`.

## Layout

```
index.html               leaderboard
office.html              the office: pick a household, explore it or watch a rollout
methodology.html         how it fits together (placeholder)
app/                     front end
  office/                the office: background shader, folders, replay, reading
  ui/figures.js          small SVG figures shared by the pages
  pixel/                 retired pixel renderer, kept for reference
src/                     back end, plain ES modules
  engine/tax.js          2025 federal tax engine (2022 and 2026 parameters too)
  engine/grader.js       judging, the chain, source status
  world/                 households, documents, tool surface, simulated market
  agent/                 simulated agent profiles and the rollout policy
  bench/leaderboard.js   Bradley-Terry, bootstrap, Pareto
scripts/py/              Python engine and household builder (source of truth)
test/                    engine parity, rollout determinism, grader checks
data/                    households.json, leaderboard.json (built in CI)
```

## Soft spots

Things in the household data we'd check again before trusting a number:

- The RMD divisor of 25.5 at age 74 comes from the Uniform Lifetime Table as we read it; not cross-checked against a second source.
- 2026 SALT cap figures come from a secondary source (The Tax Adviser), not final regulations.
- Two items are gray: the mid-year dependent-care FSA change and the Duberstein gift question. They're marked gray in the strategy.
- Guidance on retroactive first-year solo 401(k) deferrals is thin.
- The used EV credit assumes the dealer transfer was done correctly at sale.
- The EITC is computed by formula. IRS tables use $50 bands and can differ by a few dollars.
- Opportunity values are each measured alone. They interact a little (an HSA lowers AGI, which moves a credit), so BKS is a reference point, not a sum you can always collect.

## Not tax advice

Everything here is simulated, and the strategies are written for fictional households.
