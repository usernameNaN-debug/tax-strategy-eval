// Simulated agents. These are not real models. Each one is a small set of
// numbers that splits what an agent can do (insight: does it recognize the
// opportunity once the facts are in front of it) from what it bothers to do
// (reach, asking the client, refining). The leaderboard is only interesting
// if those two come apart, so the profiles are chosen to make them come apart.
//
//   reach[L]       chance it goes and gets a layer-L source it has a lead on
//   wander         chance it opens a source with no lead at all
//   insight        chance it recognizes an opportunity once all inputs are read
//   followThrough  chance the claimed amount is right, given it recognized it
//   credulity      chance it takes a decoy after reading the lure
//   askClient      chance it calls the client at all
//   refine         how much the grill pass recovers
//   hallucination  chance per rollout of claiming something with no source
//   wells          chance it digs through a dry well it walks past
//   verbosity      token multiplier on every call
//   quota          token budget; past it the lights go out

export const FREE_QUOTA = 150000;

export const PROFILES = [
  {
    id: 'kestrel', name: 'Kestrel', note: 'reads everything, calls the client, expensive',
    reach: [1, 0.95, 0.85, 0.9], wander: 0.35, insight: 0.92, followThrough: 0.92, credulity: 0.05,
    askClient: 0.95, refine: 0.7, hallucination: 0.03, wells: 0.45, verbosity: 1.9, quota: Infinity,
  },
  {
    id: 'heron', name: 'Heron', note: 'careful, slower, asks',
    reach: [1, 0.85, 0.6, 0.85], wander: 0.2, insight: 0.75, followThrough: 0.9, credulity: 0.1,
    askClient: 0.85, refine: 0.6, hallucination: 0.02, wells: 0.3, verbosity: 1.2, quota: Infinity,
  },
  {
    id: 'osprey', name: 'Osprey', note: 'knows the code cold, rarely looks past the folder',
    reach: [1, 0.45, 0.15, 0.2], wander: 0.05, insight: 0.97, followThrough: 0.95, credulity: 0.04,
    askClient: 0.15, refine: 0.35, hallucination: 0.02, wells: 0.1, verbosity: 1.0, quota: Infinity,
  },
  {
    id: 'magpie', name: 'Magpie', note: 'collects every shiny thing, including the bad ones',
    reach: [1, 0.9, 0.7, 0.6], wander: 0.6, insight: 0.6, followThrough: 0.7, credulity: 0.65,
    askClient: 0.6, refine: 0.2, hallucination: 0.2, wells: 0.8, verbosity: 1.5, quota: Infinity,
  },
  {
    id: 'wren', name: 'Wren', note: 'small and cheap, never picks up the phone',
    reach: [1, 0.6, 0.25, 0], wander: 0.1, insight: 0.62, followThrough: 0.8, credulity: 0.25,
    askClient: 0, refine: 0.3, hallucination: 0.05, wells: 0.2, verbosity: 0.6, quota: Infinity,
  },
  {
    id: 'sparrow', name: 'Sparrow', note: 'good instincts, free-tier budget',
    reach: [1, 0.85, 0.6, 0.8], wander: 0.25, insight: 0.8, followThrough: 0.88, credulity: 0.12,
    askClient: 0.8, refine: 0.5, hallucination: 0.03, wells: 0.3, verbosity: 1.1, quota: FREE_QUOTA,
  },
];

// A human reference: a CPA with an afternoon. Same world, same tools, no
// token meter. Shown in the table, kept off the cost plot.
export const HUMAN = {
  id: 'cpa', name: 'Human CPA', note: 'one afternoon, billed hourly', human: true,
  reach: [1, 0.9, 0.55, 1], wander: 0.15, insight: 0.85, followThrough: 0.95, credulity: 0.02,
  askClient: 1, refine: 0.4, hallucination: 0, wells: 0.25, verbosity: 1, quota: Infinity,
};

export const ALL_PROFILES = [...PROFILES, HUMAN];
export const profileById = Object.fromEntries(ALL_PROFILES.map((p) => [p.id, p]));
