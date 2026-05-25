import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const p = path.join(__dirname, '../src/features/biz-data/components/StrategyPlanView.tsx')
let s = fs.readFileSync(p, 'utf8')

const needle = `import { fmt } from '@/shared/lib/format'

interface StrategyPivotTreeRow {`

const replacement = `import { fmt } from '@/shared/lib/format'
import {
  buildPivotTreeRows,
  formatPivotDelta,
  formatPivotValue,
  getRowTone,
  getTrendRows,
  type PivotMetric,
  type StrategyPivotTreeRow,
  type TrendGroup,
} from './strategyPlanModel'

const _REMOVE_START = true
interface StrategyPivotTreeRow_DUP {`

if (!s.includes(needle)) {
  console.error('needle not found')
  process.exit(1)
}

// Simpler: remove between "import { fmt }" block end and "function buildDefaultExpanded"
const startMark = "import { fmt } from '@/shared/lib/format'\n\ninterface StrategyPivotTreeRow"
const endMark = 'function buildDefaultExpanded(rows: StrategyPivotTreeRow[]): ExpandedState {'

const i0 = s.indexOf(startMark)
const i1 = s.indexOf(endMark)
if (i0 < 0 || i1 < 0) {
  console.error('markers not found', i0, i1)
  process.exit(1)
}

const newImports = `import { fmt } from '@/shared/lib/format'
import {
  buildPivotTreeRows,
  formatPivotDelta,
  formatPivotValue,
  getRowTone,
  getTrendRows,
  type PivotMetric,
  type StrategyPivotTreeRow,
  type TrendGroup,
} from './strategyPlanModel'

`

s = s.slice(0, i0) + newImports + s.slice(i1)
fs.writeFileSync(p, s)
console.log('StrategyPlanView refactored')
