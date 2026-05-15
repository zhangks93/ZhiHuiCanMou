import type { CollectionReceivableRow } from '../api/collectionRepository'

export interface CollectionTreeRow {
  key: string
  depth: number
  row: CollectionReceivableRow
  children: CollectionTreeRow[]
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? '').trim()
}

function matchesQuery(row: CollectionTreeRow, query: string) {
  if (!query) return true
  const values = [
    row.row.item_name,
    row.row.parent_item_name,
    row.row.business_category,
    row.row.org_tag,
    row.row.growth_base_label,
    row.row.analysis_level_1,
    row.row.analysis_level_2,
    row.row.permission_people,
  ]
  return values.some((value) => (value ?? '').toLowerCase().includes(query))
}

export function buildCollectionTree(rows: CollectionReceivableRow[]): CollectionTreeRow[] {
  const nodeByName = new Map<string, CollectionTreeRow>()
  const roots: CollectionTreeRow[] = []

  rows.forEach((row) => {
    nodeByName.set(normalizeKey(row.item_name), {
      key: row.id,
      depth: 0,
      row,
      children: [],
    })
  })

  rows.forEach((row) => {
    const node = nodeByName.get(normalizeKey(row.item_name))
    if (!node) return

    const parentName = normalizeKey(row.parent_item_name)
    const parent = parentName ? nodeByName.get(parentName) : null
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const applyDepth = (nodes: CollectionTreeRow[], depth: number) => {
    nodes.forEach((node) => {
      node.depth = depth
      applyDepth(node.children, depth + 1)
    })
  }
  applyDepth(roots, 0)

  return roots
}

export function collectExpandableCollectionKeys(rows: CollectionTreeRow[]) {
  const keys = new Set<string>()
  const visit = (node: CollectionTreeRow) => {
    if (node.children.length > 0) {
      keys.add(node.key)
      node.children.forEach(visit)
    }
  }
  rows.forEach(visit)
  return keys
}

export function collectDefaultExpandedCollectionKeys(rows: CollectionTreeRow[]) {
  const keys = new Set<string>()
  const visit = (node: CollectionTreeRow) => {
    if (node.children.length > 0 && node.depth < 2) {
      keys.add(node.key)
    }
    node.children.forEach(visit)
  }
  rows.forEach(visit)
  return keys
}

export function flattenCollectionTreeRows(
  rows: CollectionTreeRow[],
  expandedKeys: Set<string>,
  query = '',
): CollectionTreeRow[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (normalizedQuery) {
    const result: CollectionTreeRow[] = []
    const visitForQuery = (node: CollectionTreeRow): boolean => {
      const childMatches = node.children.map(visitForQuery).some(Boolean)
      const selfMatches = matchesQuery(node, normalizedQuery)
      if (selfMatches || childMatches) {
        result.push(node)
        if (selfMatches) {
          node.children.forEach((child) => {
            if (!result.includes(child)) result.push(child)
          })
        }
      }
      return selfMatches || childMatches
    }
    rows.forEach(visitForQuery)
    return result.sort((a, b) => a.row.row_order - b.row.row_order)
  }

  const result: CollectionTreeRow[] = []
  const visit = (node: CollectionTreeRow) => {
    result.push(node)
    if (expandedKeys.has(node.key)) {
      node.children.forEach(visit)
    }
  }
  rows.forEach(visit)
  return result
}

export function getCollectionOverallStats(rows: CollectionReceivableRow[]) {
  const root = rows.find((row) => !row.parent_item_name) ?? rows[0] ?? null
  return {
    root,
    rowCount: rows.length,
    projectCount: rows.filter((row) => row.parent_item_name).length,
  }
}
