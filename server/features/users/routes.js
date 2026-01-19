const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const User = require('./model')

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12

// 유효성 검사 함수
function validateUserData(data, isUpdate = false) {
  const errors = []

  if (!isUpdate || data.username !== undefined) {
    if (!data.username || data.username.trim().length < 3) {
      errors.push({ field: 'username', message: 'Username must be at least 3 characters' })
    }
  }

  if (!isUpdate || data.email !== undefined) {
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push({ field: 'email', message: 'Invalid email format' })
    }
  }

  if (!isUpdate || data.password !== undefined) {
    if (!isUpdate && (!data.password || data.password.length < 4)) {
      errors.push({ field: 'password', message: 'Password must be at least 4 characters' })
    }
  }

  if (!isUpdate || data.name !== undefined) {
    if (!data.name || data.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required' })
    }
  }

  if (data.role !== undefined) {
    const validRoles = ['admin', 'operator', 'viewer']
    if (!validRoles.includes(data.role)) {
      errors.push({ field: 'role', message: 'Invalid role. Must be admin, operator, or viewer' })
    }
  }

  return errors
}

// GET /api/users - 유저 목록 조회
router.get('/', async (req, res) => {
  try {
    const { role, isActive, search } = req.query

    const filter = {}

    if (role) {
      filter.role = role
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true'
    }

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })

    res.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// GET /api/users/roles - 역할 목록 조회
router.get('/roles', (req, res) => {
  const roles = [
    { id: 'admin', label: 'Administrator', description: 'Full system access' },
    { id: 'operator', label: 'Operator', description: 'Can manage clients and view data' },
    { id: 'viewer', label: 'Viewer', description: 'Read-only access' }
  ]
  res.json(roles)
})

// GET /api/users/:id - 유저 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// POST /api/users - 유저 생성
router.post('/', async (req, res) => {
  try {
    const { username, email, password, name, role, department } = req.body

    // 유효성 검사
    const errors = validateUserData(req.body)
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    // 중복 체크
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    })

    if (existingUser) {
      const field = existingUser.username === username ? 'username' : 'email'
      return res.status(400).json({
        error: 'Duplicate entry',
        details: [{ field, message: `${field} already exists` }]
      })
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    const user = new User({
      username,
      email,
      password: hashedPassword,
      name,
      role: role || 'viewer',
      department: department || ''
    })

    await user.save()

    // 비밀번호 제외하고 반환
    const userResponse = user.toObject()
    delete userResponse.password

    res.status(201).json(userResponse)
  } catch (error) {
    console.error('Error creating user:', error)
    if (error.code === 11000) {
      res.status(400).json({ error: 'Username or email already exists' })
    } else {
      res.status(500).json({ error: 'Failed to create user' })
    }
  }
})

// PUT /api/users/:id - 유저 수정
router.put('/:id', async (req, res) => {
  try {
    const { username, email, password, name, role, department, isActive } = req.body

    // 유효성 검사
    const errors = validateUserData(req.body, true)
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 중복 체크 (다른 유저와)
    if (username || email) {
      const duplicateCheck = await User.findOne({
        _id: { $ne: req.params.id },
        $or: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : [])
        ]
      })

      if (duplicateCheck) {
        const field = duplicateCheck.username === username ? 'username' : 'email'
        return res.status(400).json({
          error: 'Duplicate entry',
          details: [{ field, message: `${field} already exists` }]
        })
      }
    }

    // 업데이트
    if (username) user.username = username
    if (email) user.email = email
    if (password) {
      user.password = await bcrypt.hash(password, SALT_ROUNDS)
    }
    if (name) user.name = name
    if (role) user.role = role
    if (department !== undefined) user.department = department
    if (isActive !== undefined) user.isActive = isActive

    await user.save()

    // 비밀번호 제외하고 반환
    const userResponse = user.toObject()
    delete userResponse.password

    res.json(userResponse)
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// DELETE /api/users/:id - 유저 삭제
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ message: 'User deleted successfully', id: req.params.id })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// DELETE /api/users - 다중 유저 삭제
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No user IDs provided' })
    }

    const result = await User.deleteMany({ _id: { $in: ids } })

    res.json({
      message: `${result.deletedCount} user(s) deleted successfully`,
      deletedCount: result.deletedCount
    })
  } catch (error) {
    console.error('Error deleting users:', error)
    res.status(500).json({ error: 'Failed to delete users' })
  }
})

module.exports = router
