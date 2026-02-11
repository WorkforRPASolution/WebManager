/**
 * User and Role Permission Models
 * ARS_USER_INFO - User collection (EARS DB - shared with Akka)
 * WEBMANAGER_ROLE_PERMISSIONS - Role permissions collection (WEBMANAGER DB)
 */

const { Schema } = require('mongoose')
const { earsConnection, webManagerConnection } = require('../../shared/db/connection')

// ===========================================
// ARS_USER_INFO Schema (Extended)
// ===========================================
const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  singleid: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  password: {
    type: String,
    required: true
  },
  line: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  process: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200  // Increased for `;` separated values (e.g., "CVD;ETCH;PHOTO")
  },
  // WebManager용 배열 필드 (Multi Process 지원)
  // process 필드와 자동 동기화됨
  processes: {
    type: [String],
    default: []
  },
  authority: {
    type: String,
    trim: true,
    default: '',
    enum: ['', 'WRITE']
  },
  authorityManager: {
    type: Number,
    required: true,
    min: 0,
    max: 3,
    default: 3
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  department: {
    type: String,
    trim: true,
    default: ''
  },
  // Account lifecycle status
  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'active'
  },
  // Password lifecycle status
  passwordStatus: {
    type: String,
    enum: ['normal', 'reset_requested', 'must_change'],
    default: 'normal'
  },
  passwordResetRequestedAt: {
    type: Date,
    default: null
  },
  accessnum: {
    type: Number,
    default: 0
  },
  accessnum_desktop: {
    type: Number,
    default: 0
  },
  lastExecution: {
    type: String,
    default: ''
  },
  webmanagerLoginInfo: {
    lastLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 }
  }
}, {
  collection: 'ARS_USER_INFO',
  timestamps: false
})

// Indexes (singleid unique index already created by unique: true in schema)
userSchema.index({ process: 1 })
userSchema.index({ processes: 1 })  // Multikey Index for array field
userSchema.index({ line: 1 })
userSchema.index({ authorityManager: 1 })
userSchema.index({ accountStatus: 1 })
userSchema.index({ passwordStatus: 1 })

// ===========================================
// WEBMANAGER_ROLE_PERMISSIONS Schema
// ===========================================
const rolePermissionSchema = new Schema({
  roleLevel: {
    type: Number,
    required: true,
    unique: true,
    min: 0,
    max: 3
  },
  roleName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  permissions: {
    dashboard: { type: Boolean, default: true },
    arsAgent: { type: Boolean, default: true },
    resourceAgent: { type: Boolean, default: true },
    equipmentInfo: { type: Boolean, default: false },
    emailTemplate: { type: Boolean, default: false },
    popupTemplate: { type: Boolean, default: false },
    emailRecipients: { type: Boolean, default: false },
    emailInfo: { type: Boolean, default: false },
    alerts: { type: Boolean, default: true },
    settings: { type: Boolean, default: false },
    users: { type: Boolean, default: false }
  }
}, {
  collection: 'WEBMANAGER_ROLE_PERMISSIONS',
  timestamps: true
})

// Note: roleLevel unique index already created by unique: true in schema

// Default role permissions configuration
const DEFAULT_ROLE_PERMISSIONS = [
  {
    roleLevel: 0,
    roleName: 'User',
    description: '일반 유저',
    permissions: {
      dashboard: true,
      arsAgent: false,
      resourceAgent: false,
      equipmentInfo: false,
      emailTemplate: false,
      popupTemplate: false,
      emailRecipients: false,
      emailInfo: false,
      alerts: false,
      settings: false,
      users: false
    }
  },
  {
    roleLevel: 1,
    roleName: 'Admin',
    description: '시스템 관리자',
    permissions: {
      dashboard: true,
      arsAgent: true,
      resourceAgent: true,
      equipmentInfo: true,
      emailTemplate: true,
      popupTemplate: true,
      emailRecipients: true,
      emailInfo: true,
      alerts: true,
      settings: true,
      users: true
    }
  },
  {
    roleLevel: 2,
    roleName: 'Conductor',
    description: '유저 중 최고 관리자',
    permissions: {
      dashboard: true,
      arsAgent: false,
      resourceAgent: false,
      equipmentInfo: false,
      emailTemplate: false,
      popupTemplate: false,
      emailRecipients: false,
      emailInfo: false,
      alerts: false,
      settings: false,
      users: false
    }
  },
  {
    roleLevel: 3,
    roleName: 'Manager',
    description: '유저 중 관리자',
    permissions: {
      dashboard: true,
      arsAgent: false,
      resourceAgent: false,
      equipmentInfo: false,
      emailTemplate: false,
      popupTemplate: false,
      emailRecipients: false,
      emailInfo: false,
      alerts: false,
      settings: false,
      users: false
    }
  }
]

// User model uses EARS database (shared with Akka)
const User = earsConnection.model('User', userSchema)

// RolePermission model uses WEBMANAGER database (WebManager-specific)
const RolePermission = webManagerConnection.model('RolePermission', rolePermissionSchema)

module.exports = {
  User,
  RolePermission,
  DEFAULT_ROLE_PERMISSIONS
}
