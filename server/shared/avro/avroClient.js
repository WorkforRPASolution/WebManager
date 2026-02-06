const avro = require('avsc')
const { createConnection } = require('../utils/socksHelper')

// ExecCommand Avro 프로토콜 정의
const PROTOCOL = {
  namespace: 'com.sec.eeg.avro.rpc',
  protocol: 'ExecCommand',
  types: [
    {
      name: 'Request',
      type: 'record',
      fields: [
        { name: 'commandLine', type: 'string' },
        { name: 'timeout', type: 'int' },
        { name: 'args', type: { type: 'array', items: 'string' } }
      ]
    },
    {
      name: 'Response',
      type: 'record',
      fields: [
        { name: 'success', type: 'boolean' },
        { name: 'error', type: 'string' },
        { name: 'output', type: 'string' }
      ]
    }
  ],
  messages: {
    RunCommand: {
      request: [{ name: 'request', type: 'Request' }],
      response: 'Response'
    }
  }
}

const MANAGER_AGENT_PORT = parseInt(process.env.MANAGER_AGENT_PORT) || 7180

class AvroRpcClient {
  /**
   * @param {string} ipAddr - ManagerAgent 또는 Proxy 서버 IP
   * @param {string|null} ipAddrL - 실제 클라이언트 IP (SOCKS 경유 시)
   */
  constructor(ipAddr, ipAddrL = null) {
    this.ipAddr = ipAddr
    this.ipAddrL = ipAddrL
    this.socket = null
    this.client = null
    this.service = avro.Service.forProtocol(PROTOCOL)
  }

  /**
   * 연결 (직접 또는 SOCKS proxy 경유)
   */
  async connect() {
    this.socket = await createConnection(this.ipAddr, this.ipAddrL, MANAGER_AGENT_PORT)
    this._initClient()
  }

  /**
   * Avro RPC 클라이언트 초기화
   * Avro 1.7.7 Java 서버와 호환되도록 stateful 연결 사용
   */
  _initClient() {
    this.client = this.service.createClient({ strictTypes: true })
    // Avro 1.7.7 호환: stateful handshake 사용
    this.client.createChannel(this.socket, { scope: this.service.hash })
  }

  /**
   * RunCommand RPC 호출
   * @param {string} commandLine - 실행할 명령어
   * @param {string[]} args - 명령어 인자
   * @param {number} timeout - 타임아웃 (ms)
   * @returns {Promise<{success: boolean, error: string, output: string}>}
   */
  async runCommand(commandLine, args = [], timeout = 30000) {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.')
    }

    return new Promise((resolve, reject) => {
      const request = { commandLine, timeout, args }

      this.client.RunCommand(request, (err, response) => {
        if (err) {
          reject(new Error(`RPC call failed: ${err.message}`))
        } else {
          resolve(response)
        }
      })

      // 클라이언트 측 타임아웃
      setTimeout(() => {
        reject(new Error(`RPC call timeout after ${timeout}ms`))
      }, timeout + 5000) // RPC 타임아웃보다 약간 여유 있게
    })
  }

  /**
   * 연결 종료
   */
  disconnect() {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this.client = null
  }
}

module.exports = { AvroRpcClient, PROTOCOL, MANAGER_AGENT_PORT }
