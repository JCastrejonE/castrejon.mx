---
title: 'What 225 defects said about building software with coding agents'
description: 'Of 225 defects in a hosting product that Claude agents built, 119 were found by running the real system and 0 by a unit test going red.'
summary: 'The defect record of Odoo Launchpad: of 225 defects, 119 were found by running the real system and 0 by a unit test going red. From it I derived a development model called Proof of Work.'
abstract: 'Odoo Launchpad was a hosting control plane for Odoo that Claude coding agents built almost entirely under my direction at Netlab between July and August 2026; I stopped it in October 2026. Its record lists 225 defects, each classified by what detected it. Running the real system and reading its state found 119 (53%), the author noticing that a measuring tool was wrong found 43, and a unit test going red found 0. 173 of 178 product defects were introduced under an approved spec. Two defect families were invisible to the gate by construction: measuring tools that confirmed what their author expected (47) and code that a second caller never reached (35). In one measured run, 1,545 of 2,241 seconds of agent wall clock (69%) were model inference. From this record I derived a development model, Proof of Work, in which a change is accepted on executable claims whose checks have been broken on purpose and seen to fail.'
date: '2026-09'
context: 'Case study · Odoo Launchpad · Netlab'
group: 'agents'
order: 1
repo: 'https://github.com/JCastrejonE/launchpad'
links:
  - label: 'Proof of Work (docs/PROOF-OF-WORK.md)'
    href: 'https://github.com/JCastrejonE/launchpad/blob/main/docs/PROOF-OF-WORK.md'
  - label: 'Companion essay: the setup bake-off'
    href: '/research/setup-bake-off/'
  - label: 'breakcheck'
    href: 'https://github.com/JCastrejonE/breakcheck'
---

## What Launchpad was

Odoo Launchpad was a control plane for hosting Odoo businesses. It provisioned an Odoo 18 or 19 tenant on a VPS fleet, gave every branch its own staging server, let an AI agent turn a request into code on that branch, and promoted the change to production behind one human click. Claude agents wrote almost all of it under my direction at Netlab, between July and August 2026, and I stopped it deliberately in October 2026. Every tenant was an internal test business, and I was the only person who drove the product end to end.

The agent side of the product, which the repository calls Forge, ran five roles on the Claude Agent SDK. A spec drafter wrote a spec from a chat. Once a person approved the spec at the first gate, a Temporal workflow ran an initializer that planned it as a checklist, fresh coder sessions that implemented the items until the checklist was done, and a fixer that got one repair round. The change then went through CI to a pull request and a second human gate. The fifth role, a supervisor, answered on demand from the project chat and was mechanically prevented from sending a gate signal.

What I kept from the project is the record of how it was built: 1,638 commits, 228 specs, and a log of every mistake with the way it was found. The public repository is a sanitized snapshot of it.

## The question

The pipeline was spec-first on both of its tracks: without a spec in `specs/`, no code was written. Every change started from a spec, and the agents' work had to pass a gate of build, typecheck, lint and tests. I wanted to determine whether that effort sat where the defects were actually caught, so I asked one question of each defect in the record: what detected it?

## Method

The record has 225 defects, deduplicated from six internal sources: the project's compliance registry (73 defect rows), [`docs/VERIFICATION.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/VERIFICATION.md), the open-work ledger `PENDING.md`, the findings of an A/B comparison, spec intents that name an earlier spec as broken, and 95 `fix(` commits since July 31. The ten detector counts sum to 225, one detector per defect. The record also groups defects into six families that describe the shape of the mistake, and the six family counts sum to 173.

The raw registry was removed from the public snapshot, since it's full of production operations detail; [`docs/PROOF-OF-WORK.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/PROOF-OF-WORK.md) states that its counts were taken from it before it was removed. For this reason the record's counts can't be re-derived from the repository, and I give each one exactly as the record prints it.

