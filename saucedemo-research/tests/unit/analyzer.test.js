const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { analyzeScenario } = require('../../src/analyzer');

const scenarioPath = path.join(__dirname, '../../fixtures/saucedemo-login-pair.json');
const example = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));

test('detects paired disagreement and evidence conflict as review signals', () => {
  const report = analyzeScenario(example);
  const item = report.reviewQueue.find(
    (entry) => entry.proposition === 'login.locked_out_user.reaches_inventory',
  );

  assert.equal(report.pairConsistency.status, 'inconsistency_detected');
  assert.ok(item.reasons.includes('paired_runs_disagree'));
  assert.ok(item.reasons.includes('claim_conflicts_with_supplied_evidence'));
  assert.equal(item.suppliedEvidence, false);
});

test('reports absent facts separately without asserting the claim is false', () => {
  const report = analyzeScenario(example);
  const item = report.reviewQueue.find(
    (entry) => entry.proposition === 'inventory.empty_cart_badge.is_hidden',
  );

  assert.ok(item.reasons.includes('not_found_in_supplied_evidence'));
  assert.equal(item.suppliedEvidence, null);
  assert.match(report.interpretation, /not automatic judgments of truth/);
});

test('agreement does not prove correctness when both runs contradict evidence', () => {
  const scenario = structuredClone(example);
  scenario.runs[0].claims = scenario.runs[0].claims.filter(
    (claim) => claim.id !== 'empty-cart-badge',
  );
  scenario.runs[0].claims.find((claim) => claim.id === 'locked-login').expected = true;
  const report = analyzeScenario(scenario);
  const item = report.reviewQueue.find(
    (entry) => entry.proposition === 'login.locked_out_user.reaches_inventory',
  );

  assert.equal(report.pairConsistency.status, 'no_pair_disagreement_detected');
  assert.deepEqual(item.reasons, ['claim_conflicts_with_supplied_evidence']);
});

test('does not flag paired agreement that matches the supplied fact', () => {
  const scenario = structuredClone(example);
  scenario.runs[1].claims.find((claim) => claim.id === 'locked-account').expected = false;
  const report = analyzeScenario(scenario);

  assert.equal(
    report.reviewQueue.some(
      (item) => item.proposition === 'login.locked_out_user.reaches_inventory',
    ),
    false,
  );
});

test('rejects invalid pair shape and malformed evidence', () => {
  assert.throws(
    () => analyzeScenario({ ...example, runs: [example.runs[0]] }),
    /exactly two paired runs/,
  );
  const invalid = structuredClone(example);
  invalid.evidence.facts['login.standard_user.reaches_inventory'] = 'yes';
  assert.throws(() => analyzeScenario(invalid), /must be boolean/);
});

test('rejects proposition keys with whitespace or inconsistent casing', () => {
  const invalid = structuredClone(example);
  invalid.runs[0].claims[0].proposition = 'Login.standard_user.reaches_inventory';
  assert.throws(() => analyzeScenario(invalid), /lowercase letters/);

  invalid.runs[0].claims[0].proposition = 'login.standard_user.reaches_inventory ';
  assert.throws(() => analyzeScenario(invalid), /lowercase letters/);
});

test('rejects repeated propositions within one run instead of comparing them as a pair', () => {
  const invalid = structuredClone(example);
  invalid.runs[0].claims.push({
    id: 'duplicate-standard-login',
    proposition: 'login.standard_user.reaches_inventory',
    expected: false,
  });
  assert.throws(() => analyzeScenario(invalid), /multiple claims for proposition/);
});

test('reports one-sided proposition coverage as a warning and review signal', () => {
  const scenario = structuredClone(example);
  scenario.runs[0].claims = scenario.runs[0].claims.filter(
    (claim) => claim.id !== 'locked-login',
  );
  scenario.runs[1].claims = scenario.runs[1].claims.filter(
    (claim) => claim.id !== 'locked-account',
  );
  const report = analyzeScenario(scenario);
  const item = report.reviewQueue.find(
    (entry) => entry.proposition === 'inventory.empty_cart_badge.is_hidden',
  );

  assert.equal(report.pairConsistency.status, 'coverage_gap_detected');
  assert.deepEqual(report.pairConsistency.coverageGaps[0], {
    proposition: 'inventory.empty_cart_badge.is_hidden',
    presentInRun: 'original-prompt',
    missingFromRun: 'reworded-prompt',
  });
  assert.ok(item.reasons.includes('claim_missing_from_paired_run'));
  assert.ok(report.warnings.some((warning) => warning.code === 'claim_missing_from_paired_run'));
});

test('warns when prompts are identical and both runs contain no claims', () => {
  const empty = structuredClone(example);
  empty.runs.forEach((run) => {
    run.prompt = 'Check the same behavior.';
    run.claims = [];
  });

  const report = analyzeScenario(empty);
  assert.equal(report.pairConsistency.status, 'insufficient_claims');
  assert.deepEqual(
    report.warnings.map((warning) => warning.code),
    ['identical_prompts', 'run_without_claims', 'run_without_claims'],
  );
  assert.equal(report.reviewQueue.length, 0);
});

test('warns when only one run contains claims', () => {
  const sparse = structuredClone(example);
  sparse.runs[1].claims = [];

  const report = analyzeScenario(sparse);
  assert.equal(report.pairConsistency.status, 'insufficient_claims');
  assert.ok(report.warnings.some((warning) => warning.code === 'run_without_claims'));
  assert.ok(report.warnings.some((warning) => warning.code === 'claim_missing_from_paired_run'));
});
