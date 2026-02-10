const net = require('net')
const { SocksClient } = require('socks')

const SOCKS_PROXY_PORT = parseInt(process.env.SOCKS_PROXY_PORT) || 30000
const CONNECT_TIMEOUT = parseInt(process.env.CONNECT_TIMEOUT) || 5000

/**
 * Create a socket connection (direct or via SOCKS5 proxy)
 * @param {string} ipAddr - Direct target IP or SOCKS proxy IP
 * @param {string|null} ipAddrL - Actual target IP when using SOCKS proxy
 * @param {number} targetPort - Target port to connect to
 * @param {number|null} socksPort - Per-client SOCKS proxy port (overrides default)
 * @returns {Promise<net.Socket>} Connected socket
 */
async function createConnection(ipAddr, ipAddrL, targetPort, socksPort) {
  if (ipAddrL) {
    return createSocksConnection(ipAddr, ipAddrL, targetPort, socksPort)
  }
  return createDirectConnection(ipAddr, targetPort)
}

/**
 * Direct TCP connection with timeout
 */
function createDirectConnection(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port })

    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Connection timeout after ${CONNECT_TIMEOUT}ms to ${host}:${port}`))
    }, CONNECT_TIMEOUT)

    socket.once('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })

    socket.once('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Direct connection failed to ${host}:${port}: ${err.message}`))
    })
  })
}

/**
 * SOCKS5 proxy connection with timeout
 * WebManager -> ipAddr:socksPort (SOCKS) -> ipAddrL:targetPort
 * @param {string} proxyHost - SOCKS proxy host
 * @param {string} targetHost - Target host behind proxy
 * @param {number} targetPort - Target port
 * @param {number|null} socksPort - Per-client SOCKS proxy port (overrides default)
 */
async function createSocksConnection(proxyHost, targetHost, targetPort, socksPort) {
  const proxyPort = socksPort || SOCKS_PROXY_PORT
  try {
    const { socket } = await SocksClient.createConnection({
      proxy: {
        host: proxyHost,
        port: proxyPort,
        type: 5
      },
      command: 'connect',
      destination: {
        host: targetHost,
        port: targetPort
      },
      timeout: CONNECT_TIMEOUT
    })
    return socket
  } catch (err) {
    throw new Error(`SOCKS connection failed via ${proxyHost}:${proxyPort} to ${targetHost}:${targetPort}: ${err.message}`)
  }
}

module.exports = {
  createConnection,
  createDirectConnection,
  createSocksConnection,
  SOCKS_PROXY_PORT
}
