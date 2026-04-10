/**
 * AGENT_INFO Model
 * Agent 활성화 정보를 저장하는 컬렉션 (EARS DB — Akka 공유)
 * WebManager는 eqpId/IpAddr만 EQP_INFO CRUD와 연동하여 동기화
 * agent 플래그(arsagent 등)는 Akka 서버가 관리
 */

const { Schema } = require('mongoose')
const { earsConnection } = require('../../shared/db/connection')

// 정수 필드는 Mixed로 선언하여 Mongoose의 double 재캐스팅 방지
const { Mixed } = Schema.Types

const agentInfoSchema = new Schema({
  eqpId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  IpAddr: {
    type: String,
    required: true,
    trim: true
  },
  arsagent: {
    type: Mixed,
    required: true
  },
  resourceagent: {
    type: Mixed,
    required: true
  },
  aimmagent: {
    type: Mixed,
    required: true
  },
  arsagentJava: {
    type: Mixed,
    required: true
  }
}, {
  collection: 'AGENT_INFO',
  timestamps: false
})

// Note: eqpId unique index is already created by `unique: true` in schema

const AgentInfo = earsConnection.model('AgentInfo', agentInfoSchema)

module.exports = AgentInfo
