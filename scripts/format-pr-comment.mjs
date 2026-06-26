#!/usr/bin/env node
/**
 * Builds a markdown summary for PR comments from CI job results and report files.
 *
 * Env:
 *   TEST_JOB_RESULT, TRIVY_JOB_RESULT — GitHub needs.*.result values
 *   GITHUB_RUN_ID, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_SERVER_URL
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const reportsDir = process.env.REPORTS_DIR ?? 'reports';
mkdirSync(reportsDir, { recursive: true });

const testResult = process.env.TEST_JOB_RESULT ?? 'unknown';
const trivyResult = process.env.TRIVY_JOB_RESULT ?? 'unknown';
const runId = process.env.GITHUB_RUN_ID ?? '';
const repo = process.env.GITHUB_REPOSITORY ?? '';
const sha = process.env.GITHUB_SHA ?? '';
const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
const shortSha = sha.slice(0, 7);

const allPassed = testResult === 'success' && trivyResult === 'success';
const statusEmoji = allPassed ? '✅' : '❌';
const statusLabel = allPassed ? 'Passed' : 'Failed';

function jobBadge(result) {
  if (result === 'success') return '✅ Pass';
  if (result === 'failure') return '❌ Fail';
  if (result === 'cancelled') return '⚪ Cancelled';
  if (result === 'skipped') return '⚪ Skipped';
  return `⚠️ ${result}`;
}

function readReport(filename) {
  const path = join(reportsDir, filename);
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf8').trim();
  if (!content) return null;
  const maxLines = 40;
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  return `${lines.slice(0, maxLines).join('\n')}\n\n_…truncated (${lines.length} lines total)_`;
}

function trivySummary(filename) {
  const content = readReport(filename);
  if (!content) return '_No report file_';
  const hasVuln = /TOTAL:\s*[1-9]/i.test(content) || /\|\s+(HIGH|CRITICAL)\s+\|/.test(content);
  if (!hasVuln) return 'No HIGH/CRITICAL library findings';
  return `\`\`\`\n${content}\n\`\`\``;
}

const workflowUrl = runId && repo
  ? `${server}/${repo}/actions/runs/${runId}`
  : '';

const body = `## ${statusEmoji} CI Results — ${statusLabel}

**Commit:** \`${shortSha}\`${workflowUrl ? ` · [View workflow run](${workflowUrl})` : ''}

### Smoke & regression tests

| Suite | Tests | Result |
|-------|------:|--------|
| Frontend unit (\`validation.test.ts\`) | 8 | ${testResult === 'success' ? '✅' : '❌'} |
| Backend unit (\`*.smoke.test.ts\`) | 7 | ${testResult === 'success' ? '✅' : '❌'} |
| Integration smoke (\`integration.test.ts\`) | 7 | ${testResult === 'success' ? '✅' : '❌'} |
| **Total** | **22** | **${jobBadge(testResult)}** |

Includes TypeScript build, **Bug 1** (client + server date validation), **Bug 2a** (status persistence), **Bug 2b** (drag-drop), REST/GraphQL health checks.

### Trivy (library dependencies)

| Image | Result |
|-------|--------|
| \`demo-backend\` | ${jobBadge(trivyResult)} |
| \`demo-frontend\` | ${jobBadge(trivyResult)} |

<details>
<summary>Backend library scan</summary>

${trivySummary('trivy-demo-backend.txt')}

</details>

<details>
<summary>Frontend library scan</summary>

${trivySummary('trivy-demo-frontend.txt')}

</details>

---
<sub>Posted by [CI workflow](${workflowUrl || '.github/workflows/ci.yml'}); updated on each push.</sub>
`;

const outputPath = join(reportsDir, 'pr-comment.md');
writeFileSync(outputPath, body);
console.log(`Wrote ${outputPath}`);
