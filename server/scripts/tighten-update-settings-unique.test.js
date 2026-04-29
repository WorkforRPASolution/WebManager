/**
 * tighten-update-settings-unique — unique index swap tests (TDD)
 *
 * Uses an in-memory fake collection (same pattern as migrate-update-settings).
 */

import { describe, it, expect } from 'vitest'
import { tightenCollection, parseArgs } from './tighten-update-settings-unique.js'

function createFakeCollection(initialDocs = [], initialIndexes = []) {
  const store = initialDocs.map((d, i) => ({ _id: d._id ?? `auto_${i}`, ...d }))
  const indexes = initialIndexes.slice()

  return {
    _store: store,
    _indexes: indexes,
    _droppedIndexes: [],
    _createdIndexes: [],

    async dropIndex(name) {
      this._droppedIndexes.push(name)
      const idx = indexes.findIndex(i => i.name === name)
      if (idx < 0) {
        const err = new Error(`index not found with name [${name}]`)
        err.codeName = 'IndexNotFound'
        throw err
      }
      indexes.splice(idx, 1)
      return { ok: 1 }
    },
    async createIndex(spec, options = {}) {
      const name = options.name || Object.keys(spec).map(k => `${k}_${spec[k]}`).join('_')
      this._createdIndexes.push({ spec, options, name })
      indexes.push({ key: spec, name, unique: !!options.unique })
      return name
    },
    async indexes() {
      return indexes.slice()
    },

    aggregate(pipeline) {
      return {
        toArray: async () => runPipeline(store, pipeline)
      }
    }
  }
}

