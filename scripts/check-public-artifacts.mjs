import fs from 'node:fs'
import path from 'node:path'

const SENSITIVE_KEYWORDS = ['经营数据', '商机', '考勤', '出差', '组织标签', '费效']
const blockedExtensions = new Set(['.xls', '.xlsx'])

function parseArgs(argv) {
  const args = { dir: '.pages-artifact' }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--dir') {
      args.dir = argv[index + 1]
      index += 1
    }
  }
  return args
}

function walk(rootDir) {
  const entries = []
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      entries.push(...walk(fullPath))
      continue
    }
    entries.push(fullPath)
  }
  return entries
}

function main() {
  const { dir } = parseArgs(process.argv.slice(2))
  const targetDir = path.resolve(dir)

  if (!fs.existsSync(targetDir)) {
    console.error(`Public artifact directory not found: ${targetDir}`)
    process.exit(1)
  }

  const violations = []
  const files = walk(targetDir)
  for (const filePath of files) {
    const relativePath = path.relative(targetDir, filePath).replaceAll('\\', '/')
    const extension = path.extname(filePath).toLowerCase()
    if (blockedExtensions.has(extension)) {
      violations.push(`Blocked spreadsheet file: ${relativePath}`)
    }
    if (relativePath.startsWith('data/')) {
      violations.push(`Blocked private data directory content: ${relativePath}`)
    }
    if (SENSITIVE_KEYWORDS.some((keyword) => relativePath.includes(keyword))) {
      violations.push(`Blocked sensitive filename: ${relativePath}`)
    }
  }

  if (violations.length > 0) {
    console.error('Public artifact validation failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log(`Public artifact validation passed for ${targetDir}`)
}

main()
