const { webManagerConnection } = require('../../shared/db/connection')
const mongoose = require('mongoose')

const execCommandSchema = new mongoose.Schema({
  commandId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  commandLine: { type: String, required: true },
  args: [{ type: String }],
  timeout: { type: Number, default: 30000 },
  description: { type: String },
  category: { type: String },
  targetService: { type: String },
  active: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'EXEC_COMMANDS'
})

const ExecCommand = webManagerConnection.model('ExecCommand', execCommandSchema)

module.exports = { ExecCommand }