For agent time, the source was the session transcripts that the Agent SDK writes for every worktree, JSONL files that keep every turn of every agent session with its tool inputs and timestamps. The analysis, described in [`docs/AGENT-PERFORMANCE.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/AGENT-PERFORMANCE.md), counts the `tool_use` blocks in each assistant message and subtracts timestamps between an assistant turn and its `tool_result` to separate inference time from tool time.

## What detected the defects

<figure>
  <picture>
    <source media="(max-width: 40em)" srcset="/research/launchpad/detection-narrow.svg" width="343" height="454">
    <img src="/research/launchpad/detection.svg" width="672" height="424" alt="Bar chart of what detected the 225 Launchpad defects. Running the real system and reading its state found 119 (53%); the author noticing their own instrument was wrong, 43; a person reading code or docs, 31; hitting it while using the product, 16; the gate, 7; breaking the code and watching a test go red, 4; a reviewer agent, 2; an outage, 2; spec review, 1; a unit test going red, 0." loading="lazy" decoding="async">
  </picture>
  <figcaption>Figure 1. What detected each of the 225 defects in Launchpad's record, by count, with the shares as the record prints them. Every tenant was an internal test business and I was the only person who drove the product end to end; the two outages were outages of Launchpad's own production environment, which hosted those test tenants. Source: docs/PROOF-OF-WORK.md, section 1.</figcaption>
</figure>

Running the real system and reading its state found 119 of the 225 defects. In 43 more, the author of a measuring tool noticed that it was wrong, and the record says this always happened after a wrong conclusion had already been drawn. A person reading code or docs found 31, and 16 surfaced while I was using the product.

The gate found 7, all of them build, typecheck or lint failures. **A unit test going red found 0.**

The same record adds context. 173 of the 178 product defects (97%) were introduced under an approved spec, while spec review caught 1 defect in total; the record doesn't define which of the 225 count as product defects. And by the record's own count, 76 of the 225 defects could only have been caught on a live system.

## The two families the gate couldn't see

<figure>
  <picture>
    <source media="(max-width: 40em)" srcset="/research/launchpad/families-narrow.svg" width="343" height="714">
    <img src="/research/launchpad/families.svg" width="672" height="598" alt="Bar chart of six defect families with notes: wrong assumption in plan, 55; instrument confirms expectation, 47; second caller never wired, 35; environment or deploy drift, 19; assert-the-call test, 9; record says done before the world is, 8. Each row states what the proposed model changes for that family." loading="lazy" decoding="async">
  </picture>
  <figcaption>Figure 2. The six defect families in the record and what the Proof of Work model would change for each. The two families with colored bars are invisible to the gate (build, typecheck, lint and tests) by construction: a measuring tool lives in throwaway shell that no checked-in test sees, and a unit test calls the function directly, so it can't notice a second caller that never passes the new parameter. The six family counts sum to 173 of the 225 defects. Source: docs/PROOF-OF-WORK.md, sections 1 and 4.</figcaption>
</figure>

The largest family is wrong assumptions in a plan (55), of which 31 were found live and 8 in production. Those are mistakes about the world, such as Odoo installing modules only at database initialization, and the most a development model can do is move their detection before merge. The record identifies two other families that the gate could never have seen, whatever tests had been written.

### Instruments that confirm what their author expected (47)

These defects lived in the throwaway shell a session wrote to observe the system. `docs/VERIFICATION.md` lists the ones from 2026-08-13 alone. A poll for an initializer session row waited 52 minutes for a phase the run couldn't reach, because gate 1 had never been pressed. A poll on a column that didn't exist printed nothing, so its loop exited having measured nothing. Twice, a deploy whose remote pull had failed was taken as done because the service reported `active`, and the second time spec 0199's prompt fix was reported deployed while the server still ran the old tree. Finally, `grep -oE '[$][0-9]+'` on a page payload matched React chunk ids (`$1`, `$12`) and reported prices missing from a page that rendered them.

None of these instruments was committed, so no test ever ran them. 36 of the 47 were caught only when their author noticed that a conclusion was wrong.

### Code that was built, tested and never reached (35)

The most common case, 17 of the 35, is a function that grew an optional parameter that a second caller never passed. Rule 12 of `docs/VERIFICATION.md` records four of them in two days (2026-08-11 and 2026-08-12). In one, `suppressDuplicateApprove` had exempted branch runs since spec 0142, but neither call site passed `branch`, so gate 2's approve was hidden on every branch run.

Spec 0226, kept in the snapshot, is the clearest example. Its title says that the test branch is a neutralized copy of production, and every checklist item except the two reserved for a person was checked off as built. Item D2 gave `deployBranchStagingStack` an optional `copyProduction?` parameter, and in the snapshot neither of the two calls to that function in `packages/pipeline/src/activities.ts` passes it. The spec's own handoff log states that no database had been copied. A unit test calls the function directly, so in the test suite the function is always reached.

According to the record, the only mechanisms that demonstrably closed a recurring defect shape were compile-time ones: a required union and a typed value.

## Where an agent session's time went

<figure>
  <picture>
    <source media="(max-width: 40em)" srcset="/research/launchpad/session-time-narrow.svg" width="343" height="154">
    <img src="/research/launchpad/session-time.svg" width="672" height="100" alt="Part-to-whole bar for spec 0105: 1,545 of 2,241 seconds (69%) in model inference, 308 seconds running tools and 388 seconds the source table doesn't attribute to either." loading="lazy" decoding="async">
  </picture>
  <figcaption>Figure 3. Where the wall clock of spec 0105 went, across its five agent sessions (one initializer and four coders, claude-opus-4-8): 1,545 of 2,241 seconds were model inference and 308 seconds were tools running. The source table leaves the other 388 seconds unattributed, and its tools column sums to 307 seconds against a printed total of 308, a one-second gap the document notes it can't recheck without the transcripts. A separate count over 414 turns in runs 0097, 0105 and 0107 found no turn that issued two tool calls. Source: docs/AGENT-PERFORMANCE.md.</figcaption>
</figure>

Spec 0106 (2026-07-30) analyzed the session transcripts to determine why agent runs were slow. In spec 0105, the five sessions spent their wall clock as follows.

| Session | Wall clock | Model inference | Tools running | Inference share |
|---|---:|---:|---:|---:|
| Initializer | 555 s | 345 s | 109 s | 62% |
| Coder 1 | 658 s | 493 s | 64 s | 75% |
| Coder 2 | 228 s | 123 s | 59 s | 54% |
| Coder 3 | 418 s | 302 s | 38 s | 72% |
| Coder 4 | 382 s | 282 s | 37 s | 74% |
| **Total** | **2,241 s** | **1,545 s** | **308 s** | **69%** |

The mandated typecheck and test gate took 22 seconds, and the analysis concluded that the number of turns is what makes a session slow. Per turn, `claude-sonnet-5` took 7.8 seconds and $0.04, and `claude-opus-4-8` took 18.4 seconds and $0.12. Since sessions ran the full gate 3–7 times each, the coder prompt changed to a targeted test while iterating and one full gate before committing, and full-gate runs per session went from 4.2 to 3.0 between specs 0105 and 0107.

### A wrong explanation, and what it cost

The transcripts also showed that none of 414 turns, across runs 0097 (112 turns), 0105 (125) and 0107 (177), issued two tool calls. The analysis concluded that the Agent SDK couldn't emit parallel tool calls in this configuration, and the initializer, coder and fixer prompts were updated to tell the agents that batching wasn't available to them.

I questioned that conclusion, and a later investigation, recorded in [`docs/AGENT-TOPOLOGY.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/AGENT-TOPOLOGY.md), showed it was wrong: parallel tool use is on by default at the API level, and nothing in the stack disabled it. Logging tool names on a real coder session and a real initializer session gave 24 calls, one per turn, and 22 of the 24 were stateful (16 `Bash`, 3 `Edit`, 3 `Write`) with exactly two `Read` calls. One call per turn was the correct behavior for that workload.

