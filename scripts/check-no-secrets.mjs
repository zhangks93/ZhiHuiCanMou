import fs from 'node:fs'
import path from 'node:path'

const roots = [
  'app/.env.example',
  '.github/workflows',
  'scripts',
  'README.md',
  'docs',
]

const ignoreDirectories = new Set(['node_modules', 'dist', 'target', 'gen', '__pycache__', 'report_pngs', 'data'])
const textExtensions = new Set(['.md', '.txt', '.yml', '.yaml', '.json', '.js', '.mjs', '.ts', '.tsx', '.py', '.env', '.example', '.sql', '.html', '.css'])

const patterns = [
  { label: 'Real project Supabase URL', regex: /https:\/\/kwwoyzaeczecddilwajs\.supabase\.co/ },
  { label: 'Supabase anon/service key', regex: /\beyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/ },
  { label: 'Feishu app id', regex: /\bcli_[a-z0-9]{8,}\b/i },
  { label: 'OpenAI key', regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { label: 'Anthropic key', regex: /\bsk-ant-[A-Za-z0-9_-]{10,}\b/i },
]

function walk(entryPath, files) {
  const stat = fs.statSync(entryPath)
  if (stat.isDirectory()) {
    const baseName = path.basename(entryPath)
    if (ignoreDirectories.has(baseName)) {
      return
    }
    for (const child of fs.readdirSync(entryPath)) {
      walk(path.join(entryPath, child), files)
    }
    return
  }
  files.push(entryPath)
}

function main() {
  const files = []
  for (const root of roots) {
    const absolutePath = path.resolve(root)
    if (fs.existsSync(absolutePath)) {
      walk(absolutePath, files)
    }
  }

  const violations = []
  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase()
    if (extension && !textExtensions.has(extension)) {
      continue
    }
    const content = fs.readFileSync(filePath, 'utf8')
    for (const pattern of patterns) {
      if (pattern.regex.test(content)) {
        violations.push(`${path.relative(process.cwd(), filePath)} contains ${pattern.label}`)
      }
    }
  }

  if (violations.length > 0) {
    console.error('Secret scan failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('Secret scan passed.')
}

main()