function runPipeline(input, pipeline) {
  let rows = input.slice()
  for (const stage of pipeline) {
    if (stage.$match) rows = rows.filter(r => matchDoc(r, stage.$match))
    else if (stage.$group) rows = groupDocs(rows, stage.$group)
    else if (stage.$sort) {
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
  if (typeof expr === 'string' && expr.startsWith('$')) return row[expr.slice(1)]
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

// ─── Tests ──────────────────────────────────────────────────────

describe('tightenCollection — dry-run mode', () => {
  it('reports zero duplicates and does not modify indexes', async () => {
    const collection = createFakeCollection(
      [
        { agentGroup: 'g1', name: 'A', osVer: '', version: '1.0', profileId: 'p1' },
        { agentGroup: 'g1', name: 'A', osVer: '', version: '2.0', profileId: 'p2' }
      ],
      [{ key: { agentGroup: 1, profileId: 1 }, name: 'agentGroup_1_profileId_1', unique: true }]
    )

    const stats = await tightenCollection(collection, { dryRun: true })

    expect(stats.duplicateGroups).toBe(0)
    expect(stats.indexDropped).toBe(false)
    expect(stats.indexCreated).toBe(false)
    expect(collection._droppedIndexes).toEqual([])
    expect(collection._createdIndexes).toEqual([])
  })

  it('reports duplicate groups and does not modify indexes', async () => {
    const collection = createFakeCollection(
      [
        { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' },
        { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p2' }
      ],
      [{ key: { agentGroup: 1, profileId: 1 }, name: 'agentGroup_1_profileId_1', unique: true }]
    )

    const stats = await tightenCollection(collection, { dryRun: true })

    expect(stats.duplicateGroups).toBe(1)
    expect(stats.duplicates[0].count).toBe(2)
    expect(collection._droppedIndexes).toEqual([])
    expect(collection._createdIndexes).toEqual([])
  })
})

describe('tightenCollection — apply mode with no duplicates', () => {
  it('drops old unique index and creates new compound unique', async () => {
    const collection = createFakeCollection(
      [
        { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' },
        { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '2.0', profileId: 'p2' }
      ],
      [{ key: { agentGroup: 1, profileId: 1 }, name: 'agentGroup_1_profileId_1', unique: true }]
    )

    const stats = await tightenCollection(collection, { dryRun: false })

    expect(stats.duplicateGroups).toBe(0)
    expect(stats.indexDropped).toBe(true)
    expect(stats.indexCreated).toBe(true)

    expect(collection._droppedIndexes).toContain('agentGroup_1_profileId_1')
    const created = collection._createdIndexes.map(i => i.name)
    expect(created).toContain('agentGroup_name_osVer_version_unique')
    expect(created).toContain('agentGroup_1_profileId_1')  // recreated as non-unique

    const uniqueIdx = collection._createdIndexes.find(
      i => i.name === 'agentGroup_name_osVer_version_unique'
    )
    expect(uniqueIdx.options.unique).toBe(true)

    const lookupIdx = collection._createdIndexes.find(
      i => i.name === 'agentGroup_1_profileId_1'
    )
    expect(lookupIdx.options.unique).toBeFalsy()
  })

  it('is idempotent: no-op when both new unique and non-unique lookup exist', async () => {
    const collection = createFakeCollection(
      [{ agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' }],
      [
        { key: { agentGroup: 1, name: 1, osVer: 1, version: 1 }, name: 'agentGroup_name_osVer_version_unique', unique: true },
        { key: { agentGroup: 1, profileId: 1 }, name: 'agentGroup_1_profileId_1', unique: false }
      ]
    )

    const stats = await tightenCollection(collection, { dryRun: false })

    expect(stats.alreadyTightened).toBe(true)
    expect(collection._droppedIndexes).toEqual([])
    expect(collection._createdIndexes).toEqual([])
  })

  it('partial state — new unique exists but legacy lookup still unique: drops legacy, recreates non-unique', async () => {
    // Scenario: server boot auto-created the new compound unique via mongoose
    // createIndexes(), but the legacy (agentGroup, profileId) unique was never
    // dropped. The script must still complete the transition.
    const collection = createFakeCollection(
      [{ agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' }],
      [
        { key: { agentGroup: 1, name: 1, osVer: 1, version: 1 }, name: 'agentGroup_name_osVer_version_unique', unique: true },
        { key: { agentGroup: 1, profileId: 1 }, name: 'agentGroup_1_profileId_1', unique: true }  // still unique
      ]
    )

    const stats = await tightenCollection(collection, { dryRun: false })

    expect(stats.alreadyTightened).toBe(false)
    expect(collection._droppedIndexes).toContain('agentGroup_1_profileId_1')
    // New unique must NOT be created again (it already exists).
    const created = collection._createdIndexes.map(i => i.name)
    expect(created).not.toContain('agentGroup_name_osVer_version_unique')
    // Lookup index must be recreated as non-unique.
    expect(created).toContain('agentGroup_1_profileId_1')
    const lookupIdx = collection._createdIndexes.find(i => i.name === 'agentGroup_1_profileId_1')
    expect(lookupIdx.options.unique).toBeFalsy()
  })

  it('tolerates missing legacy index (NotFound error)', async () => {
    const collection = createFakeCollection(
      [{ agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' }],
      []  // no indexes at all
    )

    const stats = await tightenCollection(collection, { dryRun: false })

    expect(stats.indexCreated).toBe(true)
    expect(stats.errors).toEqual([])
  })
})

describe('tightenCollection — apply mode with duplicates', () => {
  it('refuses to tighten when duplicates exist (no writes)', async () => {
    const collection = createFakeCollection(
      [
        { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p1' },
        { agentGroup: 'g1', name: 'A', osVer: 'Win11', version: '1.0', profileId: 'p2' }
      ],
      [{ key: { agentGroup: 1, profileId: 1 }, name: 'agentGroup_1_profileId_1', unique: true }]
    )

    const stats = await tightenCollection(collection, { dryRun: false })

    expect(stats.duplicateGroups).toBe(1)
    expect(stats.indexDropped).toBe(false)
    expect(stats.indexCreated).toBe(false)
    expect(stats.aborted).toBe(true)
    expect(collection._droppedIndexes).toEqual([])
    expect(collection._createdIndexes).toEqual([])
  })
})

describe('parseArgs', () => {
  it('detects --dry-run', () => {
    expect(parseArgs(['node', 's.js', '--dry-run']).dryRun).toBe(true)
  })
  it('detects --yes', () => {
    expect(parseArgs(['node', 's.js', '--yes']).yes).toBe(true)
  })
  it('defaults both to false', () => {
    expect(parseArgs(['node', 's.js'])).toEqual({ dryRun: false, yes: false })
  })
})
