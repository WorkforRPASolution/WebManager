/**
 * migrate-update-settings — migration script tests (TDD)
 *
 * Uses an in-memory fake collection to exercise the migration core logic.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { flattenLegacyDoc, migrateCollection, parseArgs } from './migrate-update-settings.js'

// ─── Fake collection ────────────────────────────────────────────

function createFakeCollection(initialDocs = []) {
  const store = initialDocs.map((d, i) => ({ _id: d._id ?? `auto_${i}`, ...d }))

  function matches(doc, query) {
    for (const [key, value] of Object.entries(query)) {
      if (value && typeof value === 'object' && '$exists' in value) {
        const exists = doc[key] !== undefined
        if (value.$exists !== exists) return false
      } else if (value && typeof value === 'object' && '$in' in value) {
        if (!value.$in.includes(doc[key])) return false
      } else {
        if (doc[key] !== value) return false
      }
    }
    return true
  }

  return {
    _store: store,
    _droppedIndexes: [],
    async dropIndex(name) {
      this._droppedIndexes.push(name)
      return { ok: 1 }
    },
    find(query) {
      return {
        toArray: async () => store.filter(d => matches(d, query))
      }
    },
    async countDocuments(query) {
      return store.filter(d => matches(d, query)).length
    },
    async updateOne(filter, update, options = {}) {
      let doc = store.find(d => matches(d, filter))
      if (!doc && options.upsert) {
        doc = { _id: `gen_${store.length}`, ...(update.$setOnInsert || {}) }
        store.push(doc)
      }
      if (doc && update.$set) Object.assign(doc, update.$set)
      return { acknowledged: true }
    },
    async deleteOne(filter) {
      const idx = store.findIndex(d => matches(d, filter))
      if (idx >= 0) { store.splice(idx, 1); return { deletedCount: 1 } }
      return { deletedCount: 0 }
    }
  }
}

// ─── flattenLegacyDoc ───────────────────────────────────────────

describe('flattenLegacyDoc', () => {
  it('expands legacy doc with profiles[] into per-profile records', () => {
    const legacy = {
      agentGroup: 'EQP',
      profiles: [
        { profileId: 'prof_1', name: 'P1', tasks: [] },
        { profileId: 'prof_2', name: 'P2', tasks: [] }
      ],
      updatedBy: 'admin'
    }

    const result = flattenLegacyDoc(legacy)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ agentGroup: 'EQP', profileId: 'prof_1', name: 'P1' })
    expect(result[1]).toMatchObject({ agentGroup: 'EQP', profileId: 'prof_2', name: 'P2' })
    expect(result[0].updatedBy).toBe('admin')
  })

  it('generates profileId when missing', () => {
    const legacy = { agentGroup: 'EQP', profiles: [{ name: 'NoId' }] }
    const result = flattenLegacyDoc(legacy)
    expect(result[0].profileId).toMatch(/^prof_[0-9a-f]+$/)
  })

  it('returns empty array when no profiles', () => {
    expect(flattenLegacyDoc({ agentGroup: 'EQP' })).toEqual([])
    expect(flattenLegacyDoc({ agentGroup: 'EQP', profiles: [] })).toEqual([])
  })

  it('sanitizes source and normalizes tasks via cleanProfile', () => {
    const legacy = {
      agentGroup: 'EQP',
      profiles: [{
        profileId: 'prof_1',
        name: 'P1',
        source: { type: 'local', localPath: '/opt', ftpHost: 'stale' },
        tasks: [{ name: 'T1', sourcePath: '  a  ', targetPath: '  b  ' }]
      }]
    }
    const result = flattenLegacyDoc(legacy)
    expect(result[0].source).toEqual({ type: 'local', localPath: '/opt' })
    expect(result[0].tasks[0].sourcePath).toBe('a')
    expect(result[0].tasks[0].targetPath).toBe('b')
    expect(result[0].tasks[0].taskId).toMatch(/^task_[0-9a-f]+$/)
  })

  it('defaults updatedBy to "migration" when legacy doc lacks it', () => {
    const legacy = { agentGroup: 'EQP', profiles: [{ profileId: 'prof_1', name: 'P1' }] }
    expect(flattenLegacyDoc(legacy)[0].updatedBy).toBe('migration')
  })
})

// ─── migrateCollection ──────────────────────────────────────────

describe('migrateCollection', () => {
  it('dry-run reports counts without writing', async () => {
    const legacy = {
      agentGroup: 'EQP',
      profiles: [{ profileId: 'prof_1', name: 'P1' }, { profileId: 'prof_2', name: 'P2' }]
    }
    const collection = createFakeCollection([legacy])

    const stats = await migrateCollection(collection, { dryRun: true })

    expect(stats.legacyDocs).toBe(1)
    expect(stats.expandedProfiles).toBe(2)
    expect(stats.insertedOrSkipped).toBe(0)
    expect(stats.legacyDeleted).toBe(0)
    // Legacy doc still present
    expect(collection._store).toHaveLength(1)
    expect(collection._store[0].profiles).toBeDefined()
  })

  it('apply mode: migrates and deletes legacy doc + drops legacy index', async () => {
    const legacy = {
      agentGroup: 'EQP',
      profiles: [{ profileId: 'prof_1', name: 'P1' }, { profileId: 'prof_2', name: 'P2' }]
    }
    const collection = createFakeCollection([legacy])

    const stats = await migrateCollection(collection, { dryRun: false })

    // Legacy single-field unique index must be dropped so the new compound
    // unique can be created by mongoose on next boot.
    expect(collection._droppedIndexes).toContain('agentGroup_1')

    expect(stats.legacyDocs).toBe(1)
    expect(stats.expandedProfiles).toBe(2)
    expect(stats.insertedOrSkipped).toBe(2)
    expect(stats.legacyDeleted).toBe(1)
    expect(stats.errors).toEqual([])

    // Legacy doc removed, 2 new per-profile docs present
    const remaining = collection._store
    expect(remaining).toHaveLength(2)
    expect(remaining.every(d => !d.profiles)).toBe(true)
    expect(remaining.map(d => d.profileId).sort()).toEqual(['prof_1', 'prof_2'])
  })

  it('idempotent: second run is a no-op', async () => {
    const legacy = {
      agentGroup: 'EQP',
      profiles: [{ profileId: 'prof_1', name: 'P1' }]
    }
    const collection = createFakeCollection([legacy])

    await migrateCollection(collection, { dryRun: false })
    const stats2 = await migrateCollection(collection, { dryRun: false })

    expect(stats2.legacyDocs).toBe(0)
    expect(stats2.expandedProfiles).toBe(0)
    expect(collection._store).toHaveLength(1)
  })

  it('returns zero counts for empty collection', async () => {
    const collection = createFakeCollection([])
    const stats = await migrateCollection(collection)
    expect(stats.legacyDocs).toBe(0)
    expect(stats.expandedProfiles).toBe(0)
  })

  it('handles multiple legacy docs in one run', async () => {
    const collection = createFakeCollection([
      { agentGroup: 'EQP-A', profiles: [{ profileId: 'p1', name: 'A1' }] },
      { agentGroup: 'EQP-B', profiles: [{ profileId: 'p2', name: 'B1' }, { profileId: 'p3', name: 'B2' }] }
    ])

    const stats = await migrateCollection(collection)

    expect(stats.legacyDocs).toBe(2)
    expect(stats.expandedProfiles).toBe(3)
    expect(stats.insertedOrSkipped).toBe(3)
    expect(stats.legacyDeleted).toBe(2)
    expect(collection._store).toHaveLength(3)
  })
})

// ─── parseArgs ──────────────────────────────────────────────────

describe('parseArgs', () => {
  it('detects --dry-run', () => {
    expect(parseArgs(['node', 'script.js', '--dry-run']).dryRun).toBe(true)
  })
  it('detects --yes', () => {
    expect(parseArgs(['node', 'script.js', '--yes']).yes).toBe(true)
  })
  it('defaults both to false', () => {
    expect(parseArgs(['node', 'script.js'])).toEqual({ dryRun: false, yes: false })
  })
})
