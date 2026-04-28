import fs from 'node:fs'
import path from 'node:path'

const migrationDir = path.resolve('supabase/migrations')
const violations = []
const requiredRlsTables = new Set([
  'edu_biz_report',
  'edu_biz_monthly_plan',
  'edu_org_hierarchy',
  'edu_strategy_budget_plan',
  'business_trips',
])
const rlsEnabledTables = new Set()
const policyTables = new Set()

function isAllowedLine(line) {
  return line.includes('RLS-ALLOW') || line.includes('RLS_ALLOW')
}

function inspectFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const normalizedContent = content.toLowerCase()
  for (const match of normalizedContent.matchAll(/alter\s+table\s+(?:public\.)?([a-z0-9_]+)\s+enable\s+row\s+level\s+security/g)) {
    rlsEnabledTables.add(match[1])
  }
  for (const match of normalizedContent.matchAll(/create\s+policy[\s\S]*?\son\s+(?:public\.)?([a-z0-9_]+)/g)) {
    policyTables.add(match[1])
  }

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

  for (const tableName of requiredRlsTables) {
    if (!rlsEnabledTables.has(tableName)) {
      violations.push(`required table ${tableName} does not enable row level security`)
    }
    if (!policyTables.has(tableName)) {
      violations.push(`required table ${tableName} does not define any RLS policy`)
    }
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
