/**
 * Initial admin account management
 *
 * Usage:
 *   node scripts/setupAdmin.js            # 초기 관리자 계정 생성
 *   node scripts/setupAdmin.js --reset    # 비밀번호 초기화 (admin/admin, must_change)
 *   node scripts/setupAdmin.js --delete   # 초기 관리자 계정 삭제
 *
 * 프로덕션 최초 배포 시 실행하여 초기 관리자 계정을 생성합니다.
 * 실제 관리자 계정을 만든 뒤 --delete로 삭제하세요.
 */

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { connectDB, closeConnections } = require('../shared/db/connection')
const { User } = require('../features/users/model')

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12
const ADMIN_SINGLEID = 'admin'

const DEFAULT_ADMIN = {
  name: 'System Admin',
  singleid: ADMIN_SINGLEID,
  password: 'admin',
  line: 'HQ',
  process: 'MASTER',
  processes: ['MASTER'],
  department: 'IT',
  email: '',
  note: 'Initial admin account - delete after creating real admin',
  authorityManager: 1,
  authority: 'WRITE',
  accountStatus: 'active',
  passwordStatus: 'must_change',
  accessnum: 0,
  accessnum_desktop: 0
}

async function create() {
  const existing = await User.findOne({ singleid: ADMIN_SINGLEID }).lean()
  if (existing) {
    console.log(`Account '${ADMIN_SINGLEID}' already exists (use --reset or --delete)`)
    return
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, SALT_ROUNDS)
  await User.create({ ...DEFAULT_ADMIN, password: hashedPassword })

  console.log('Initial admin account created:')
  console.log(`  ID:       ${ADMIN_SINGLEID}`)
  console.log(`  Password: admin (must change on first login)`)
  console.log(`  Role:     Admin (authorityManager=1)`)
  console.log('\nAfter creating a real admin account, run:')
  console.log('  node scripts/setupAdmin.js --delete')
}

async function reset() {
  const existing = await User.findOne({ singleid: ADMIN_SINGLEID }).lean()
  if (!existing) {
    console.log(`Account '${ADMIN_SINGLEID}' not found. Run without flags to create.`)
    return
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, SALT_ROUNDS)
  await User.updateOne(
    { singleid: ADMIN_SINGLEID },
    { $set: { password: hashedPassword, accountStatus: 'active', passwordStatus: 'must_change' } }
  )

  console.log(`Account '${ADMIN_SINGLEID}' password reset to default`)
  console.log('  Password: admin (must change on first login)')
}

async function remove() {
  const result = await User.deleteOne({ singleid: ADMIN_SINGLEID })
  if (result.deletedCount > 0) {
    console.log(`Account '${ADMIN_SINGLEID}' deleted`)
  } else {
    console.log(`Account '${ADMIN_SINGLEID}' not found`)
  }
}

async function main() {
  try {
    await connectDB()

    if (process.argv.includes('--delete')) {
      await remove()
    } else if (process.argv.includes('--reset')) {
      await reset()
    } else {
      await create()
    }

    await closeConnections()
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
