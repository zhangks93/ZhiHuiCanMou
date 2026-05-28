import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CollectionPage columns', () => {
  it('does not render hidden structure fields as table headers', () => {
    const source = readFileSync(resolve(__dirname, 'CollectionPage.tsx'), 'utf8')

    expect(source).toContain('项目 / 单位')
    expect(source).toContain('本学年回款金额')
    expect(source).not.toContain('<th className="text-left">业务板块一级')
    expect(source).not.toContain('<th className="text-left">业务板块二级')
    expect(source).not.toContain('<th className="text-left">基本盘/增长极')
    expect(source).not.toContain('<th className="text-left">人员权限')
  })
})
