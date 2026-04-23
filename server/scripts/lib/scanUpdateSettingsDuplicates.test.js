/**
 * Unit tests for scanUpdateSettingsDuplicates — aggregate logic shared by
 * scan-update-settings-duplicates.js and tighten-update-settings-unique.js.
 */

import { describe, it, expect } from 'vitest'
import { findDuplicateGroups, findNameCollisions } from './scanUpdateSettingsDuplicates.js'

// In-memory fake collection supporting the aggregate pipeline we use.
function createFakeCollection(docs) {
  return {
    aggregate(pipeline) {
      return {
        toArray: async () => runPipeline(docs, pipeline)
      }
    }
  }
}

// Minimal $match / $group / $sort pipeline runner — only supports the shapes
// used by the lib. Intentionally tiny; not a general-purpose runner.
function runPipeline(input, pipeline) {
  let rows = input.slice()
  for (const stage of pipeline) {
    if (stage.$match) {
      rows = rows.filter(r => matchDoc(r, stage.$match))
    } else if (stage.$group) {
      rows = groupDocs(rows, stage.$group)
    } else if (stage.$sort) {
      const [field, dir] = Object.entries(stage.$sort)[0]
      rows = rows.slice().sort((a, b) => (a[field] - b[field]) * dir)
    }
  }
  return rows
}

function matchDoc(doc, query) {
  for (const [key, cond] of Object.entries(query)) {
    if (cond && typeof cond === 'object') {
      if ('$exists' in cond) {
        if ((doc[key] !== undefined) !== cond.$exists) return false
      } else if ('$gt' in cond) {
        if (!(doc[key] > cond.$gt)) return false
      }
    } else if (doc[key] !== cond) return false
  }
  return true
}

function groupDocs(rows, groupStage) {
  const buckets = new Map()
  for (const row of rows) {
    const keyObj = evalExpr(groupStage._id, row)
    const keyStr = JSON.stringify(keyObj)
    if (!buckets.has(keyStr)) buckets.set(keyStr, { _id: keyObj })
    const bucket = buckets.get(keyStr)
    for (const [field, expr] of Object.entries(groupStage)) {
      if (field === '_id') continue
      if (expr.$sum) bucket[field] = (bucket[field] ?? 0) + 1
      else if (expr.$push) {
        bucket[field] = bucket[field] ?? []
        bucket[field].push(evalExpr(expr.$push, row))
      }
    }
  }
  return [...buckets.values()]
}

function evalExpr(expr, row) {
  if (typeof expr === 'string' && expr.startsWith('$')) {
    return row[expr.slice(1)]
  }
  if (expr && typeof expr === 'object') {
    if ('$ifNull' in expr) {
      const [path, fallback] = expr.$ifNull
      const val = evalExpr(path, row)
      return val === undefined || val === null ? fallback : val
    }
    const out = {}
    for (const [k, v] of Object.entries(expr)) out[k] = evalExpr(v, row)
    return out
  }
  return expr
}

describe('findDuplicateGroups — (agentGroup, name, osVer, version)', () => {
  it('returns empty when no per-profile docs exist', async () => {
    const collection = createFakeCollection([
      { agentGroup: 'g', profiles: [], name: undefined }
    ])
    const result = await findDuplicateGroups(collection)
    expect(result).toEqual([])
  })

  it('returns empty when all combos are unique', async () => {
    const collection = createFakeCollection([
      { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' },
      { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '2.0', profileId: 'p2' },
      { agentGroup: 'g1', name: 'B', osVer: 'Win11', version: '1.0', profileId: 'p3' }
    ])
    const result = await findDuplicateGroups(collection)
    expect(result).toEqual([])
  })

  it('detects 2 docs with identical (agentGroup,name,osVer,version)', async () => {
    const collection = createFakeCollection([
      { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' },
      { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p2' },
      { agentGroup: 'g1', name: 'B', osVer: 'Win11', version: '1.0', profileId: 'p3' }
    ])
    const result = await findDuplicateGroups(collection)
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(2)
    expect(result[0].profileIds).toEqual(expect.arrayContaining(['p1', 'p2']))
    expect(result[0]._id).toEqual({ agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0' })
  })

  it('treats missing osVer/version as empty string for grouping', async () => {
    const collection = createFakeCollection([
      { agentGroup: 'g1', name: 'A', profileId: 'p1' },  // no osVer, no version
      { agentGroup: 'g1', name: 'A', osVer: '', version: '', profileId: 'p2' }
    ])
    const result = await findDuplicateGroups(collection)
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(2)
    expect(result[0]._id.osVer).toBe('')
    expect(result[0]._id.version).toBe('')
  })

  it('excludes legacy profiles[] docs from the scan', async () => {
    const collection = createFakeCollection([
      { agentGroup: 'g1', profiles: [{ name: 'X' }] },  // legacy, excluded
      { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' },
      { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p2' }
    ])
    const result = await findDuplicateGroups(collection)
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(2)
  })
})

describe('findNameCollisions — same (agentGroup, name) with >1 variant', () => {
  it('reports variants when same name has multiple osVer/version combos', async () => {
    const collection = createFakeCollection([
      { agentGroup: 'g1', name: 'A', osVer: 'Win10', version: '1.0', profileId: 'p1' },
      { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p2' },
      { agentGroup: 'g1', name: 'B', osVer: 'Win11', version: '1.0', profileId: 'p3' }
    ])
    const result = await findNameCollisions(collection)
    expect(result).toHaveLength(1)
    expect(result[0]._id).toEqual({ agentGroup: 'g1', name: 'A' })
    expect(result[0].count).toBe(2)
  })

  it('returns empty when every name is unique within agentGroup', async () => {
    const collection = createFakeCollection([
      { agentGroup: 'g1', name: 'A', profileId: 'p1' },
      { agentGroup: 'g1', name: 'B', profileId: 'p2' }
    ])
    const result = await findNameCollisions(collection)
    expect(result).toEqual([])
  })
})
