const { ExecCommand } = require('./model')

const DEFAULT_EXEC_COMMANDS = [
  {
    commandId: 'service_status',
    name: 'Check Status',
    commandLine: 'processctl',
    args: ['status'],
    timeout: 10000,
    description: '서비스 상태 확인',
    category: 'service_control',
    targetService: 'TestService',
    active: true
  },
  {
    commandId: 'service_start',
    name: 'Start Service',
    commandLine: 'processctl',
    args: ['start'],
    timeout: 30000,
    description: '서비스 시작',
    category: 'service_control',
    targetService: 'TestService',
    active: true
  },
  {
    commandId: 'service_stop',
    name: 'Stop Service',
    commandLine: 'processctl',
    args: ['stop'],
    timeout: 30000,
    description: '서비스 종료',
    category: 'service_control',
    targetService: 'TestService',
    active: true
  },
  {
    commandId: 'service_restart',
    name: 'Restart Service',
    commandLine: 'processctl',
    args: ['restart'],
    timeout: 60000,
    description: '서비스 재시작',
    category: 'service_control',
    targetService: 'TestService',
    active: true
  }
]

/**
 * EXEC_COMMANDS 컬렉션 초기화
 * 기본 명령어가 없으면 삽입
 */
async function initializeExecCommands() {
  try {
    for (const cmd of DEFAULT_EXEC_COMMANDS) {
      await ExecCommand.findOneAndUpdate(
        { commandId: cmd.commandId },
        { $setOnInsert: cmd },
        { upsert: true, new: true }
      )
    }
    console.log('ExecCommands initialized')
  } catch (error) {
    console.error('Failed to initialize ExecCommands:', error.message)
    throw error
  }
}

/**
 * 명령어 조회
 * @param {string} commandId - 명령어 ID
 * @returns {Promise<object|null>}
 */
async function getCommand(commandId) {
  return ExecCommand.findOne({ commandId, active: true })
}

/**
 * 모든 명령어 조회
 * @param {string} [category] - 카테고리 필터
 * @returns {Promise<object[]>}
 */
async function getAllCommands(category) {
  const filter = { active: true }
  if (category) filter.category = category
  return ExecCommand.find(filter)
}

module.exports = {
  initializeExecCommands,
  getCommand,
  getAllCommands,
  DEFAULT_EXEC_COMMANDS
}
