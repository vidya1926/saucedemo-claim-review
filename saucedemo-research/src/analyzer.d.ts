export interface ScenarioClaim {
  id: string;
  proposition: string;
  expected: boolean;
}

export interface ScenarioRun {
  id: string;
  prompt: string;
  claims: ScenarioClaim[];
}

export interface Scenario {
  id: string;
  target?: {
    name: string;
    url: string;
  };
  studyNote?: {
    claimProvenance: string;
    evidenceStatus: string;
  };
  mutation: {
    type: 'meaning-preserving';
    description?: string;
  };
  evidence: {
    source: {
      type: string;
      description: string;
    };
    facts: Record<string, boolean>;
  };
  runs: [ScenarioRun, ScenarioRun];
}

export interface AnalyzedClaim extends ScenarioClaim {
  runId: string;
  suppliedEvidence: boolean | null;
  evidenceAssessment:
    | 'not_found_in_supplied_evidence'
    | 'matches_supplied_evidence'
    | 'contradicts_supplied_evidence';
}

export interface ReviewQueueItem {
  proposition: string;
  claims: Array<Pick<ScenarioClaim, 'id' | 'expected'> & { runId: string }>;
  suppliedEvidence: boolean | null;
  reasons: Array<
    | 'paired_runs_disagree'
    | 'claim_missing_from_paired_run'
    | 'not_found_in_supplied_evidence'
    | 'claim_conflicts_with_supplied_evidence'
  >;
}

export interface AnalysisReport {
  scenarioId: string;
  mutation: Scenario['mutation'];
  evidenceSource: Scenario['evidence']['source'];
  pairConsistency: {
    status:
      | 'inconsistency_detected'
      | 'coverage_gap_detected'
      | 'insufficient_claims'
      | 'no_pair_disagreement_detected';
    contradictions: Array<{
      proposition: string;
      claims: Array<Pick<ScenarioClaim, 'id' | 'expected'> & { runId: string }>;
    }>;
    coverageGaps: Array<{
      proposition: string;
      presentInRun: string;
      missingFromRun: string;
    }>;
  };
  warnings: Array<{
    code: 'identical_prompts' | 'run_without_claims' | 'claim_missing_from_paired_run';
    message: string;
    runId?: string;
    proposition?: string;
    presentInRun?: string;
    missingFromRun?: string;
    runIds?: [string, string];
  }>;
  claims: AnalyzedClaim[];
  reviewQueue: ReviewQueueItem[];
  interpretation: string;
}

export function analyzeScenario(scenario: Scenario): AnalysisReport;
export function validateScenario(scenario: unknown): asserts scenario is Scenario;
