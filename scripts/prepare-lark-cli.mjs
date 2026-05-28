import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repoRoot, 'app')
const packageJsonPath = path.join(appRoot, 'node_modules', '@larksuite', 'cli', 'package.json')
const source = path.join(appRoot, 'node_modules', '@larksuite', 'cli', 'bin', 'lark-cli.exe')
const targetDir = path.join(appRoot, 'src-tauri', 'resources', 'lark-cli', 'windows')
const target = path.join(targetDir, 'lark-cli.exe')
const manifestPath = path.join(targetDir, 'lark-cli.manifest.json')

function fail(message) {
  console.error(message)
  process.exit(1)
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

if (process.platform !== 'win32') {
  console.log('Skipping lark-cli sidecar preparation: current target is Windows-only.')
  process.exit(0)
}

if (!fs.existsSync(source)) {
  fail(`Bundled lark-cli binary not found at ${source}. Run npm install in app first.`)
}

if (!fs.existsSync(packageJsonPath)) {
  fail(`@larksuite/cli package.json not found at ${packageJsonPath}. Run npm install in app first.`)
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const version = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

fs.mkdirSync(targetDir, { recursive: true })
fs.copyFileSync(source, target)
fs.chmodSync(target, 0o755)

const manifest = {
  version,
  sha256: sha256File(target),
  updatedAt: new Date().toISOString(),
  source: 'bundled',
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`Prepared bundled lark-cli ${version}: ${path.relative(repoRoot, target)}`)
