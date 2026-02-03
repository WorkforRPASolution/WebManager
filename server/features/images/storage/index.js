// Storage 추상화 - 환경에 따라 스토리지 선택
const storageType = process.env.IMAGE_STORAGE || 'local';

let storage;
if (storageType === 'httpwebserver') {
  storage = require('./httpWebServerStorage');
} else {
  storage = require('./localStorage');
}

module.exports = storage;
