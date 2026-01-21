/**
 * User and Role Permission Models
 * ARS_USER_INFO - User collection (extended from RPA system)
 * WEBMANAGER_ROLE_PERMISSIONS - Role permissions collection
 */

const mongoose = require('mongoose')
const { Schema } = mongoose

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
    maxlength: 50
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
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
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
  }
}, {
  collection: 'ARS_USER_INFO',
  timestamps: true
})

// Indexes (singleid unique index already created by unique: true in schema)
userSchema.index({ process: 1 })
userSchema.index({ line: 1 })
userSchema.index({ authorityManager: 1 })
userSchema.index({ isActive: 1 })

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
    clients: { type: Boolean, default: true },
    master: { type: Boolean, default: false },
    emailTemplate: { type: Boolean, default: false },
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
      clients: false,
      master: false,
      emailTemplate: false,
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
      clients: true,
      master: true,
      emailTemplate: true,
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
      clients: false,
      master: false,
      emailTemplate: false,
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
      clients: false,
      master: false,
      emailTemplate: false,
      alerts: false,
      settings: false,
      users: false
    }
  }
]

const User = mongoose.model('User', userSchema)
const RolePermission = mongoose.model('RolePermission', rolePermissionSchema)

module.exports = {
  User,
  RolePermission,
  DEFAULT_ROLE_PERMISSIONS
}
