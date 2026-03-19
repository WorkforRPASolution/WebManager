import { describe, it, expect } from 'vitest'
import {
  menuPermissionGroups,
  featurePermissionGroups,
  formatPermissionName,
  toggleGroupAll,
  hasMenuChanges,
  discardMenuChanges,
  getFilteredFeaturePermissions,
  hasFeatureChanges,
  discardFeatureChanges,
  toggleFeatureGroupAll,
} from '../permissionUtils.js'

// ──────────────────────────────────────
// Menu Permission 유틸리티
// ──────────────────────────────────────
describe('Menu Permission 유틸리티', () => {
  describe('menuPermissionGroups', () => {
    it('5개 그룹이 정의되어 있어야 함', () => {
      expect(menuPermissionGroups).toHaveLength(5)
    })

    it('Dashboard 그룹에 5개 항목', () => {
      const dashboard = menuPermissionGroups.find(g => g.label === 'Dashboard')
      expect(dashboard.keys).toHaveLength(5)
    })

    it('Dashboard - Recovery 그룹에 3개 항목', () => {
      const recovery = menuPermissionGroups.find(g => g.label === 'Dashboard - Recovery')
      expect(recovery.keys).toHaveLength(3)
    })

    it('Clients 그룹에 2개 항목', () => {
      const clients = menuPermissionGroups.find(g => g.label === 'Clients')
      expect(clients.keys).toHaveLength(2)
    })

    it('기준정보 관리 그룹에 7개 항목', () => {
      const masterdata = menuPermissionGroups.find(g => g.label === '기준정보 관리')
      expect(masterdata.keys).toHaveLength(7)
    })

    it('System 그룹에 2개 항목', () => {
      const system = menuPermissionGroups.find(g => g.label === 'System')
      expect(system.keys).toHaveLength(2)
    })
  })

  describe('formatPermissionName', () => {
    it('알려진 키를 사람이 읽을 수 있는 이름으로 변환', () => {
      expect(formatPermissionName('dashboardOverview')).toBe('Overview')
      expect(formatPermissionName('dashboardArsMonitor')).toBe('ARSAgent Status')
      expect(formatPermissionName('equipmentInfo')).toBe('Equipment Info')
      expect(formatPermissionName('users')).toBe('User Management')
    })

    it('알 수 없는 키는 그대로 반환', () => {
      expect(formatPermissionName('unknownKey')).toBe('unknownKey')
    })
  })

  describe('toggleGroupAll', () => {
    it('그룹별 All 토글 시 해당 그룹 모든 항목 변경', () => {
      const roles = [
        { roleLevel: 2, roleName: 'Conductor', permissions: { dashboardOverview: false, dashboardArsMonitor: false, dashboardArsVersion: false, dashboardResStatus: false, dashboardResVersion: false } }
      ]
      const groupKeys = ['dashboardOverview', 'dashboardArsMonitor', 'dashboardArsVersion', 'dashboardResStatus', 'dashboardResVersion']

      toggleGroupAll(roles, groupKeys, 2, true)

      const role = roles.find(r => r.roleLevel === 2)
      groupKeys.forEach(key => {
        expect(role.permissions[key]).toBe(true)
      })
    })

    it('All 토글 해제 시 해당 그룹 모든 항목 false', () => {
      const roles = [
        { roleLevel: 2, roleName: 'Conductor', permissions: { dashboardOverview: true, dashboardArsMonitor: true, dashboardArsVersion: true, dashboardResStatus: true, dashboardResVersion: true } }
      ]
      const groupKeys = ['dashboardOverview', 'dashboardArsMonitor', 'dashboardArsVersion', 'dashboardResStatus', 'dashboardResVersion']

      toggleGroupAll(roles, groupKeys, 2, false)

      const role = roles.find(r => r.roleLevel === 2)
      groupKeys.forEach(key => {
        expect(role.permissions[key]).toBe(false)
      })
    })

    it('Admin(level 1) 권한은 변경하지 않음', () => {
      const roles = [
        { roleLevel: 1, roleName: 'Admin', permissions: { dashboardOverview: true, dashboardArsMonitor: true } }
      ]
      const groupKeys = ['dashboardOverview', 'dashboardArsMonitor']

      toggleGroupAll(roles, groupKeys, 1, false)

      const role = roles.find(r => r.roleLevel === 1)
      expect(role.permissions.dashboardOverview).toBe(true)
      expect(role.permissions.dashboardArsMonitor).toBe(true)
    })
  })

  describe('hasMenuChanges', () => {
    it('변경 감지: 원본과 다른 값이 있으면 true', () => {
      const original = [
        { roleLevel: 2, permissions: { dashboardOverview: true, dashboardArsMonitor: false } }
      ]
      const current = [
        { roleLevel: 2, permissions: { dashboardOverview: true, dashboardArsMonitor: true } }
      ]
      expect(hasMenuChanges(original, current)).toBe(true)
    })

    it('변경 없으면 false', () => {
      const original = [
        { roleLevel: 2, permissions: { dashboardOverview: true, dashboardArsMonitor: false } }
      ]
      const current = [
        { roleLevel: 2, permissions: { dashboardOverview: true, dashboardArsMonitor: false } }
      ]
      expect(hasMenuChanges(original, current)).toBe(false)
    })
  })

  describe('discardMenuChanges', () => {
    it('Discard 시 원본 상태로 복원 (deep clone)', () => {
      const original = [
        { roleLevel: 2, roleName: 'Conductor', permissions: { dashboardOverview: true, dashboardArsMonitor: false } }
      ]
      const restored = discardMenuChanges(original)

      expect(restored).toEqual(original)
      // deep clone 확인 - 원본과 다른 객체
      expect(restored).not.toBe(original)
      expect(restored[0]).not.toBe(original[0])
      expect(restored[0].permissions).not.toBe(original[0].permissions)
    })
  })
})

