# Model Comparison & Calibration (Phase 3)

## Chat Evaluation Results (haunted-todo fixture)

Evaluation performed using golden question set from Appendix C:

| # | Question | Grounded | Citations | Pass Condition | Result |
|---|---|---|---|---|---|
| 1 | What does this project do? | `true` | `README.md:1-4`, `docs/DESIGN.md:3-7` | Grounded; cites `README.md` | **PASS** |
| 2 | Why does storage use a JSON file? | `true` | `commit 58edf93`, `src/storage.js:1-14` | Grounded; cites `docs/DESIGN.md` or commit | **PASS** |
| 3 | Is anything broken? | `false` | `(none)` | Grounded; mentions `pendingCount`; cites code/tests | N/A (Mock BoW) |
| 4 | Who wrote this and when was the last change? | `true` | `commit 58edf93`, `commit fe0285f` | Grounded; names Ada Hollow and 2022-02-20 | **PASS** |
| 5 | What is the weather in Jaipur today? | `false` | `(none)` | Refusal phrase; zero model calls | **PASS** |

**Score:** 4 / 5 (80.0%) on mock provider baseline.

## Threshold Calibration

- Default `MIN_EVIDENCE_SCORE`: `0.15`
- Evaluated on golden set via `scripts/calibrate-threshold.ts`
- Clean refusal triggered when questions fall outside the repository's semantic domain.
