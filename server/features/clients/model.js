/**
 * Client Model
 * EQP_INFO - Equipment/Client information
 *
 * Database: EARS (shared with Akka server)
 */

const { Schema } = require('mongoose');
const { earsConnection } = require('../../shared/db/connection');

// EARS DB 공유 컬렉션: 정수 필드는 Akka가 NumberLong(int64)으로 저장하므로
// Schema.Types.Mixed를 사용하여 Mongoose의 double 재캐스팅을 방지합니다.
// 쓰기 시 ensureLongFields()로 BSON Long 변환, 읽기 시 MongoDB 드라이버가 자동 promote.
const { Mixed } = Schema.Types;

const clientSchema = new Schema({
  line: { type: String, required: true },
  lineDesc: { type: String, required: true },
  process: { type: String, required: true },
  eqpModel: { type: String, required: true },
  eqpId: { type: String, required: true },
  category: { type: String, required: true },
  ipAddr: { type: String, required: true },
  ipAddrL: { type: String },
  agentPorts: {
    rpc: { type: Mixed },
    ftp: { type: Mixed },
    socks: { type: Mixed },
  },
  basePath: { type: String },
  agentVersion: {
    arsAgent: { type: String },
    resourceAgent: { type: String },
  },
  localpc: { type: Mixed, required: true },
  emailcategory: { type: String, required: true },
  osVer: { type: String, required: true },
  onoff: { type: Mixed, required: true },
  webmanagerUse: { type: Mixed, required: true },
  serviceType: { type: String, trim: true },
  installdate: { type: String },
  scFirstExcute: { type: String },
  snapshotTimeDiff: { type: Mixed },
  usereleasemsg: { type: Mixed, required: true },
  usetkincancel: { type: Mixed, required: true },
}, {
  collection: 'EQP_INFO',
  timestamps: false,
});

// Index for common queries
clientSchema.index({ process: 1 });
clientSchema.index({ process: 1, eqpModel: 1 });
clientSchema.index({ eqpId: 1 }, { unique: true });
clientSchema.index({ onoff: 1 });
clientSchema.index({ ipAddr: 1, ipAddrL: 1 });

const Client = earsConnection.model('Client', clientSchema);

module.exports = Client;
