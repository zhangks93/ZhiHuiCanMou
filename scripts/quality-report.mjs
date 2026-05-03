import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const rootDir = path.resolve(import.meta.dirname, '..')
const appDir = path.join(rootDir, 'app')
const rustDir = path.join(appDir, 'src-tauri')
const reportDir = path.join(rootDir, 'reports', 'quality', 'latest')
const rawDir = path.join(reportDir, 'raw')
const frontendCoverageDir = path.join(reportDir, 'frontend-coverage')
const rustCoverageDir = path.join(reportDir, 'rust-coverage')

function rel(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, '/')
}

function pct(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null
}

function score(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function shellCommand(command, args) {
  return [command, ...args].join(' ')
}

function executable(command) {
  return command
}

function quoteWindowsArg(value) {
  const text = String(value)
  if (!/[\s"&|<>^]/.test(text)) return text
  return `"${text.replaceAll('"', '\\"')}"`
}

function spawnCommand(command, args) {
  if (process.platform !== 'win32') {
    return { command: executable(command), args }
  }
  return {
    command: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')],
  }
}

async function runStep(name, command, args, options = {}) {
  const startedAt = new Date().toISOString()
  const artifactName = options.artifactName ?? name
  const result = await new Promise((resolve) => {
    const spawned = spawnCommand(command, args)
    const child = spawn(spawned.command, spawned.args, {
      cwd: options.cwd ?? rootDir,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', chunk => {
      stdout += chunk
      if (options.stream) process.stdout.write(chunk)
    })
    child.stderr?.on('data', chunk => {
      stderr += chunk
      if (options.stream) process.stderr.write(chunk)
    })
    child.on('error', error => {
      resolve({
        name,
        artifactName,
        command: shellCommand(command, args),
        cwd: rel(options.cwd ?? rootDir),
        status: 'error',
        exitCode: null,
        startedAt,
        finishedAt: new Date().toISOString(),
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
      })
    })
    child.on('close', exitCode => {
      resolve({
        name,
        artifactName,
        command: shellCommand(command, args),
        cwd: rel(options.cwd ?? rootDir),
        status: exitCode === 0 ? 'passed' : 'failed',
        exitCode,
        startedAt,
        finishedAt: new Date().toISOString(),
        stdout,
        stderr,
      })
    })
  })

  await writeFile(
    path.join(rawDir, `${options.artifactName ?? name}.txt`),
    [
      `$ ${result.command}`,
      `cwd: ${result.cwd}`,
      `exitCode: ${result.exitCode ?? 'n/a'}`,
      '',
      '--- stdout ---',
      result.stdout,
      '',
      '--- stderr ---',
      result.stderr,
    ].join('\n'),
  )
  return result
}

async function countDeclaredRustTests(dir) {
  let total = 0
  let files = 0
  async function visit(currentDir) {
    for (const entry of await readdir(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await visit(entryPath)
      } else if (entry.isFile() && entry.name.endsWith('.rs')) {
        files += 1
        const content = await readFile(entryPath, 'utf8')
        total += content.match(/#\s*\[\s*test\s*\]/g)?.length ?? 0
      }
    }
  }
  await visit(dir)
  return { total, files }
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function summarizeEslint(report) {
  const files = Array.isArray(report) ? report : []
  return files.reduce((summary, file) => {
    summary.files += 1
    summary.errors += file.errorCount ?? 0
    summary.warnings += file.warningCount ?? 0
    summary.fixableErrors += file.fixableErrorCount ?? 0
    summary.fixableWarnings += file.fixableWarningCount ?? 0
    return summary
  }, { files: 0, errors: 0, warnings: 0, fixableErrors: 0, fixableWarnings: 0 })
}

function summarizeVitest(report) {
  const totals = {
    total: report?.numTotalTests ?? 0,
    passed: report?.numPassedTests ?? 0,
    failed: report?.numFailedTests ?? 0,
    skipped: report?.numPendingTests ?? 0,
    suitesTotal: report?.numTotalTestSuites ?? 0,
    suitesPassed: report?.numPassedTestSuites ?? 0,
    suitesFailed: report?.numFailedTestSuites ?? 0,
  }

  if (totals.total > 0 || !Array.isArray(report?.testResults)) {
    return totals
  }

  for (const suite of report.testResults) {
    totals.suitesTotal += 1
    let suiteFailed = false
    for (const assertion of suite.assertionResults ?? []) {
      totals.total += 1
      if (assertion.status === 'passed') totals.passed += 1
      else if (assertion.status === 'pending' || assertion.status === 'skipped') totals.skipped += 1
      else {
        totals.failed += 1
        suiteFailed = true
      }
    }
    if (suiteFailed) totals.suitesFailed += 1
    else totals.suitesPassed += 1
  }
  return totals
}

function summarizeCoverage(summary) {
  const total = summary?.total ?? {}
  return {
    lines: pct(total.lines?.pct),
    statements: pct(total.statements?.pct),
    functions: pct(total.functions?.pct),
    branches: pct(total.branches?.pct),
  }
}

function parseCargoList(stdout) {
  const tests = stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.endsWith(': test'))
  return { total: tests.length, tests: tests.map(line => line.replace(/: test$/, '')) }
}

function parseCargoTest(stdout) {
  const totals = { total: 0, passed: 0, failed: 0, ignored: 0, measured: 0, filteredOut: 0 }
  for (const match of stdout.matchAll(/test result: \w+\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out/g)) {
    totals.passed += Number(match[1])
    totals.failed += Number(match[2])
    totals.ignored += Number(match[3])
    totals.measured += Number(match[4])
    totals.filteredOut += Number(match[5])
  }
  totals.total = totals.passed + totals.failed + totals.ignored
  return totals
}

function parseClippy(stdout) {
  const counts = { errors: 0, warnings: 0, notes: 0 }
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue
    try {
      const event = JSON.parse(line)
      const level = event?.message?.level
      if (level === 'error') counts.errors += 1
      else if (level === 'warning') counts.warnings += 1
      else if (level === 'note') counts.notes += 1
    } catch {
      // Ignore non-JSON cargo output.
    }
  }
  return counts
}

function parseRustCoverage(summary) {
  const data = Array.isArray(summary?.data) ? summary.data[0]?.totals : summary?.totals
  const percent = data?.lines?.percent
  return {
    lines: pct(typeof percent === 'number' ? percent : null),
    functions: pct(data?.functions?.percent),
    branches: pct(data?.branches?.percent),
  }
}

function staticScore({ frontend, rust }) {
  let value = 100
  value -= frontend.eslint.errors * 10
  value -= frontend.eslint.warnings * 2
  if (frontend.typecheck.status !== 'passed') value -= 20
  if (rust.fmt.status !== 'passed') value -= 15
  value -= rust.clippy.errors * 10
  value -= rust.clippy.warnings * 2
  return score(value)
}

function testScore(frontendTests, rustTests) {
  const total = frontendTests.total + rustTests.total
  const passed = frontendTests.passed + rustTests.passed
  if (total === 0) return 0
  return score((passed / total) * 100)
}

function coverageScore(frontendCoverage, rustCoverage) {
  const values = [frontendCoverage.lines, rustCoverage.lines].filter(value => typeof value === 'number')
  if (values.length === 0) return 0
  return score(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function renderHtml(summary) {
  const card = (title, value, detail = '') => `
    <section class="card">
      <h2>${escapeHtml(title)}</h2>
      <div class="metric">${escapeHtml(value)}</div>
      <p>${escapeHtml(detail)}</p>
    </section>`

  const stepRows = summary.steps.map(step => `
    <tr>
      <td>${escapeHtml(step.name)}</td>
      <td><span class="${step.status === 'passed' ? 'ok' : 'bad'}">${escapeHtml(step.status)}</span></td>
      <td>${escapeHtml(step.exitCode ?? 'n/a')}</td>
      <td><code>${escapeHtml(step.command)}</code></td>
    </tr>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Code Quality Report</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #172033; background: #f5f7fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    .meta { color: #667085; margin: 0 0 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; padding: 18px; }
    .card h2 { font-size: 14px; color: #526071; margin: 0 0 10px; }
    .metric { font-size: 30px; font-weight: 700; }
    .card p { margin: 8px 0 0; color: #667085; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e0ea; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #edf1f5; vertical-align: top; }
    th { color: #526071; font-size: 13px; }
    code { font-size: 12px; }
    .ok { color: #087443; font-weight: 700; }
    .bad { color: #b42318; font-weight: 700; }
    a { color: #175cd3; }
  </style>
</head>
<body>
  <main>
    <h1>Code Quality Report</h1>
    <p class="meta">Generated ${escapeHtml(summary.generatedAt)}</p>
    <div class="grid">
      ${card('Overall Score', `${summary.scores.overall}/100`, 'Report-first score; thresholds are not enforced.')}
      ${card('Static Score', `${summary.scores.static}/100`, `ESLint ${summary.frontend.eslint.errors} errors, ${summary.frontend.eslint.warnings} warnings; clippy ${summary.rust.clippy.errors} errors, ${summary.rust.clippy.warnings} warnings.`)}
      ${card('Test Score', `${summary.scores.tests}/100`, `Frontend ${summary.frontend.tests.passed}/${summary.frontend.tests.total}; Rust ${summary.rust.tests.passed}/${summary.rust.tests.total}.`)}
      ${card('Coverage Score', `${summary.scores.coverage}/100`, `Frontend lines ${summary.frontend.coverage.lines ?? 'n/a'}%; Rust lines ${summary.rust.coverage.lines ?? 'n/a'}%.`)}
    </div>
    <div class="grid">
      ${card('Frontend Coverage', summary.frontend.coverage.lines == null ? 'n/a' : `${summary.frontend.coverage.lines}%`, 'HTML: frontend-coverage/index.html')}
      ${card('Rust Coverage', summary.rust.coverage.lines == null ? 'n/a' : `${summary.rust.coverage.lines}%`, summary.rust.coverage.available ? 'HTML: rust-coverage/html/index.html' : 'Install MSVC toolchain + cargo-llvm-cov.')}
    </div>
    <h2>Steps</h2>
    <table>
      <thead><tr><th>Name</th><th>Status</th><th>Exit</th><th>Command</th></tr></thead>
      <tbody>${stepRows}</tbody>
    </table>
    <p class="meta">Machine-readable summary: <a href="summary.json">summary.json</a></p>
  </main>
</body>
</html>`
}

async function main() {
  await rm(reportDir, { recursive: true, force: true })
  await mkdir(rawDir, { recursive: true })
  await mkdir(frontendCoverageDir, { recursive: true })
  await mkdir(rustCoverageDir, { recursive: true })

  const steps = []
  const eslintJson = path.join(rawDir, 'eslint.json')
  const vitestJson = path.join(rawDir, 'vitest.json')
  const frontendCoverageJson = path.join(frontendCoverageDir, 'coverage-summary.json')
  const rustCoverageJson = path.join(rawDir, 'rust-coverage-summary.json')

  steps.push(await runStep('frontend-eslint', 'npx', ['eslint', '.', '--format', 'json', '--output-file', eslintJson], { cwd: appDir, artifactName: 'frontend-eslint' }))
  steps.push(await runStep('frontend-typecheck', 'npx', ['tsc', '-b', '--pretty', 'false'], { cwd: appDir, artifactName: 'frontend-typecheck' }))
  steps.push(await runStep('frontend-tests-coverage', 'npx', [
    'vitest',
    'run',
    '--coverage',
    '--coverage.provider=v8',
    '--coverage.reportsDirectory',
    frontendCoverageDir,
    '--coverage.reporter=json-summary',
    '--coverage.reporter=html',
    '--coverage.reporter=lcov',
    '--reporter=json',
    '--outputFile',
    vitestJson,
  ], { cwd: appDir, artifactName: 'frontend-tests-coverage' }))

  steps.push(await runStep('rust-fmt', 'cargo', ['fmt', '--check'], { cwd: rustDir, artifactName: 'rust-fmt' }))
  steps.push(await runStep('rust-clippy', 'cargo', ['clippy', '--all-targets', '--message-format=json', '--', '-D', 'warnings'], { cwd: rustDir, artifactName: 'rust-clippy' }))
  const rustList = await runStep('rust-test-list', 'cargo', ['test', '--', '--list'], { cwd: rustDir, artifactName: 'rust-test-list' })
  steps.push(rustList)
  const rustTest = await runStep('rust-tests', 'cargo', ['test'], { cwd: rustDir, artifactName: 'rust-tests' })
  steps.push(rustTest)
  const rustCoverage = await runStep('rust-coverage', 'cargo', [
    '+stable-x86_64-pc-windows-msvc',
    'llvm-cov',
    '--json',
    '--summary-only',
    '--output-path',
    rustCoverageJson,
  ], { cwd: rustDir, artifactName: 'rust-coverage-json' })
  steps.push(rustCoverage)
  if (rustCoverage.status === 'passed') {
    steps.push(await runStep('rust-coverage-html', 'cargo', [
      '+stable-x86_64-pc-windows-msvc',
      'llvm-cov',
      '--html',
      '--output-dir',
      path.join(rustCoverageDir, 'html'),
    ], { cwd: rustDir, artifactName: 'rust-coverage-html' }))
  }

  const eslintReport = await readJson(eslintJson, [])
  const vitestReport = await readJson(vitestJson, {})
  const frontendCoverageSummary = await readJson(frontendCoverageJson, {})
  const rustCoverageSummary = await readJson(rustCoverageJson, {})

  const frontend = {
    eslint: summarizeEslint(eslintReport),
    typecheck: { status: steps.find(step => step.name === 'frontend-typecheck')?.status ?? 'failed' },
    tests: summarizeVitest(vitestReport),
    coverage: summarizeCoverage(frontendCoverageSummary),
  }
  const rust = {
    fmt: { status: steps.find(step => step.name === 'rust-fmt')?.status ?? 'failed' },
    clippy: parseClippy(steps.find(step => step.name === 'rust-clippy')?.stdout ?? ''),
    discoveredTests: parseCargoList(rustList.stdout),
    declaredTests: await countDeclaredRustTests(path.join(rustDir, 'src')),
    tests: parseCargoTest(rustTest.stdout),
    coverage: {
      ...parseRustCoverage(rustCoverageSummary),
      available: rustCoverage.status === 'passed',
    },
  }

  if (rust.tests.total === 0 && rust.discoveredTests.total > 0 && rustTest.status === 'passed') {
    rust.tests.total = rust.discoveredTests.total
    rust.tests.passed = rust.discoveredTests.total
  }

  const scores = {
    static: staticScore({ frontend, rust }),
    tests: testScore(frontend.tests, rust.tests),
    coverage: coverageScore(frontend.coverage, rust.coverage),
  }
  scores.overall = score((scores.static * 0.4) + (scores.tests * 0.3) + (scores.coverage * 0.3))

  const summary = {
    generatedAt: new Date().toISOString(),
    reportFirst: true,
    scores,
    frontend,
    rust,
    steps: steps.map(({ stdout, stderr, artifactName, ...step }) => ({
      ...step,
      stdoutArtifact: `raw/${artifactName}.txt`,
      stderrLength: stderr.length,
      stdoutLength: stdout.length,
    })),
  }

  await writeFile(path.join(reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  await writeFile(path.join(reportDir, 'index.html'), renderHtml(summary))

  console.log(`\nQuality report written to ${rel(path.join(reportDir, 'index.html'))}`)
  console.log(`Overall score: ${scores.overall}/100`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
