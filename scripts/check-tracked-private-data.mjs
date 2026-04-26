import { execFileSync } from 'node:child_process'

const BLOCKED_PATH_PREFIXES = ['docs/data/']
const BLOCKED_EXTENSIONS = ['.xls', '.xlsx']

function normalizePath(filePath) {
  return filePath.replace(/^"+|"+$/g, '').replaceAll('\\', '/')
}

function readLines(command, args) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function isBlocked(filePath) {
  const normalized = normalizePath(filePath)
  return BLOCKED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    || BLOCKED_EXTENSIONS.some((extension) => normalized.toLowerCase().endsWith(extension))
}

function main() {
  const trackedFiles = readLines('git', ['ls-files'])
  const deletedFiles = new Set(
    readLines('git', ['status', '--short', '--untracked-files=no'])
      .filter((line) => line.startsWith('D ') || line.startsWith(' D'))
      .map((line) => normalizePath(line.slice(3))),
  )

  const violations = trackedFiles
    .map(normalizePath)
    .filter((filePath) => !deletedFiles.has(filePath))
    .filter(isBlocked)

  if (violations.length > 0) {
    console.error('Tracked private-data validation failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('Tracked private-data validation passed.')
}

main()
