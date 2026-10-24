const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { analyzeScenario } = require('../../src/analyzer');

const fixturePath = path.join(__dirname, '../../fixtures/backpack-checkout-pair.json');
const scenario = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test('checkout fixture clearly identifies example claims and pending evidence', () => {
  const report = analyzeScenario(scenario);

  assert.equal(scenario.studyNote.claimProvenance.includes('not outputs from an LLM'), true);
  assert.match(scenario.studyNote.evidenceStatus, /Pending independent evidence review/);
  assert.deepEqual(scenario.evidence.facts, {});
  assert.equal(report.pairConsistency.status, 'no_pair_disagreement_detected');
  assert.equal(report.claims.length, 10);
});

test('claims matching synthetic reviewed facts are not queued for missing evidence', () => {
  const scenarioWithSyntheticFacts = structuredClone(scenario);
  scenarioWithSyntheticFacts.evidence.facts = Object.fromEntries(
    scenario.runs[0].claims.map((claim) => [claim.proposition, true]),
  );

  const report = analyzeScenario(scenarioWithSyntheticFacts);
  assert.equal(report.reviewQueue.length, 0);
});

test('simulated opposite checkout claim becomes a review signal, not a truth verdict', () => {
  const changedPair = structuredClone(scenario);
  changedPair.runs[1].claims.find(
    (claim) => claim.proposition === 'checkout.order_confirmation.is_visible',
  ).expected = false;

  const report = analyzeScenario(changedPair);
  const confirmationItem = report.reviewQueue.find(
    (item) => item.proposition === 'checkout.order_confirmation.is_visible',
  );

  assert.equal(report.pairConsistency.status, 'inconsistency_detected');
  assert.ok(confirmationItem.reasons.includes('paired_runs_disagree'));
  assert.ok(confirmationItem.reasons.includes('not_found_in_supplied_evidence'));
  assert.match(report.interpretation, /not automatic judgments of truth/);
});
