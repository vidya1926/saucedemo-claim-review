(function initializeAnalyzer(root, createAnalyzer) {
  const api = createAnalyzer();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ClaimReviewAnalyzer = api;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createAnalyzer() {
  const INTERPRETATION =
    'Review queue items are leads for human investigation, not automatic judgments of truth. ' +
    'Prompt inconsistency is not proof of hallucination, supplied evidence may be incomplete or wrong, ' +
    'and browser-test pass/fail is not used as ground truth.';

  function requireText(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${label} must be a non-empty string.`);
    }
  }

  function requirePropositionKey(value, label) {
    requireText(value, label);
    if (value !== value.trim() || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)) {
      throw new Error(`${label} must use lowercase letters, numbers, dots, underscores, or hyphens.`);
    }
  }

  function validateScenario(scenario) {
    if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
      throw new Error('Scenario must be a JSON object.');
    }
    requireText(scenario.id, 'Scenario id');

    if (!scenario.mutation || scenario.mutation.type !== 'meaning-preserving') {
      throw new Error('Mutation type must be "meaning-preserving".');
    }
    if (!scenario.evidence || typeof scenario.evidence !== 'object' ||
        !scenario.evidence.source || typeof scenario.evidence.source !== 'object' ||
        !scenario.evidence.facts || typeof scenario.evidence.facts !== 'object' ||
        Array.isArray(scenario.evidence.facts)) {
      throw new Error('Scenario must include evidence.source and an evidence.facts object.');
    }
    requireText(scenario.evidence.source.type, 'Evidence source type');
    requireText(scenario.evidence.source.description, 'Evidence source description');
    for (const [key, value] of Object.entries(scenario.evidence.facts)) {
      requirePropositionKey(key, `Evidence fact key "${key}"`);
      if (typeof value !== 'boolean') {
        throw new Error(`Evidence fact "${key}" must be boolean.`);
      }
    }

    if (!Array.isArray(scenario.runs) || scenario.runs.length !== 2) {
      throw new Error('Scenario must contain exactly two paired runs.');
    }

    const runIds = new Set();
    for (const run of scenario.runs) {
      if (!run || typeof run !== 'object' || Array.isArray(run)) {
        throw new Error('Each run must be an object.');
      }
      requireText(run.id, 'Run id');
      if (runIds.has(run.id)) {
        throw new Error(`Run id "${run.id}" is duplicated.`);
      }
      runIds.add(run.id);
      requireText(run.prompt, `Prompt for run "${run.id}"`);
      if (!Array.isArray(run.claims)) {
        throw new Error(`Run "${run.id}" must include a claims array.`);
      }

      const claimIds = new Set();
      const propositions = new Set();
      for (const claim of run.claims) {
        if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
          throw new Error(`Each claim in run "${run.id}" must be an object.`);
        }
        requireText(claim.id, `Claim id in run "${run.id}"`);
        if (claimIds.has(claim.id)) {
          throw new Error(`Claim id "${claim.id}" is duplicated in run "${run.id}".`);
        }
        claimIds.add(claim.id);
        requirePropositionKey(claim.proposition, `Proposition for claim "${claim.id}"`);
        if (propositions.has(claim.proposition)) {
          throw new Error(
            `Run "${run.id}" has multiple claims for proposition "${claim.proposition}".`,
          );
        }
        propositions.add(claim.proposition);
        if (typeof claim.expected !== 'boolean') {
          throw new Error(`Claim "${claim.id}" expected value must be boolean.`);
        }
      }
    }
  }

  function analyzeScenario(scenario) {
    validateScenario(scenario);
    const byProposition = new Map();
    const claims = [];
    const warnings = [];
    const [runA, runB] = scenario.runs;

    if (runA.prompt.trim() === runB.prompt.trim()) {
      warnings.push({
        code: 'identical_prompts',
        message: 'Both runs use identical prompt text; this is not a prompt mutation.',
        runIds: [runA.id, runB.id],
      });
    }
    for (const run of scenario.runs) {
      if (run.claims.length === 0) {
        warnings.push({
          code: 'run_without_claims',
          message: `Run "${run.id}" contains no behavioral claims.`,
          runId: run.id,
        });
      }
    }

    for (const run of scenario.runs) {
      for (const claim of run.claims) {
        const records = byProposition.get(claim.proposition) || {};
        records[run.id] = {
          runId: run.id,
          claimId: claim.id,
          expected: claim.expected,
        };
        byProposition.set(claim.proposition, records);

        const hasEvidence = Object.hasOwn(scenario.evidence.facts, claim.proposition);
        const suppliedEvidence = hasEvidence
          ? scenario.evidence.facts[claim.proposition]
          : null;
        claims.push({
          runId: run.id,
          claimId: claim.id,
          proposition: claim.proposition,
          expected: claim.expected,
          suppliedEvidence,
          evidenceAssessment: !hasEvidence
            ? 'not_found_in_supplied_evidence'
            : claim.expected === suppliedEvidence
              ? 'matches_supplied_evidence'
              : 'contradicts_supplied_evidence',
        });
      }
    }

    const contradictions = [];
    const coverageGaps = [];
    const reviewQueue = [];
    for (const [proposition, claimsByRun] of byProposition.entries()) {
      const records = Object.values(claimsByRun);
      const claimA = claimsByRun[runA.id];
      const claimB = claimsByRun[runB.id];
      const disagrees = Boolean(claimA && claimB && claimA.expected !== claimB.expected);
      const missingRun = !claimA ? runA : !claimB ? runB : null;
      if (missingRun) {
        const gap = {
          proposition,
          presentInRun: claimA ? runA.id : runB.id,
          missingFromRun: missingRun.id,
        };
        coverageGaps.push(gap);
        warnings.push({
          code: 'claim_missing_from_paired_run',
          message: `Proposition "${proposition}" is missing from run "${missingRun.id}".`,
          ...gap,
        });
      }
      if (disagrees) {
        contradictions.push({ proposition, claims: records });
      }

      const hasEvidence = Object.hasOwn(scenario.evidence.facts, proposition);
      const suppliedEvidence = hasEvidence ? scenario.evidence.facts[proposition] : null;
      const reasons = [];
      if (disagrees) {
        reasons.push('paired_runs_disagree');
      }
      if (missingRun) {
        reasons.push('claim_missing_from_paired_run');
      }
      if (!hasEvidence) {
        reasons.push('not_found_in_supplied_evidence');
      } else if (records.some((record) => record.expected !== suppliedEvidence)) {
        reasons.push('claim_conflicts_with_supplied_evidence');
      }
      if (reasons.length) {
        reviewQueue.push({ proposition, claims: records, suppliedEvidence, reasons });
      }
    }

    return {
      scenarioId: scenario.id,
      mutation: scenario.mutation,
      evidenceSource: scenario.evidence.source,
      pairConsistency: {
        status: contradictions.length
          ? 'inconsistency_detected'
          : scenario.runs.some((run) => run.claims.length === 0)
            ? 'insufficient_claims'
            : coverageGaps.length
              ? 'coverage_gap_detected'
              : 'no_pair_disagreement_detected',
        contradictions,
        coverageGaps,
      },
      warnings,
      claims,
      reviewQueue,
      interpretation: INTERPRETATION,
    };
  }

  return { analyzeScenario, validateScenario };
});
