import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

const SCAN_EXTS = new Set(['.md', '.mjs', '.ts', '.tsx', '.json', '.yaml', '.yml', '.txt', '.html'])

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'lib' || entry.name === 'package-lock.json') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(path))
    else if (SCAN_EXTS.has(entry.name.slice(entry.name.lastIndexOf('.')))) out.push(path)
  }
  return out
}

test('no unrelated external repository URLs are shipped', async () => {
  const files = await walk(root)
  const offenders = []
  // Attribution and licence compliance require naming the upstream project and
  // its author (Apache-2.0 §4(c), and plain decency). Those exact references are
  // allowed; any OTHER repository link would be an unrelated leak.
  const ALLOWED = [
    /github\.com\/LaplaceYoung\/dsh-(montagex|directorx)/gi,
    /github\.com\/LaplaceYoung\b/gi,
  ]
  for (const file of files) {
    const content = await readFile(file, 'utf8')
    let stripped = content
    for (const pattern of ALLOWED) stripped = stripped.replace(pattern, '')
    if (/github\.com|api\.github\.com/i.test(stripped)) offenders.push(file)
  }
  assert.deepEqual(offenders, [])
})

test('original playbook is integrated as a DSH skill', async () => {
  const skill = await readFile(join(root, 'skills/montagex-playbook/SKILL.md'), 'utf8')
  assert.match(skill, /name: montagex-playbook/)
  for (const file of [
    'video-prompt-principles.md',
    'consistency-and-control.md',
    'workflow-gates.md',
    'model-routing.md',
  ]) {
    assert.match(skill, new RegExp(file))
  }
})

test('README presents the plugin and credits the upstream author', async () => {
  const readme = await readFile(join(root, 'README.md'), 'utf8')
  assert.match(readme, /dsh-plugin/)
  // The README must credit DirectorX's author: attribution is both an
  // Apache-2.0 obligation and the honest description of where this began.
  assert.match(readme, /LaplaceYoung/)
  assert.match(readme, /dsh-directorx/)
  // Outside that credited project, no unrelated repository links.
  const stripped = readme
    .replace(/github\.com\/LaplaceYoung\/dsh-(montagex|directorx)/gi, '')
    .replace(/github\.com\/LaplaceYoung\b/gi, '')
  assert.doesNotMatch(stripped, /github\.com|api\.github\.com/i)
})

test('shipped prose does not name other canvas products', async () => {
  const files = await walk(root)
  const marks = ['tap' + 'now', 'tap' + 'tv', 'lib' + 'tv', 'liblib\\.tv', '\\b' + 'open' + 'lib' + '\\b']
  const banned = new RegExp(marks.join('|'), 'i')
  const offenders = []
  for (const file of files) {
    if (file.endsWith('no-upstream-content.test.mjs')) continue
    const content = await readFile(file, 'utf8')
    if (banned.test(content)) offenders.push(file.slice(root.length + 1))
  }
  assert.deepEqual(offenders, [])
})
