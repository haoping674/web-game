import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Vercel reads the root tsconfig, not the Vite app/node project references.
// Run emitted JavaScript with Node so Vite/Vitest cannot mask broken imports.
const root = process.cwd()
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
assert.equal(config.error, undefined, 'Cannot read root TypeScript configuration')
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const cache = path.join(root, 'node_modules', '.cache')
await mkdir(cache, { recursive: true })
const output = await mkdtemp(path.join(cache, 'api-build-'))
const relative = path.relative(cache, output)
assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Unsafe temporary output path')
try {
  await writeFile(path.join(output, 'package.json'), '{"type":"module"}')
  const program = ts.createProgram([path.join(root, 'api/leaderboard.ts')], {
    ...parsed.options, noEmit: false, outDir: output, rootDir: root,
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }))
  assert.equal(program.emit().emitSkipped, false, 'API compilation was skipped')
  const entry = pathToFileURL(path.join(output, 'api', 'leaderboard.js')).href
  const verification = `
    import assert from 'node:assert/strict';
    const { default: handler } = await import(${JSON.stringify(entry)});
    const invalid = await handler.fetch(new Request('https://arcade.test/api/leaderboard?board=invalid'));
    assert.equal(invalid.status, 400);
    const unconfigured = await handler.fetch(new Request('https://arcade.test/api/leaderboard?board=fruit-classic'));
    assert.equal(unconfigured.status, 503);
    assert.match((await unconfigured.json()).error, /尚未連線/);
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', verification], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: '' }, timeout: 15_000,
  })
  assert.equal(result.status, 0, result.stderr || 'Emitted API could not start')
  console.log('Compiled API starts in Node.js; runtime imports and error responses verified.')
} finally {
  await rm(output, { recursive: true, force: true })
}
