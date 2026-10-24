# Standalone SauceDemo Research Prototype

## Purpose

Build an independently runnable research prototype that helps a reviewer investigate behavioral claims in AI-generated UI tests. Use the public SauceDemo demo website as the example application. The project must live and run from this folder without importing source code, configuration, credentials, fixtures, or dependencies from another project.

## Functional requirements

1. Accept one scenario containing an original prompt run and a meaning-preserving reworded prompt run.
2. Accept researcher-supplied behavioral claims with stable proposition identifiers and expected boolean outcomes.
3. Compare the paired runs for opposite expectations about the same proposition.
4. Compare every claim with explicitly supplied evidence facts; distinguish matching, contradicting, and missing evidence.
5. Place inconsistencies, evidence conflicts, and absent evidence in a human-review queue. Never issue an automatic “hallucination” verdict.
6. Provide a local web visualizer that displays the analysis pipeline, run inputs, claim comparisons, evidence assessments, and review queue.
7. Include a sample SauceDemo login scenario and standalone Playwright TypeScript browser checks for login, cart changes, sorting, and a complete bag-purchase checkout E2E.
8. Run with Node.js and documented setup commands. No account credentials, production data, or LLM API key is required.

## Non-functional and research safeguards

- The claim analyzer is deterministic and makes no network requests.
- The visualizer must state that absent evidence is not proof of falsity.
- The SauceDemo sample evidence is illustrative until independently checked and documented.
- Browser test pass/fail is not used by the analyzer as ground truth.
- The test scenario requires exactly two runs; prompt equivalence and claim mapping are researcher-reviewed inputs.
- The project must be self-contained under this folder.

## Acceptance checks

- `npm test` passes the analyzer tests.
- `npm run typecheck` passes for the Playwright TypeScript tests and configuration.
- `npm run start` serves the visualizer locally.
- The visualizer can load both the login pair and bag-checkout E2E pair.
- `npm run test:demo` runs SauceDemo browser and visualizer checks when the public website and Playwright Chromium are reachable.
- The example produces a review item for the contradictory locked-out login claim and a separate item for a claim missing from evidence.
