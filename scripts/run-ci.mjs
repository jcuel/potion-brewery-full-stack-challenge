#!/usr/bin/env node
/**
 * Local CI runner — mirrors the GitHub Actions pipeline.
 * Builds Docker, runs all tests, optionally runs Trivy, writes a results summary.
 *
 * Usage:
 *   npm run ci              # tests only (required gate)
 *   npm run ci:full         # tests + Trivy scan
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const runTrivy = process.argv.includes('--trivy');
const reportsDir = join(process.cwd(), 'reports');
const startedAt = new Date().toISOString();

const steps = [];

function runStep(name, command, args, { optional = false } = {}) {
  console.log(`\n=== ${name} ===`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const durationMs = Date.now() - started;
  const ok = result.status === 0;

  steps.push({ name, ok, durationMs, optional });
  if (!ok && !optional) {
    writeSummary(false);
    process.exit(result.status ?? 1);
  }
  return ok;
}

function sleep(seconds) {
  if (process.platform === 'win32') {
    spawnSync('powershell', ['-Command', `Start-Sleep -Seconds ${seconds}`], { stdio: 'ignore' });
  } else {
    spawnSync('sleep', [String(seconds)], { stdio: 'ignore' });
  }
}

function waitForServices() {
  console.log('\n=== Wait for services ===');
  const started = Date.now();
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const health = spawnSync('node', ['-e', "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], {
      stdio: 'ignore',
    });
    const frontend = spawnSync('node', ['-e', "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], {
      stdio: 'ignore',
    });

    if (health.status === 0 && frontend.status === 0) {
      steps.push({ name: 'Wait for services', ok: true, durationMs: Date.now() - started, optional: false });
      return true;
    }
    console.log(`  attempt ${attempt}/${maxAttempts} — services not ready yet`);
    sleep(2);
  }

  steps.push({ name: 'Wait for services', ok: false, durationMs: Date.now() - started, optional: false });
  writeSummary(false);
  process.exit(1);
}

function writeSummary(passed) {
  mkdirSync(reportsDir, { recursive: true });
  const summary = {
    passed,
    startedAt,
    finishedAt: new Date().toISOString(),
    steps,
    expectedTests: {
      frontendUnit: 8,
      backendUnit: 7,
      integrationSmoke: 7,
      total: 22,
    },
  };
  writeFileSync(join(reportsDir, 'ci-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\nResults written to reports/ci-results.json`);
}

console.log('Potion Brewery — local CI pipeline');
console.log(`Started: ${startedAt}`);

runStep('Install dependencies', 'npm', ['run', 'setup']);
runStep('Typecheck and build backend', 'npm', ['run', 'build', '--prefix', 'backend']);
runStep('Typecheck and build frontend', 'npm', ['run', 'build', '--prefix', 'frontend']);
runStep('Build & start Docker Compose', 'docker', ['compose', 'up', '-d', '--build']);
waitForServices();
runStep('Unit tests (frontend + backend)', 'npm', ['run', 'test:unit']);
runStep('Integration smoke tests', 'npm', ['run', 'test:smoke']);

if (runTrivy) {
  runStep('Trivy container scan', 'npm', ['run', 'scan:trivy'], { optional: true });
}

writeSummary(true);
console.log('\nCI pipeline passed.');
