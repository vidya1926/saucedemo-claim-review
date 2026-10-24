# SauceDemo UI Test Claim Review

A small, self-contained research prototype for comparing behavioral claims from two equivalent-prompt UI test generations. It includes a local visualizer, a deterministic claim analyzer, a sample SauceDemo scenario, and independent **Playwright with TypeScript** browser tests against the public SauceDemo demo site.

The analyzer is a **human-review aid**, not an automatic truth or hallucination detector. It does not call an LLM, extract claims from source code, or treat browser test outcomes as ground truth. Claim identifiers and evidence facts are supplied by the researcher. The example evidence is illustrative and must be checked against the live site before being used in research.

## Requirements

- Node.js 18 or newer
- Internet access for the live SauceDemo browser tests
- Playwright Chromium for browser tests

No production data, secrets, model API key, or external service is required to use the visualizer.

## Start the visualizer

From this folder:

```bash
npm install
npm start
```

Open [http://localhost:4173](http://localhost:4173). The page loads a bundled login example automatically. Click **E2E example** to load the paired Backpack checkout scenario, then click **Run analysis** to see the pipeline animate and the claim review queue populate. Both paired prompt sets are researcher-authored structured examples, not LLM outputs. Edit the scenario JSON to try other paired outputs, or use **Login example** to restore the login sample.

The app runs locally and its analysis is performed in the browser. The included Node server only serves these static files.

To use another port, set `PORT` before starting the app. For example, in PowerShell:

```powershell
$env:PORT = 4174
npm start
```

Playwright uses the same `PORT` value for its local visualizer tests.

## Run checks

```sh
npm test
npm run typecheck
npx playwright install chromium
npm run test:e2e
npm run test:demo
```

The Playwright tests and config are TypeScript (`tests/*.spec.ts`, `playwright.config.ts`); `npm run typecheck` checks their types. `npm test` validates the JavaScript analyzer. `npm run test:e2e` runs only the complete bag checkout scenario. `npm run test:demo` runs that test together with the other live-site and visualizer checks. Playwright writes an HTML report to `playwright-report/`; inspect it with `npx playwright show-report`. The E2E test attaches a paired-claim analysis JSON report separately from Playwright execution observations. Browser-test pass/fail is not fed to the analyzer as ground truth.

The checkout E2E covers login → add Backpack → verify cart and quantity → enter checkout details → verify order summary → finish → verify confirmation. It uses the public demo account and non-sensitive sample checkout values.

## Input format

The required JSON shape is demonstrated in `fixtures/saucedemo-login-pair.json` and `fixtures/backpack-checkout-pair.json`. The second fixture illustrates the checkout E2E scenario and explicitly states that its claim sets are researcher-authored, not LLM-generated, and that its evidence is pending independent review. Each scenario contains:

- an `id`;
- `mutation.type` set to `meaning-preserving`;
- an evidence source description and `facts` object mapping stable proposition keys to booleans;
- exactly two runs with prompt text and claim arrays;
- each claim has an id, shared semantic proposition key, and boolean expected outcome.

Proposition keys must use lowercase letters, numbers, dots, underscores, or hyphens, with no surrounding whitespace. A run may contain only one claim for each proposition. The analyzer compares claims with the same proposition key; it does not understand free-text prompts or infer semantic equivalence. Researchers must review the prompt pair and map claims correctly. One-sided proposition coverage is surfaced as a warning and review-queue item. Identical prompts and runs without claims also produce warnings rather than clean comparison results.

## Interpretation

- **Paired runs disagree:** the equivalent-prompt outputs expect different outcomes for the same claim; investigate it.
- **Conflicts with supplied evidence:** at least one generated expectation differs from the supplied fact; verify both the claim mapping and the evidence source.
- **Not found in supplied evidence:** the provided facts cannot verify this claim; this does not mean the claim is false.
- **Browser test passes/fails:** useful execution information, but not proof that the expectation is correct or incorrect.

The result is a review queue, not a declaration of hallucination. The evidence catalog can be wrong or incomplete. There are no empirical precision/recall results until the system is evaluated against an independently reviewed labeled dataset.

The current prototype schema stores evidence as boolean facts plus one source description. It does not yet enforce per-fact observation metadata, record human adjudication labels or reviewer identity, preserve LLM generation provenance, batch scenarios, or compute evaluation metrics. These are research-workflow tasks that must be completed before an empirical detector evaluation; the current JSON examples and software tests are not such an evaluation.
