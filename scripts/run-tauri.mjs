import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '../app')
const binName = process.platform === 'win32' ? 'tauri.cmd' : 'tauri'
const tauriBin = path.join(appRoot, 'node_modules', '.bin', binName)
const args = process.argv.slice(2)

function runCommand(command, commandArgs) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      stderr += error.message
      resolve({ ok: false, stdout, stderr })
    })
    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout, stderr })
    })
  })
}

async function ensureWindowsNativeToolchain() {
  if (process.platform !== 'win32') {
    return true
  }

  const linkCheck = await runCommand('where.exe', ['link'])
  if (linkCheck.ok) {
    return true
  }

  const gccCheck = await runCommand('where.exe', ['gcc'])
  const clangCheck = await runCommand('where.exe', ['clang'])
  if (gccCheck.ok || clangCheck.ok) {
    return true
  }

  console.error('Missing native Windows linker for Tauri.')
  console.error('Install one of these toolchains, then rerun `npm run tauri dev`:')
  console.error('1. Visual Studio Build Tools 2019/2022 with "Desktop development with C++"')
  console.error('2. A MinGW-w64 toolchain that provides `gcc` on PATH')
  console.error('')
  console.error('Current machine check:')
  console.error('- `link.exe`: not found')
  console.error('- `gcc`: not found')
  console.error('- `clang`: not found')
  return false
}

async function main() {
  if (!fs.existsSync(tauriBin)) {
    console.error(`Tauri CLI not found at ${tauriBin}. Run npm install in the app first.`)
    process.exit(1)
  }

  const hasToolchain = await ensureWindowsNativeToolchain()
  if (!hasToolchain) {
    process.exit(1)
  }

  const child = spawn(tauriBin, args, {
    cwd: appRoot,
    stdio: 'inherit',
    shell: false,
  })

  child.on('error', (error) => {
    console.error(error.message)
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })
}

main()
