#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { analyzeScenario, formatReport } = require('../src/prototype/analyzer');

function usage() {
  return [
    'Usage: npm run prototype -- [scenario.json] [--json]',
    '',
    'Analyze two generated-test claim sets and compare them with supplied evidence.',
    'With no path, the bundled SauceDemo example is used.',
  ].join('\n');
}

function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const jsonOutput = args.includes('--json');
  const positionalArgs = args.filter((arg) => arg !== '--json');
  if (positionalArgs.length > 1) {
    throw new Error(`Expected at most one scenario path.\n${usage()}`);
  }

  const scenarioPath = positionalArgs.length
    ? path.resolve(process.cwd(), positionalArgs[0])
    : path.resolve(__dirname, '../fixtures/saucedemo-login-pair.json');

  let scenario;
  try {
    scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not load scenario "${scenarioPath}": ${error.message}`);
  }

  const report = analyzeScenario(scenario);
  process.stdout.write(jsonOutput
    ? `${JSON.stringify(report, null, 2)}\n`
    : `${formatReport(report)}\n`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
