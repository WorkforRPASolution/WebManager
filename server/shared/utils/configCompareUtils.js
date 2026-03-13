/**
 * N-way Config Compare 순수 함수 유틸리티
 * - flattenJson: JSON → Map<path, {value, type}>
 * - buildKeyTree: 키 합집합 → TreeNode[] 계층 구조
 * - computeDiff: baseline 기준 차이 계산
 * - filterDiffOnly: 차이 있는 키만 필터링
 */

/**
 * JSON 객체를 dot-notation flat Map으로 변환
 * @param {object} obj
 * @param {string} prefix
 * @returns {Map<string, {value?, type, length?}>}
 */
export function flattenJson(obj, prefix = '') {
  const result = new Map()

  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (val === null) {
      result.set(path, { value: null, type: 'null' })
    } else if (Array.isArray(val)) {
      result.set(path, { type: 'array', length: val.length })
      for (let i = 0; i < val.length; i++) {
        const itemPath = `${path}.${i}`
        if (val[i] !== null && typeof val[i] === 'object' && !Array.isArray(val[i])) {
          result.set(itemPath, { type: 'object' })
          for (const [k, v] of flattenJson(val[i], itemPath)) {
            result.set(k, v)
          }
        } else if (Array.isArray(val[i])) {
          for (const [k, v] of flattenJson({ [i]: val[i] }, path)) {
            result.set(k, v)
          }
        } else if (val[i] === null) {
          result.set(itemPath, { value: null, type: 'null' })
        } else {
          result.set(itemPath, { value: val[i], type: typeof val[i] })
        }
      }
    } else if (typeof val === 'object') {
      result.set(path, { type: 'object' })
      for (const [k, v] of flattenJson(val, path)) {
        result.set(k, v)
      }
    } else {
      result.set(path, { value: val, type: typeof val })
    }
  }

  return result
}

/**
 * 여러 클라이언트의 키 합집합으로 TreeNode[] 계층 구조 빌드
 * @param {string[][]} keySets - 각 클라이언트의 키 배열
 * @returns {TreeNode[]}
 */
export function buildKeyTree(keySets) {
  // 합집합
  const allKeys = new Set()
  for (const keys of keySets) {
    for (const k of keys) allKeys.add(k)
  }

  // 부모-자식 관계 빌드
  const root = []
  const nodeMap = new Map()

  // 키를 정렬 (짧은 것 먼저, 같은 depth 내 알파벳순)
  const sorted = [...allKeys].sort()

  for (const fullPath of sorted) {
    const parts = fullPath.split('.')
    const key = parts[parts.length - 1]
    const depth = parts.length - 1

    const node = { key, fullPath, isLeaf: true, children: [], depth }
    nodeMap.set(fullPath, node)

    if (parts.length === 1) {
      root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join('.')
      const parent = nodeMap.get(parentPath)
      if (parent) {
        parent.isLeaf = false
        parent.children.push(node)
      } else {
        // 부모가 없으면 루트에 추가 (안전장치)
        root.push(node)
      }
    }
  }

  return root
}

/**
 * baseline 기준으로 각 키 × 각 클라이언트 diff 계산
 * 비-리프 키(object/array 마커)는 스킵
 * @param {string} baselineEqpId
 * @param {Object<string, Map>} clientFlatMaps - { eqpId: flatMap }
 * @param {string[]} allKeys
 * @returns {Map<string, Map<string, {value?, isDifferent, isMissing, type?}>>}
 */
export function computeDiff(baselineEqpId, clientFlatMaps, allKeys) {
  const result = new Map()
  const eqpIds = Object.keys(clientFlatMaps)

  for (const key of allKeys) {
    // 비-리프 키(object/array 마커) 스킵
    const baseEntry = clientFlatMaps[baselineEqpId]?.get(key)
    if (baseEntry && (baseEntry.type === 'object' || baseEntry.type === 'array')) {
      continue
    }
    // 다른 클라이언트에서도 object/array인지 확인
    let isStructural = false
    for (const eqpId of eqpIds) {
      const entry = clientFlatMaps[eqpId]?.get(key)
      if (entry && (entry.type === 'object' || entry.type === 'array')) {
        isStructural = true
        break
      }
    }
    if (isStructural) continue

    const baselineVal = clientFlatMaps[baselineEqpId]?.get(key)
    const baselineStr = baselineVal ? JSON.stringify(baselineVal.value) : undefined
    const baselineMissing = !clientFlatMaps[baselineEqpId]?.has(key)

    const keyDiff = new Map()
    for (const eqpId of eqpIds) {
      const entry = clientFlatMaps[eqpId]?.get(key)
      if (!entry) {
        keyDiff.set(eqpId, {
          value: undefined,
          isDifferent: true,
          isMissing: true,
          type: undefined
        })
      } else if (eqpId === baselineEqpId) {
        keyDiff.set(eqpId, {
          value: entry.value,
          isDifferent: baselineMissing,
          isMissing: false,
          type: entry.type
        })
      } else {
        const currentStr = JSON.stringify(entry.value)
        const isDifferent = baselineMissing || baselineStr !== currentStr
        keyDiff.set(eqpId, {
          value: entry.value,
          isDifferent,
          isMissing: false,
          type: entry.type
        })
      }
    }

    result.set(key, keyDiff)
  }

  return result
}

/**
 * 차이 있는 키만 필터링 (부모 경로 자동 포함)
 * @param {Map} diffMap - computeDiff 결과
 * @returns {Set<string>} 표시해야 할 키 경로 집합
 */
export function filterDiffOnly(diffMap) {
  const result = new Set()

  for (const [key, eqpMap] of diffMap) {
    let hasDiff = false
    for (const [, cellData] of eqpMap) {
      if (cellData.isDifferent) {
        hasDiff = true
        break
      }
    }
    if (hasDiff) {
      result.add(key)
      // 부모 경로 추가
      const parts = key.split('.')
      for (let i = 1; i < parts.length; i++) {
        result.add(parts.slice(0, i).join('.'))
      }
    }
  }

  return result
}
