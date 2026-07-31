#!/usr/bin/env node
'use strict'

/**
 * Install repo-root lefthook.yml into .git/hooks.
 * Safe no-op in CI or when lefthook is unavailable.
 */
if (process.env.CI) process.exit(0)

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const repoRoot = path.resolve(__dirname, '..')
const candidates = [
  path.join(repoRoot, 'frontend', 'node_modules', '.bin', 'lefthook'),
  path.join(repoRoot, 'node_modules', '.bin', 'lefthook')
]

const bin = candidates.find((p) => fs.existsSync(p))
if (!bin) process.exit(0)

const result = spawnSync(bin, ['install'], {
  cwd: repoRoot,
  stdio: 'ignore',
  shell: process.platform === 'win32'
})
process.exit(result.status === null ? 0 : result.status)
