const net = require('net')
const { SocksClient } = require('socks')

const SOCKS_PROXY_PORT = parseInt(process.env.SOCKS_PROXY_PORT) || 30000

/**
 * Create a socket connection (direct or via SOCKS5 proxy)
 * @param {string} ipAddr - Direct target IP or SOCKS proxy IP
 * @param {string|null} ipAddrL - Actual target IP when using SOCKS proxy
 * @param {number} targetPort - Target port to connect to
 * @returns {Promise<net.Socket>} Connected socket
 */
async function createConnection(ipAddr, ipAddrL, targetPort) {
  if (ipAddrL) {
    return createSocksConnection(ipAddr, ipAddrL, targetPort)
  }
  return createDirectConnection(ipAddr, targetPort)
}

/**
 * Direct TCP connection
 */
function createDirectConnection(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port })

    socket.once('connect', () => {
      resolve(socket)
    })

    socket.once('error', (err) => {
      reject(new Error(`Direct connection failed to ${host}:${port}: ${err.message}`))
    })
  })
}

/**
 * SOCKS5 proxy connection
 * WebManager -> ipAddr:SOCKS_PROXY_PORT (SOCKS) -> ipAddrL:targetPort
 */
async function createSocksConnection(proxyHost, targetHost, targetPort) {
  try {
    const { socket } = await SocksClient.createConnection({
      proxy: {
        host: proxyHost,
        port: SOCKS_PROXY_PORT,
        type: 5
      },
      command: 'connect',
      destination: {
        host: targetHost,
        port: targetPort
      }
    })
    return socket
  } catch (err) {
    throw new Error(`SOCKS connection failed via ${proxyHost}:${SOCKS_PROXY_PORT} to ${targetHost}:${targetPort}: ${err.message}`)
  }
}

module.exports = {
  createConnection,
  createDirectConnection,
  createSocksConnection,
  SOCKS_PROXY_PORT
}
