import fs from 'node:fs'
const p = new URL('../src/features/biz-data/components/StrategyPlanView.tsx', import.meta.url)
let s = fs.readFileSync(p, 'utf8')
s = s.replace(`from '../api/bizDataRepository'`, `from '../services/bizDataService'`)
fs.writeFileSync(p, s)
