/**
 * OS Version service - Database operations and business logic
 */

const OSVersion = require('./model')
const { validateBatchCreate, validateUpdate } = require('./validation')

// ============================================
// Default OS Versions (for initialization)
// ============================================
const DEFAULT_OS_VERSIONS = [
  { version: 'Windows 10', description: 'Windows 10 Enterprise', active: true },
  { version: 'Windows 11', description: 'Windows 11 Enterprise', active: true }
]

// ============================================
// Initialization
// ============================================

/**
 * Initialize OS versions if collection is empty
 * Called on server startup
 */
async function initializeOSVersions() {
  const count = await OSVersion.countDocuments()
  if (count === 0) {
    await OSVersion.insertMany(DEFAULT_OS_VERSIONS)
    console.log(`  + Created ${DEFAULT_OS_VERSIONS.length} default OS versions`)
    return true
  }
  return false
}

// ============================================
// Service Methods
// ============================================

/**
 * Get all OS versions
 */
async function getAll() {
  const items = await OSVersion.find({}).sort({ version: 1 }).lean()
  return items
}

/**
 * Get distinct active versions (for dropdown)
 */
async function getDistinct() {
  const items = await OSVersion.find({ active: true }, 'version').sort({ version: 1 }).lean()
  return items.map(item => item.version)
}

/**
 * Create multiple OS version records
 * @param {Array} itemsData - Array of OS version data
 * @param {Object} context - Execution context (user, etc.)
 */
async function createOSVersion(itemsData, context = {}) {
  const errors = []

  // Get existing versions for uniqueness validation
  const existingItems = await OSVersion.find({}, 'version').lean()
  const existingVersions = existingItems.map(item => item.version.toLowerCase())

  // Validate format and uniqueness
  const { valid, errors: validationErrors } = validateBatchCreate(itemsData, existingVersions)

  for (const err of validationErrors) {
    errors.push({
      rowIndex: err.rowIndex,
      field: err.field,
      message: err.message
    })
  }

  // Insert valid items
  let created = 0
  if (valid.length > 0) {
    const insertedDocs = await OSVersion.insertMany(valid)
    created = insertedDocs.length
  }

  return { created, errors }
}

/**
 * Update multiple OS version records
 * @param {Array} itemsData - Array of OS version data (with _id)
 * @param {Object} context - Execution context (user, etc.)
 */
async function updateOSVersion(itemsData, context = {}) {
  const errors = []
  let updated = 0

  // Get all items' data for uniqueness validation
  const allItems = await OSVersion.find({}).lean()
  const itemsById = new Map(allItems.map(item => [item._id.toString(), item]))

  for (let i = 0; i < itemsData.length; i++) {
    const itemData = itemsData[i]
    const { _id, ...updateData } = itemData

    if (!_id) {
      errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
      continue
    }

    // Get existing document
    const existingDoc = itemsById.get(_id)
    if (!existingDoc) {
      errors.push({ rowIndex: i, field: '_id', message: 'Document not found' })
      continue
    }

    // Get other items (excluding current one) for uniqueness validation
    const otherItems = allItems.filter(item => item._id.toString() !== _id)
    const existingVersions = otherItems.map(item => item.version.toLowerCase())

    // Validate format and uniqueness
    const validation = validateUpdate(updateData, existingVersions)

    if (!validation.valid) {
      for (const [field, message] of Object.entries(validation.errors)) {
        errors.push({ rowIndex: i, field, message })
      }
      continue
    }

    // Perform update
    const result = await OSVersion.updateOne({ _id }, { $set: updateData })
    if (result.modifiedCount > 0) {
      updated++
    }
  }

  return { updated, errors }
}

/**
 * Delete multiple OS version records
 * @param {Array} ids - Array of _id values to delete
 * @param {Object} context - Execution context (user, etc.)
 */
async function deleteOSVersion(ids, context = {}) {
  const result = await OSVersion.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

module.exports = {
  initializeOSVersions,
  getAll,
  getDistinct,
  createOSVersion,
  updateOSVersion,
  deleteOSVersion
}
