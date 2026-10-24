const INTERPRETATION =
  'Review queue items are leads for human investigation, not automatic judgments of truth. ' +
  'Prompt inconsistency is not proof of hallucination, supplied evidence may be incomplete or wrong, ' +
  'and browser-test pass/fail is not used as ground truth.';

function requireNonEmptyString(value, description) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${description} must be a non-empty string.`);
  }
}

function validateScenario(scenario) {
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    throw new Error('Scenario must be a JSON object.');
  }
  requireNonEmptyString(scenario.id, 'Scenario id');

  if (!scenario.mutation || scenario.mutation.type !== 'meaning-preserving') {
    throw new Error('Scenario mutation.type must be "meaning-preserving".');
  }
  if (!scenario.evidence || typeof scenario.evidence !== 'object' ||
      !scenario.evidence.source || typeof scenario.evidence.source !== 'object' ||
      !scenario.evidence.facts || typeof scenario.evidence.facts !== 'object' ||
      Array.isArray(scenario.evidence.facts)) {
    throw new Error('Scenario must include evidence.source and an evidence.facts object.');
  }
  requireNonEmptyString(scenario.evidence.source.type, 'Evidence source type');
  requireNonEmptyString(scenario.evidence.source.description, 'Evidence source description');

  if (!Array.isArray(scenario.runs) || scenario.runs.length !== 2) {
    throw new Error('Scenario must contain exactly two paired runs.');
  }

  const runIds = new Set();
  for (const run of scenario.runs) {
    if (!run || typeof run !== 'object' || Array.isArray(run)) {
      throw new Error('Each run must be an object.');
    }
    requireNonEmptyString(run.id, 'Run id');
    if (runIds.has(run.id)) {
      throw new Error(`Run id "${run.id}" is duplicated.`);
    }
    runIds.add(run.id);
    requireNonEmptyString(run.prompt, `Prompt for run "${run.id}"`);
    if (!Array.isArray(run.claims)) {
      throw new Error(`Run "${run.id}" must include a claims array.`);
    }

    const claimIds = new Set();
    for (const claim of run.claims) {
      if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
        throw new Error(`Each claim in run "${run.id}" must be an object.`);
      }
      requireNonEmptyString(claim.id, `Claim id in run "${run.id}"`);
      if (claimIds.has(claim.id)) {
        throw new Error(`Claim id "${claim.id}" is duplicated in run "${run.id}".`);
      }
      claimIds.add(claim.id);
      requireNonEmptyString(claim.proposition, `Proposition for claim "${claim.id}"`);
      if (typeof claim.expected !== 'boolean') {
        throw new Error(`Claim "${claim.id}" expected value must be boolean.`);
      }
    }
  }

  for (const [proposition, value] of Object.entries(scenario.evidence.facts)) {
    if (typeof value !== 'boolean') {
      throw new Error(`Ground-truth fact "${proposition}" must be boolean.`);
    }
  }
}

function analyzeScenario(scenario) {
  validateScenario(scenario);

  const claimsByProposition = new Map();
  const analyzedClaims = [];
  for (const run of scenario.runs) {
    for (const claim of run.claims) {
      const records = claimsByProposition.get(claim.proposition) || [];
      records.push({
        runId: run.id,
        claimId: claim.id,
        expected: claim.expected,
      });
      claimsByProposition.set(claim.proposition, records);

      const hasEvidence = Object.hasOwn(scenario.evidence.facts, claim.proposition);
      const evidenceValue = hasEvidence ? scenario.evidence.facts[claim.proposition] : null;
      analyzedClaims.push({
        runId: run.id,
        claimId: claim.id,
        proposition: claim.proposition,
        expected: claim.expected,
        suppliedEvidence: evidenceValue,
        evidenceAssessment: !hasEvidence
          ? 'not_found_in_supplied_evidence'
          : claim.expected === evidenceValue
            ? 'matches_supplied_evidence'
            : 'contradicts_supplied_evidence',
      });
    }
  }

  const inconsistentPropositions = new Set();
  const contradictions = [];
  for (const [proposition, claims] of claimsByProposition.entries()) {
    if (claims.length > 1 && new Set(claims.map((claim) => claim.expected)).size > 1) {
      inconsistentPropositions.add(proposition);
      contradictions.push({ proposition, claims });
    }
  }

  const reviewQueue = [];
  for (const [proposition, claims] of claimsByProposition.entries()) {
    const reasons = [];
    if (inconsistentPropositions.has(proposition)) {
      reasons.push('paired_runs_disagree');
    }
    const suppliedEvidence = Object.hasOwn(scenario.evidence.facts, proposition)
      ? scenario.evidence.facts[proposition]
      : null;
    if (suppliedEvidence === null) {
      reasons.push('not_found_in_supplied_evidence');
    } else if (claims.some((claim) => claim.expected !== suppliedEvidence)) {
      reasons.push('claim_conflicts_with_supplied_evidence');
    }
    if (reasons.length) {
      reviewQueue.push({
        proposition,
        claims,
        suppliedEvidence,
        reasons,
      });
    }
  }

  return {
    scenarioId: scenario.id,
    mutation: scenario.mutation,
    evidenceSource: scenario.evidence.source,
    pairConsistency: {
      status: contradictions.length ? 'inconsistency_detected' : 'no_pair_disagreement_detected',
      contradictions,
    },
    claims: analyzedClaims,
    reviewQueue,
    interpretation: INTERPRETATION,
  };
}

function formatReport(report) {
  const lines = [
    `Scenario: ${report.scenarioId}`,
    `Paired-run consistency: ${report.pairConsistency.status.replaceAll('_', ' ')}`,
    `Evidence source: ${report.evidenceSource.type} - ${report.evidenceSource.description}`,
    '',
    `Review queue (${report.reviewQueue.length} item(s)):`,
  ];

  if (!report.reviewQueue.length) {
    lines.push('  No claims were flagged by the configured checks.');
  } else {
    for (const item of report.reviewQueue) {
      const expectations = item.claims
        .map((claim) => `${claim.runId}/${claim.claimId} expects ${claim.expected}`)
        .join('; ');
      const evidence = item.suppliedEvidence === null
        ? 'no matching fact in supplied evidence'
        : `supplied fact=${item.suppliedEvidence}`;
      lines.push(`  - ${item.proposition}`);
      lines.push(`    Reasons: ${item.reasons.join(', ')}`);
      lines.push(`    Claims: ${expectations}`);
      lines.push(`    Evidence: ${evidence}`);
    }
  }

  lines.push('', report.interpretation);
  return lines.join('\n');
}

module.exports = { analyzeScenario, formatReport, validateScenario };
