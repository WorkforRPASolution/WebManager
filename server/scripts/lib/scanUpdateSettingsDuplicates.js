/**
 * Shared duplicate-scan logic for UPDATE_SETTINGS per-profile documents.
 *
 * Two queries:
 *  - findDuplicateGroups: hard collisions on (agentGroup, name, osVer, version).
 *    These block adding the new compound unique index.
 *  - findNameCollisions: same (agentGroup, name) with >1 variant. Informational
 *    only — valid under option B but surfaces admin patterns worth noting.
 *
 * Both excluded legacy (profiles[]) documents.
 */

async function findDuplicateGroups(collection) {
  return collection.aggregate([
    { $match: { profiles: { $exists: false } } },
    {
      $group: {
        _id: {
          agentGroup: '$agentGroup',
          name: '$name',
          osVer: { $ifNull: ['$osVer', ''] },
          version: { $ifNull: ['$version', ''] }
        },
        count: { $sum: 1 },
        profileIds: { $push: '$profileId' },
        updatedAts: { $push: '$updatedAt' }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray()
}

async function findNameCollisions(collection) {
  return collection.aggregate([
    { $match: { profiles: { $exists: false } } },
    {
      $group: {
        _id: { agentGroup: '$agentGroup', name: '$name' },
        count: { $sum: 1 },
        variants: { $push: { profileId: '$profileId', osVer: '$osVer', version: '$version' } }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray()
}

module.exports = { findDuplicateGroups, findNameCollisions }
