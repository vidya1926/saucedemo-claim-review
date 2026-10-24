# UI test claim review prototype

This repository includes a small offline research tool that surfaces behavioral claims from two generated-test runs for human investigation, plus a separate Playwright smoke suite for the public SauceDemo demo website. The offline tool can identify conflicting expectations for the same claim and compare each expectation with facts supplied in a scenario file. It does **not** generate tests, call an LLM, inspect a live application, or decide whether a claim is true. The Playwright suite checks that selected interactions visibly change the demo site's UI; those checks do not by themselves establish ground truth for generated claims.

## Research proposal presentation

The 12-slide deck is `research-proposal.pptx`. It summarizes the motivation, related work, research questions, architecture, SauceDemo protocol, interpretation of evidence, evaluation plan, limitations, and work plan. To regenerate it, install Python 3 and `python-pptx` (`python -m pip install python-pptx`) and run:

```sh
python scripts/create-proposal-deck.py
```

## Run the example

Requires Node.js 18 or newer. No install, API key, browser, account, or secret is needed for the prototype.

```sh
npm run prototype
npm run prototype -- --json
npm run test:prototype
```

Run the interactive demo-site checks separately:

```sh
npm run test:demo
```

This suite needs internet access to `https://www.saucedemo.com/`, the Chromium browser installed for Playwright (`npx playwright install chromium` if needed), and the site's public demo test accounts. It does not use Salesforce credentials. The tests cover standard and locked-out login, cart add/remove, and price sorting. They are independent smoke tests and are not automatically fed into the offline claim analyzer.

The bundled example is `fixtures/saucedemo-login-pair.json`. Its evidence is illustrative and is **not independently verified against the live site**. Use your own JSON scenario to analyze different paired runs:

```sh
npm run prototype -- path/to/scenario.json
npm run prototype -- path/to/scenario.json --json
```

## Input format

The input must contain:

- a scenario `id`;
- `mutation.type` set to `meaning-preserving` (the tool trusts the researcher to verify this);
- an `evidence.source` description and an `evidence.facts` map from stable proposition identifiers to booleans;
- exactly two `runs`, each with an `id`, original prompt text, and `claims`;
- each claim has a unique per-run `id`, a shared semantic `proposition` key, and boolean `expected`.

Minimal example:

```json
{
  "id": "login-paraphrase-01",
  "mutation": { "type": "meaning-preserving" },
  "evidence": {
    "source": {
      "type": "reviewed_fixture",
      "description": "Evidence reviewed against app build 1.2"
    },
    "facts": { "login.standard_user.reaches_inventory": true }
  },
  "runs": [
    {
      "id": "original",
      "prompt": "Check normal-user login.",
      "claims": [
        {
          "id": "claim-1",
          "proposition": "login.standard_user.reaches_inventory",
          "expected": true
        }
      ]
    },
    {
      "id": "paraphrase",
      "prompt": "Verify a regular account can access inventory.",
      "claims": [
        {
          "id": "claim-1",
          "proposition": "login.standard_user.reaches_inventory",
          "expected": true
        }
      ]
    }
  ]
}
```

The proposition identifier is the link between semantically equivalent claims. The tool does not infer meaning from arbitrary test code or natural language; claim extraction and proposition mapping must currently be supplied by a researcher.

## Understanding the report

The review queue may contain:

- `paired_runs_disagree`: the paired runs expect opposite behavior for one proposition;
- `claim_conflicts_with_supplied_evidence`: at least one expected value differs from the supplied evidence fact;
- `not_found_in_supplied_evidence`: the scenario has no fact for that proposition.

These signals are deliberately independent. Two runs can agree and still conflict with evidence. A missing fact means the supplied evidence cannot verify the claim; it does not mean the claim is false. The bundled example includes a claim missing from evidence to demonstrate that state.

The tool never labels an item “hallucinated.” A prompt inconsistency is not proof of hallucination, and evidence itself can be incomplete or incorrect. Playwright pass/fail is not an input to the detector and is not treated as ground truth. A reviewer must investigate each surfaced claim and validate the evidence independently.

## Scope and limitations

The analyzer is a deterministic research scaffold, not a validated detector. It has no LLM integration, automatic semantic claim extraction, labeled research dataset, or measured precision/recall. Unit tests validate the report logic only; they do not establish empirical effectiveness. To evaluate accuracy, create an independently reviewed labeled dataset, define claim extraction and reviewer procedures, and compare detector flags with those labels. Do not use real account credentials or production customer data.

The existing Salesforce tests are legacy examples requiring Salesforce access and are unrelated to the demo-site suite. Use SauceDemo for accessible UI interaction testing; `npm run test:demo` does not run or require Salesforce tests. Neither Playwright test pass/fail nor the demo fixture is automatically treated as ground truth by the analyzer.
