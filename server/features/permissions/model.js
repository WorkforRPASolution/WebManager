/**
 * Feature Permission Model
 * FEATURE_PERMISSIONS - Feature-level R/W/D permissions per role
 *
 * Database: WEBMANAGER (WebManager-specific)
 */

const { Schema } = require('mongoose')
const { webManagerConnection } = require('../../shared/db/connection')

// Permission object schema for each role
const rolePermissionSchema = new Schema({
  read: { type: Boolean, default: false },
  write: { type: Boolean, default: false },
  delete: { type: Boolean, default: false }
}, { _id: false })

// Main feature permission schema
const featurePermissionSchema = new Schema({
  feature: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    enum: ['equipmentInfo', 'emailTemplate', 'users', 'emailInfo', 'osVersion', 'emailRecipients', 'popupTemplate']
  },
  permissions: {
    type: Map,
    of: rolePermissionSchema,
    default: () => new Map()
  },
  updatedBy: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  collection: 'FEATURE_PERMISSIONS',
  timestamps: true
})

// Default feature permissions configuration
const DEFAULT_FEATURE_PERMISSIONS = [
  {
    feature: 'equipmentInfo',
    permissions: {
      0: { read: false, write: false, delete: false },  // User
      1: { read: true, write: true, delete: true },     // Admin
      2: { read: true, write: false, delete: false },   // Conductor
      3: { read: true, write: false, delete: false }    // Manager
    }
  },
  {
    feature: 'emailTemplate',
    permissions: {
      0: { read: false, write: false, delete: false },
      1: { read: true, write: true, delete: true },
      2: { read: true, write: false, delete: false },
      3: { read: true, write: false, delete: false }
    }
  },
  {
    feature: 'users',
    permissions: {
      0: { read: false, write: false, delete: false },
      1: { read: true, write: true, delete: true },
      2: { read: true, write: false, delete: false },
      3: { read: true, write: false, delete: false }
    }
  },
  {
    feature: 'emailInfo',
    permissions: {
      0: { read: false, write: false, delete: false },
      1: { read: true, write: true, delete: true },
      2: { read: false, write: false, delete: false },
      3: { read: false, write: false, delete: false }
    }
  },
  {
    feature: 'osVersion',
    permissions: {
      0: { read: false, write: false, delete: false },
      1: { read: true, write: true, delete: true },
      2: { read: false, write: false, delete: false },
      3: { read: false, write: false, delete: false }
    }
  },
  {
    feature: 'emailRecipients',
    permissions: {
      0: { read: false, write: false, delete: false },  // User
      1: { read: true, write: true, delete: true },     // Admin
      2: { read: true, write: false, delete: false },   // Conductor
      3: { read: true, write: false, delete: false }    // Manager
    }
  },
  {
    feature: 'popupTemplate',
    permissions: {
      0: { read: false, write: false, delete: false },  // User
      1: { read: true, write: true, delete: true },     // Admin
      2: { read: true, write: false, delete: false },   // Conductor
      3: { read: true, write: false, delete: false }    // Manager
    }
  }
]

// Feature display names
const FEATURE_NAMES = {
  equipmentInfo: 'Equipment Info',
  emailTemplate: 'Email Template',
  users: 'User Management',
  emailInfo: 'Email Info',
  osVersion: 'OS Version List',
  emailRecipients: 'Email Recipients',
  popupTemplate: 'Popup Template'
}

const FeaturePermission = webManagerConnection.model('FeaturePermission', featurePermissionSchema)

module.exports = {
  FeaturePermission,
  DEFAULT_FEATURE_PERMISSIONS,
  FEATURE_NAMES
}