`docs/AGENT-PERFORMANCE.md` and rule 5 of `docs/VERIFICATION.md` now record the correction. The three prompts still carry the earlier sentence, kept as the agents saw them, and the [setup bake-off](/research/setup-bake-off/) of 2026-09-29 ran them unchanged: the setup that ran Launchpad's prompts in a new project made no parallel calls, while plain Claude Code made 12 batches.

### The plan was the throttle

Spec 0199 changed one thing in the initializer prompt: it now stated what a checklist item costs, and that pieces touching the same files are one item. On `cafeteria`, an internal test tenant, a comparable change produced 1 plan item against 3 and 3 in the two earlier runs, 26 coder turns against 60 and 62, and 35 total session turns against 76 and 76. Gate 1 to pull request took 9 minutes and 2 seconds. The record states its own caveats next to the table: one run is not a result, and part of the drop came from spec 0005 being a slightly simpler change.

## The model I derived: Proof of Work

On 2026-09-30 I documented a development model in which every rule refers to the data above. Its name states the principle: a change is accepted on the evidence it produces. The full text is [`docs/PROOF-OF-WORK.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/PROOF-OF-WORK.md); these are its rules.

- **The unit of work is a claim.** A change starts as a list of claims, sentences that someone could verify, each with the command that verifies it and a `kind`: compile, unit, browser, journey (against a real stack) or live. A claim names an observable effect, such as "installs the module." The claim file replaces the spec, because 97% of product defects were introduced under a spec and spec review caught 1.
- **A check must be able to fail.** Before a claim counts, its check is broken on purpose and has to go red. Breaking code on purpose caught 4 defects, three by hand and a fourth on the first run of `scripts/break-check.sh`, and hand-rolled breaks failed three times in one day, so in the model a tool performs the break. I extracted that tool as [breakcheck](https://github.com/JCastrejonE/breakcheck).
- **Types prove wiring.** A new input on a boundary that a second caller might cross is a required parameter, so the compiler lists every call site that fails. With `copyProduction: boolean`, both callers of `deployBranchStagingStack` in `activities.ts` would have failed to compile. A value that is produced and never consumed is a lint error, and every new activity, route, action and workflow needs a journey test that reaches it from the outside.
- **Instruments are code.** An observation that will be made twice is a script in `scripts/` with a known-positive test.
- **Guarantees compound.** Every accepted claim stays in the suite, and every defect adds a claim. By the record's count, 108 of the 225 defects could have been caught by a behavioral check when they were introduced.
- **Mechanisms replace memory.** The record shows the optional-parameter mistake made seven times after the rule against it was documented. So a session commits at every green claim, a Stop hook refuses to end a session while the gate is red, a pre-commit hook requires a green gate, and a fresh-context reviewer checks the claims against the running system, because the author never grades its own work.
- **One human gate remains.** Promotion to production is the irreversible act, and a person decides it. A change that is irreversible, spends money, touches security or changes what the product is also gets a ten-line decision note.

Section 2 of the document compares the model with six existing ones, among them mutation testing at Google and spec-driven tools for agents. The models that combine speed with a guarantee share one property: a check that can fail independently of the author's claim, plus cheap undo.

## Discussion

The spec-first pipeline put its effort before the code (specs, tracks, handoff logs) and into a gate of tests that asserted the call the code made. The defects that mattered were caught afterward, by running the system. The model moves that effort to executable checks that run against the system before merge, and it deletes specs, `## Progress` checklists, handoff logs and the prompt lines that describe the agent's tooling.

The work has four limits.

- **The counts come from one record of one product.** One developer drove it, the tenants were internal test businesses, and the raw registry stays private. The record doesn't describe a second, independent classification of the defects.
- **The model is untested.** Section 5 of the document proposes the test: take one large change, run it under both models from the same commit with a hidden set of journey checks written beforehand and a handful of planted defects, and measure wall clock, human interventions, planted defects caught and hidden failures afterward. That experiment hasn't been run.
- **It has costs.** Journey tests need a real stack, which means CI minutes and a server; journey tests on infrastructure can be flaky, and a flaky gate gets ignored. Compile-time wiring helps typed code and does nothing for shell or SQL.
- **Two figures can't be rechecked.** The prompts give inference as "69–80%" of a session over 414 turns; `docs/AGENT-PERFORMANCE.md` notes that 69% is the total of its spec 0105 table, that no measurement behind the 80% is recorded and that the highest single session reached 75%. The same table's tools column sums to 307 seconds against a printed total of 308, and without the transcripts that gap can't be settled.

## Reproduce it

The registry, the ledger and the transcripts aren't in the snapshot, so the defect counts and the session measurements can't be recomputed. The build and the test suite were re-run from a fresh clone with these commands, using Node 24.21.0 and pnpm 9.15.0 (the repository pins pnpm 9.15.0 in `package.json` and requires Node 22 or later):

```sh
git clone https://github.com/JCastrejonE/launchpad.git
cd launchpad
export PUPPETEER_SKIP_DOWNLOAD=1
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r --no-bail test
```

Re-run on 2026-10-16 from a fresh clone at commit `46f050f`: the build passed, and the suite ran 1,909 tests with 1,874 passing, 0 failing and 35 skipped.

| Package | Tests | Pass | Skipped |
|---|---:|---:|---:|
| `packages/github` | 53 | 53 | 0 |
| `packages/agents` | 150 | 150 | 0 |
| `packages/db` | 88 | 88 | 0 |
| `packages/fleet-hostinger` | 281 | 281 | 0 |
| `packages/pipeline` | 551 | 516 | 35 |
| `apps/web` | 786 | 786 | 0 |
| **Total** | **1,909** | **1,874** | **35** |

The 35 skipped tests are Temporal workflow tests that run only with `TEMPORAL_TEST=1`, which downloads a Temporal test server. One test runs `git grep`, so the suite needs a git checkout; it fails in a copy without `.git`. The README gives the same total, 1,909 tests, and notes that 35 of them run only with `TEMPORAL_TEST=1`. Running the product itself needs Postgres, Temporal, a VPS provider account and a domain, which the snapshot doesn't provide.

## References

1. [`docs/PROOF-OF-WORK.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/PROOF-OF-WORK.md): the defect record (section 1), the comparison with existing models (section 2), the model (section 3), the families (section 4) and the proposed test (section 5). Dated 2026-09-30.
2. [`README.md`](https://github.com/JCastrejonE/launchpad/blob/main/README.md): what Launchpad was, its dates, commits, specs and test count, and why it stopped.
3. [`docs/AGENT-PERFORMANCE.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/AGENT-PERFORMANCE.md): the session wall-clock table for spec 0105, tool calls per turn, per-turn latency and the gate costs.
4. [`docs/AGENT-TOPOLOGY.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/AGENT-TOPOLOGY.md): the five agent roles, the spec 0199 measurement and the correction on parallel tool use.
5. [`docs/VERIFICATION.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/VERIFICATION.md): the 15 verification rules and the incidents behind them, including rules 12 and 14.
6. [`specs/0226-la-rama-de-pruebas-es-una-copia-neutralizada.md`](https://github.com/JCastrejonE/launchpad/blob/main/specs/0226-la-rama-de-pruebas-es-una-copia-neutralizada.md): the worked example of code that nothing could reach.
7. [`agents/initializer.md`](https://github.com/JCastrejonE/launchpad/blob/main/agents/initializer.md), [`agents/coder.md`](https://github.com/JCastrejonE/launchpad/blob/main/agents/coder.md) and [`agents/fixer.md`](https://github.com/JCastrejonE/launchpad/blob/main/agents/fixer.md): the prompts that carry the batching sentence.
8. [`docs/SETUP-BAKEOFF.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/SETUP-BAKEOFF.md) and the companion essay, [the setup bake-off](/research/setup-bake-off/).
9. [`CLAUDE.md`](https://github.com/JCastrejonE/launchpad/blob/main/CLAUDE.md) and [`docs/ARCHITECTURE.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/ARCHITECTURE.md): the spec-first rule, the two execution tracks and the pipeline's shape.
10. [breakcheck](https://github.com/JCastrejonE/breakcheck), the tool extracted from the break-the-code habit.
11. [`scripts/lint-instruments.mjs`](https://github.com/JCastrejonE/launchpad/blob/main/scripts/lint-instruments.mjs) and [`scripts/break-check.sh`](https://github.com/JCastrejonE/launchpad/blob/main/scripts/break-check.sh): the instrument lint and the break-check script, whose header comments record the incidents behind them.
12. Re-run of the build and test suite from a fresh clone, 2026-10-16, commit `46f050f`, Node 24.21.0, pnpm 9.15.0.
