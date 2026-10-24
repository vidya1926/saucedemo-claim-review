const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { analyzeScenario, formatReport } = require('../../src/prototype/analyzer');

const examplePath = path.resolve(__dirname, '../../fixtures/saucedemo-login-pair.json');
const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

test('flags prompt disagreement and evidence conflict as separate reasons', () => {
  const report = analyzeScenario(example);
  const lockedAccount = report.reviewQueue.find(
    (item) => item.proposition === 'login.locked_out_user.reaches_inventory',
  );

  assert.equal(report.pairConsistency.status, 'inconsistency_detected');
  assert.ok(lockedAccount.reasons.includes('paired_runs_disagree'));
  assert.ok(lockedAccount.reasons.includes('claim_conflicts_with_supplied_evidence'));
  assert.equal(lockedAccount.suppliedEvidence, false);
});

test('flags claims missing from evidence as unresolved review items', () => {
  const report = analyzeScenario(example);
  const unverifiedClaim = report.reviewQueue.find(
    (item) => item.proposition === 'inventory.cart_counter.starts_at_zero',
  );

  assert.ok(unverifiedClaim);
  assert.deepEqual(unverifiedClaim.reasons, ['not_found_in_supplied_evidence']);
  assert.equal(unverifiedClaim.suppliedEvidence, null);
});

test('does not treat agreeing runs as correct when supplied evidence contradicts both', () => {
  const scenario = structuredClone(example);
  scenario.runs[0].claims.find((claim) => claim.id === 'locked-user').expected = true;

  const report = analyzeScenario(scenario);
  const lockedAccount = report.reviewQueue.find(
    (item) => item.proposition === 'login.locked_out_user.reaches_inventory',
  );

  assert.equal(report.pairConsistency.status, 'no_pair_disagreement_detected');
  assert.deepEqual(lockedAccount.reasons, ['claim_conflicts_with_supplied_evidence']);
});

test('does not flag agreement when evidence supports the shared claim', () => {
  const scenario = structuredClone(example);
  scenario.runs[1].claims.find((claim) => claim.id === 'locked-account').expected = false;

  const report = analyzeScenario(scenario);

  assert.equal(report.pairConsistency.status, 'no_pair_disagreement_detected');
  assert.equal(
    report.reviewQueue.some((item) => item.proposition === 'login.locked_out_user.reaches_inventory'),
    false,
  );
});

test('rejects invalid scenario shape and non-boolean evidence', () => {
  assert.throws(() => analyzeScenario({ ...example, runs: [example.runs[0]] }), /exactly two paired runs/);

  const invalidEvidence = structuredClone(example);
  invalidEvidence.evidence.facts['login.standard_user.reaches_inventory'] = 'yes';
  assert.throws(() => analyzeScenario(invalidEvidence), /must be boolean/);
});

test('report clearly describes findings as items for human review', () => {
  const report = formatReport(analyzeScenario(example));

  assert.match(report, /Review queue/);
  assert.match(report, /not automatic judgments of truth/);
  assert.match(report, /not used as ground truth/);
});
