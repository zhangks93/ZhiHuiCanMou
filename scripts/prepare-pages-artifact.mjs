import fs from 'node:fs'
import path from 'node:path'

const blockedExtensions = new Set(['.xls', '.xlsx'])

function parseArgs(argv) {
  const args = { source: 'docs', out: '.pages-artifact' }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source') {
      args.source = argv[index + 1]
      index += 1
    } else if (value === '--out') {
      args.out = argv[index + 1]
      index += 1
    }
  }
  return args
}

function shouldCopy(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/')
  if (normalized === 'data' || normalized.startsWith('data/')) {
    return false
  }
  return !blockedExtensions.has(path.extname(normalized).toLowerCase())
}

function copyRecursive(sourceDir, targetDir, relativePath = '') {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    const nextRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name
    if (!shouldCopy(nextRelativePath)) {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true })
      copyRecursive(sourcePath, targetPath, nextRelativePath)
      continue
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(sourcePath, targetPath)
  }
}

function removeDir(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true })
}

function main() {
  const { source, out } = parseArgs(process.argv.slice(2))
  const sourceDir = path.resolve(source)
  const outputDir = path.resolve(out)

  if (!fs.existsSync(sourceDir)) {
    console.error(`Pages source directory not found: ${sourceDir}`)
    process.exit(1)
  }

  removeDir(outputDir)
  fs.mkdirSync(outputDir, { recursive: true })
  copyRecursive(sourceDir, outputDir)
  console.log(`Prepared Pages artifact: ${outputDir}`)
}

main()
