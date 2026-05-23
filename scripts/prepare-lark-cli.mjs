import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repoRoot, 'app')
const source = path.join(appRoot, 'node_modules', '@larksuite', 'cli', 'bin', 'lark-cli.exe')
const targetDir = path.join(appRoot, 'src-tauri', 'resources', 'lark-cli', 'windows')
const target = path.join(targetDir, 'lark-cli.exe')

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (process.platform !== 'win32') {
  console.log('Skipping lark-cli sidecar preparation: current target is Windows-only.')
  process.exit(0)
}

if (!fs.existsSync(source)) {
  fail(`Bundled lark-cli binary not found at ${source}. Run npm install in app first.`)
}

fs.mkdirSync(targetDir, { recursive: true })
fs.copyFileSync(source, target)
fs.chmodSync(target, 0o755)

console.log(`Prepared bundled lark-cli: ${path.relative(repoRoot, target)}`)
