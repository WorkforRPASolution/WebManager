/**
 * Stream Collector utility
 *
 * Creates a Writable stream that collects chunks into a Buffer.
 * Used by FTP download operations (readConfigFile, readAllConfigs, readLogFile).
 */

const { Writable } = require('stream')

/**
 * Create a Writable stream that collects all written chunks.
 * @returns {{ writable: Writable, toBuffer: function, toString: function }}
 */
function createBufferCollector() {
  const chunks = []
  const writable = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk)
      callback()
    }
  })

  return {
    /** The Writable stream to pipe/download into */
    writable,
    /** Get the collected data as a Buffer */
    toBuffer: () => Buffer.concat(chunks),
    /** Get the collected data as a string */
    toString: (encoding = 'utf-8') => Buffer.concat(chunks).toString(encoding)
  }
}

module.exports = { createBufferCollector }
