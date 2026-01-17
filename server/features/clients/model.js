const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  line: { type: String, required: true },
  lineDesc: { type: String, required: true },
  process: { type: String, required: true },
  eqpModel: { type: String, required: true },
  eqpId: { type: String, required: true },
  category: { type: String, required: true },
  IpAddr: { type: String, required: true },
  IpAddrL: { type: String },
  localpcNunber: { type: Number, required: true },
  emailcategory: { type: String, required: true },
  osVer: { type: String, required: true },
  onoffNunber: { type: Number, required: true },
  webmanagerUse: { type: Number, required: true },
  installdate: { type: String },
  scFirstExcute: { type: String },
  snapshotTimeDiff: { type: Number },
  usereleasemsg: { type: Number, required: true },
  usetkincancel: { type: Number, required: true },
}, {
  collection: 'EQP_INFO',
  timestamps: false,
});

// Index for common queries
clientSchema.index({ process: 1 });
clientSchema.index({ process: 1, eqpModel: 1 });
clientSchema.index({ eqpId: 1 }, { unique: true });

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
