import fs from 'node:fs'
import path from 'node:path'

const migrationDir = path.resolve('supabase/migrations')
const violations = []

function isAllowedLine(line) {
  return line.includes('RLS-ALLOW') || line.includes('RLS_ALLOW')
}

function inspectFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  lines.forEach((line, index) => {
    const normalized = line.toLowerCase()
    if (isAllowedLine(line)) {
      return
    }
    if (normalized.includes('using (true)')) {
      violations.push(`${path.basename(filePath)}:${index + 1} contains using (true)`)
    }
    if (normalized.includes('with check (true)')) {
      violations.push(`${path.basename(filePath)}:${index + 1} contains with check (true)`)
    }
    if (normalized.includes(' to public')) {
      violations.push(`${path.basename(filePath)}:${index + 1} grants policy to public`)
    }
    if (normalized.includes('disable row level security')) {
      violations.push(`${path.basename(filePath)}:${index + 1} disables row level security`)
    }
    if (normalized.includes(' for all')) {
      violations.push(`${path.basename(filePath)}:${index + 1} uses broad FOR ALL policy`)
    }
  })
}

function main() {
  const files = fs.readdirSync(migrationDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .map((fileName) => path.join(migrationDir, fileName))

  for (const filePath of files) {
    inspectFile(filePath)
  }

  if (violations.length > 0) {
    console.error('RLS policy validation failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('RLS policy validation passed.')
}

main()
