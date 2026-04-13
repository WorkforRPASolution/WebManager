export function mapEarsUserToRow(earsUser) {
  return {
    singleid: (earsUser.mail || '').split('@')[0],
    name: earsUser.cn || '',
    department: earsUser.department || ''
  }
}