// ──────────────────────────────────────
// Feature Permission 유틸리티
// ──────────────────────────────────────
describe('Feature Permission 유틸리티', () => {
  describe('featurePermissionGroups', () => {
    it('2개 그룹이 정의되어 있어야 함', () => {
      expect(featurePermissionGroups).toHaveLength(2)
    })

    it('Clients 그룹은 clientControl 1개 항목', () => {
      const clients = featurePermissionGroups.find(g => g.label === 'Clients')
      expect(clients.keys).toHaveLength(1)
      expect(clients.keys[0].key).toBe('clientControl')
    })

    it('Clients 그룹은 Monitoring/Operations/Deploy 라벨 사용', () => {
      const clients = featurePermissionGroups.find(g => g.label === 'Clients')
      expect(clients.columnLabels).toEqual({
        read: 'Monitoring',
        write: 'Operations',
        delete: 'Deploy'
      })
    })

    it('기준정보 관리 그룹은 7개 항목', () => {
      const masterdata = featurePermissionGroups.find(g => g.label === '기준정보 관리')
      expect(masterdata.keys).toHaveLength(7)
    })

    it('기준정보 관리 그룹은 Read/Write/Delete 라벨 사용', () => {
      const masterdata = featurePermissionGroups.find(g => g.label === '기준정보 관리')
      expect(masterdata.columnLabels).toEqual({
        read: 'Read',
        write: 'Write',
        delete: 'Delete'
      })
    })
  })

  describe('getFilteredFeaturePermissions', () => {
    it('osVersion은 매트릭스에 표시하지 않음', () => {
      const permissions = [
        { feature: 'equipmentInfo', permissions: {} },
        { feature: 'osVersion', permissions: {} },
        { feature: 'emailTemplate', permissions: {} },
        { feature: 'clientControl', permissions: {} },
      ]
      const filtered = getFilteredFeaturePermissions(permissions)
      expect(filtered.find(p => p.feature === 'osVersion')).toBeUndefined()
      expect(filtered).toHaveLength(3)
    })

    it('osVersion이 없는 경우에도 정상 동작', () => {
      const permissions = [
        { feature: 'equipmentInfo', permissions: {} },
      ]
      const filtered = getFilteredFeaturePermissions(permissions)
      expect(filtered).toHaveLength(1)
    })
  })

  describe('toggleFeatureGroupAll', () => {
    it('그룹 전체 토글 시 해당 그룹 모든 항목+역할의 모든 action 변경', () => {
      const featurePerms = {
        equipmentInfo: {
          permissions: { 2: { read: false, write: false, delete: false } }
        },
        emailTemplate: {
          permissions: { 2: { read: false, write: false, delete: false } }
        },
      }
      const groupKeys = ['equipmentInfo', 'emailTemplate']

      toggleFeatureGroupAll(featurePerms, groupKeys, 2, true)

      expect(featurePerms.equipmentInfo.permissions[2]).toEqual({ read: true, write: true, delete: true })
      expect(featurePerms.emailTemplate.permissions[2]).toEqual({ read: true, write: true, delete: true })
    })

    it('Admin(level 1) 권한은 변경하지 않음', () => {
      const featurePerms = {
        equipmentInfo: {
          permissions: { 1: { read: true, write: true, delete: true } }
        },
      }
      const groupKeys = ['equipmentInfo']

      toggleFeatureGroupAll(featurePerms, groupKeys, 1, false)

      expect(featurePerms.equipmentInfo.permissions[1]).toEqual({ read: true, write: true, delete: true })
    })
  })

  describe('hasFeatureChanges', () => {
    it('변경 감지: 원본과 다른 값이 있으면 true', () => {
      const original = {
        equipmentInfo: { permissions: { 2: { read: true, write: false, delete: false } } }
      }
      const current = {
        equipmentInfo: { permissions: { 2: { read: true, write: true, delete: false } } }
      }
      expect(hasFeatureChanges(original, current)).toBe(true)
    })

    it('변경 없으면 false', () => {
      const original = {
        equipmentInfo: { permissions: { 2: { read: true, write: false, delete: false } } }
      }
      const current = {
        equipmentInfo: { permissions: { 2: { read: true, write: false, delete: false } } }
      }
      expect(hasFeatureChanges(original, current)).toBe(false)
    })
  })

  describe('discardFeatureChanges', () => {
    it('변경 감지 및 Discard 동작', () => {
      const original = {
        equipmentInfo: { feature: 'equipmentInfo', permissions: { 2: { read: true, write: false, delete: false } } }
      }
      const restored = discardFeatureChanges(original)

      expect(restored).toEqual(original)
      // deep clone 확인
      expect(restored).not.toBe(original)
      expect(restored.equipmentInfo).not.toBe(original.equipmentInfo)
      expect(restored.equipmentInfo.permissions).not.toBe(original.equipmentInfo.permissions)
    })
  })
})
