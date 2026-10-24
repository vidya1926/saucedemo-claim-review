(function startVisualizer() {
  const loginExampleUrl = '/fixtures/saucedemo-login-pair.json';
  const e2eExampleUrl = '/fixtures/backpack-checkout-pair.json';
  const textarea = document.querySelector('#scenario-json');
  const runButton = document.querySelector('#run-analysis');
  const loadExampleButton = document.querySelector('#load-example');
  const loadE2eExampleButton = document.querySelector('#load-e2e-example');
  const importFile = document.querySelector('#import-file');
  const errorBanner = document.querySelector('#error-banner');
  const jsonStatus = document.querySelector('#json-status');
  const activityLog = document.querySelector('#activity-log');
  const resultState = document.querySelector('#result-state');
  const reportGrid = document.querySelector('#report-grid');
  const claimsBody = document.querySelector('#claims-body');
  const claimCount = document.querySelector('#claim-count');
  const reviewQueue = document.querySelector('#review-queue');
  const queueCount = document.querySelector('#queue-count');
  const scenarioWarnings = document.querySelector('#scenario-warnings');
  const interpretation = document.querySelector('#interpretation');
  const stepNames = ['parse', 'normalize', 'compare', 'ground', 'review'];
  let currentReport = null;
  let animationToken = 0;

  function setExampleText(scenario) {
    textarea.value = `${JSON.stringify(scenario, null, 2)}\n`;
    jsonStatus.textContent = 'Example loaded';
    errorBanner.hidden = true;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
    jsonStatus.textContent = 'Invalid JSON';
  }

  function resetPipeline() {
    document.querySelectorAll('.pipeline-step').forEach((step) => {
      step.classList.remove('active', 'done');
      step.querySelector('.step-status').textContent = 'Waiting';
    });
    document.querySelectorAll('.pipeline-connector').forEach((connector) => {
      connector.classList.remove('done');
    });
  }

  function addLog(message) {
    const placeholder = activityLog.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `<span class="log-ok">✓</span>${escapeHtml(message)}`;
    activityLog.append(line);
  }

  function valueTag(value) {
    if (value === null) return '<span class="value-tag">missing</span>';
    return `<span class="value-tag ${value ? 'true' : 'false'}">${value}</span>`;
  }

  function renderClaims(scenario, report) {
    const propositionSet = new Set(report.claims.map((claim) => claim.proposition));
    const runA = scenario.runs[0];
    const runB = scenario.runs[1];

    claimsBody.innerHTML = [...propositionSet].map((proposition) => {
      const claimsA = runA.claims.filter((claim) => claim.proposition === proposition);
      const claimsB = runB.claims.filter((claim) => claim.proposition === proposition);
      const displayA = claimsA.map((claim) => valueTag(claim.expected)).join(' ');
      const displayB = claimsB.map((claim) => valueTag(claim.expected)).join(' ');
      const result = report.claims.find((claim) => claim.proposition === proposition);
      const claimAssessments = report.claims
        .filter((claim) => claim.proposition === proposition)
        .map((claim) => claim.evidenceAssessment);
      let finding;
      let findingClass;
      if (claimAssessments.includes('contradicts_supplied_evidence')) {
        finding = 'Conflicts with supplied fact';
        findingClass = 'conflict';
      } else if (claimAssessments.includes('not_found_in_supplied_evidence')) {
        finding = 'Not in supplied evidence';
        findingClass = 'missing';
      } else {
        finding = 'Matches supplied fact';
        findingClass = 'match';
      }

      return `<tr>
        <td>${escapeHtml(proposition)}</td>
        <td>${displayA || '<span class="value-tag">—</span>'}</td>
        <td>${displayB || '<span class="value-tag">—</span>'}</td>
        <td>${valueTag(result.suppliedEvidence)}</td>
        <td><span class="finding ${findingClass}">${finding}</span></td>
      </tr>`;
    }).join('');
    claimCount.textContent = `${report.claims.length} claim${report.claims.length === 1 ? '' : 's'}`;
  }

  function renderQueue(report) {
    queueCount.textContent = `${report.reviewQueue.length} item${report.reviewQueue.length === 1 ? '' : 's'}`;
    if (report.reviewQueue.length === 0) {
      reviewQueue.innerHTML = '<div class="queue-empty">No claims were flagged by these configured checks. This does not prove the remaining claims are true.</div>';
      return;
    }
    reviewQueue.innerHTML = report.reviewQueue.map((item) => {
      const tags = item.reasons.map((reason) => {
        const danger = reason === 'claim_conflicts_with_supplied_evidence';
        const readable = reason.replaceAll('_', ' ');
        return `<span class="reason-tag ${danger ? 'danger' : ''}">${escapeHtml(readable)}</span>`;
      }).join('');
      const expectations = item.claims.map((claim) =>
        `${claim.runId}: ${claim.expected}`).join(' · ');
      const evidence = item.suppliedEvidence === null
        ? 'No matching fact was supplied.'
        : `Supplied fact is ${item.suppliedEvidence}. Verify the source independently.`;
      return `<article class="queue-item">
        <div class="queue-title">${escapeHtml(item.proposition)}</div>
        <div class="queue-reasons">${tags}</div>
        <div class="queue-detail">${escapeHtml(expectations)}<br>${escapeHtml(evidence)}</div>
      </article>`;
    }).join('');
  }

  function renderWarnings(report) {
    if (report.warnings.length === 0) {
      scenarioWarnings.hidden = true;
      scenarioWarnings.textContent = '';
      return;
    }
    scenarioWarnings.innerHTML = `<strong>Input warnings</strong><ul>${
      report.warnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join('')
    }</ul>`;
    scenarioWarnings.hidden = false;
  }

  function renderReport(scenario, report) {
    renderClaims(scenario, report);
    renderQueue(report);
    renderWarnings(report);
    reportGrid.hidden = false;
    interpretation.hidden = false;
    interpretation.querySelector('p').textContent = report.interpretation;
    const statusLabels = {
      inconsistency_detected: 'Inconsistency signal found',
      coverage_gap_detected: 'Claim coverage gap found',
      insufficient_claims: 'Insufficient claims to compare',
      no_pair_disagreement_detected: 'No pair disagreement',
    };
    resultState.textContent = statusLabels[report.pairConsistency.status];
    resultState.classList.add('done');
  }

  const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function animateAnalysis(scenario, report, token) {
    resetPipeline();
    activityLog.innerHTML = '';
    reportGrid.hidden = true;
    scenarioWarnings.hidden = true;
    interpretation.hidden = true;
    resultState.classList.remove('done');
    resultState.textContent = 'Analysis running…';

    const messages = [
      `Read scenario "${scenario.id}" and validate its two runs, claims, and evidence.`,
      `Grouped ${report.claims.length} claims using stable proposition identifiers.`,
      report.pairConsistency.contradictions.length
        ? `Found ${report.pairConsistency.contradictions.length} shared proposition(s) with opposite expectations.`
        : 'Found no shared propositions with opposite expectations.',
      `Compared claims with ${Object.keys(scenario.evidence.facts).length} supplied evidence fact(s).`,
      `Built a review queue with ${report.reviewQueue.length} item(s); no truth verdict was produced.`,
    ];

    for (let index = 0; index < stepNames.length; index += 1) {
      if (token !== animationToken) return;
      const step = document.querySelector(`[data-step="${stepNames[index]}"]`);
      step.classList.add('active');
      step.querySelector('.step-status').textContent = 'Running';
      await pause(280);
      if (token !== animationToken) return;
      step.classList.remove('active');
      step.classList.add('done');
      step.querySelector('.step-status').textContent = 'Complete';
      if (index > 0) {
        document.querySelectorAll('.pipeline-connector')[index - 1].classList.add('done');
      }
      addLog(messages[index]);
    }

    if (token === animationToken) renderReport(scenario, report);
  }

  async function runAnalysis() {
    animationToken += 1;
    const token = animationToken;
    errorBanner.hidden = true;
    jsonStatus.textContent = 'Checking…';

    let scenario;
    try {
      scenario = JSON.parse(textarea.value);
      currentReport = window.ClaimReviewAnalyzer.analyzeScenario(scenario);
    } catch (error) {
      resetPipeline();
      reportGrid.hidden = true;
      interpretation.hidden = true;
      resultState.classList.remove('done');
      resultState.textContent = 'Input needs review';
      jsonStatus.textContent = 'Invalid scenario';
      showError(error instanceof SyntaxError
        ? `Could not parse JSON: ${error.message}`
        : error.message);
      return;
    }

    jsonStatus.textContent = 'Valid scenario';
    await animateAnalysis(scenario, currentReport, token);
  }

  async function loadScenario(url, label) {
    animationToken += 1;
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Scenario could not be loaded (${response.status}).`);
      const scenario = await response.json();
      setExampleText(scenario);
      jsonStatus.textContent = label;
      resetPipeline();
      reportGrid.hidden = true;
      interpretation.hidden = true;
      resultState.classList.remove('done');
      resultState.textContent = 'Ready to analyze';
      activityLog.innerHTML = '<div class="log-placeholder">Press <strong>Run analysis</strong> to watch each step.</div>';
    } catch (error) {
      showError(error.message);
    }
  }

  runButton.addEventListener('click', runAnalysis);
  loadExampleButton.addEventListener('click', () =>
    loadScenario(loginExampleUrl, 'Login example loaded'));
  loadE2eExampleButton.addEventListener('click', () =>
    loadScenario(e2eExampleUrl, 'Checkout E2E example loaded'));
  textarea.addEventListener('input', () => {
    jsonStatus.textContent = 'Edited';
    errorBanner.hidden = true;
  });
  importFile.addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      textarea.value = text;
      jsonStatus.textContent = `Imported ${file.name}`;
      errorBanner.hidden = true;
    } catch (error) {
      showError(`Could not import JSON: ${error.message}`);
    }
    importFile.value = '';
  });

  loadScenario(loginExampleUrl, 'Login example loaded');
})();
