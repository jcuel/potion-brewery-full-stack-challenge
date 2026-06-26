#!/usr/bin/env node
/**
 * Builds Docker Compose images and scans them with Trivy for HIGH/CRITICAL issues.
 *
 * Usage: npm run scan:trivy
 * Requires: Docker (pulls aquasec/trivy if not present).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const images = ['demo-backend', 'demo-frontend'];
const severity = process.env.TRIVY_SEVERITY ?? 'HIGH,CRITICAL';
const exitCode = process.env.TRIVY_EXIT_CODE ?? '1';
const libraryOnly = process.argv.includes('--library') || process.env.TRIVY_LIBRARY_ONLY === '1';
const reportsDir = process.env.TRIVY_REPORT_DIR ?? 'reports';
const trivyConfig = join(process.cwd(), 'trivy.yaml');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mkdirSync(reportsDir, { recursive: true });

console.log('Building Docker images...');
run('docker', ['compose', 'build']);

console.log('\nScanning images with Trivy...');
for (const image of images) {
  console.log(`\n--- ${image} ---`);
  const trivyArgs = [
    'run',
    '--rm',
    '-v',
    '/var/run/docker.sock:/var/run/docker.sock',
    '-v',
    `${trivyConfig}:/trivy.yaml:ro`,
    'aquasec/trivy:latest',
    'image',
    '--config',
    '/trivy.yaml',
    '--severity',
    severity,
    '--exit-code',
    exitCode,
    '--format',
    'table',
    '--output',
    join(reportsDir, `trivy-${image}.txt`),
  ];

  if (libraryOnly) {
    trivyArgs.push('--scanners', 'vuln', '--pkg-types', 'library');
  }

  trivyArgs.push(image);
  run('docker', trivyArgs);
}

console.log(`\nTrivy reports written to ${reportsDir}/`);
console.log('Trivy scan completed.');
