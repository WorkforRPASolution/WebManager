/**
 * Mock EARS InterfaceServer — UI 테스트용
 *
 * Usage: node server/scripts/mockEarsServer.js
 * Sets up a simple HTTP server that responds to EARS user search requests.
 * Point EARS_INTERFACE_URL=http://localhost:7199 in server/.env
 */

const http = require('http')

const MOCK_USERS = [
  { Cn: '김철수', Employeenumber: 'E001', Department: 'ARS개발팀', Mail: 'cskim@example.com' },
  { Cn: '김영희', Employeenumber: 'E002', Department: 'ARS운영팀', Mail: 'yhkim@example.com' },
  { Cn: '이민수', Employeenumber: 'E003', Department: '설비기술팀', Mail: 'mslee@example.com' },
  { Cn: '박지훈', Employeenumber: 'E004', Department: 'ARS개발팀', Mail: 'jhpark@example.com' },
  { Cn: '정수진', Employeenumber: 'E005', Department: '품질관리팀', Mail: 'sjjung@example.com' },
  { Cn: '최현우', Employeenumber: 'E006', Department: 'IT인프라팀', Mail: 'hwchoi@example.com' },
]

const PORT = 7199

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'POST' && req.url === '/EARS/Interface') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const { Name } = JSON.parse(body)
        const results = MOCK_USERS.filter(u => u.Cn.includes(Name || ''))
        console.log(`[Mock EARS] 검색: "${Name}" → ${results.length}건`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(results))
      } catch {
        res.writeHead(400)
        res.end('Bad Request')
      }
    })
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(PORT, () => {
  console.log(`\n===================================`)
  console.log(`  Mock EARS InterfaceServer`)
  console.log(`  http://localhost:${PORT}`)
  console.log(`===================================`)
  console.log(`\n등록된 Mock 사용자:`)
  MOCK_USERS.forEach(u => console.log(`  ${u.Cn} | ${u.Department} | ${u.Mail}`))
  console.log(`\n서버/.env에 설정: EARS_INTERFACE_URL=http://localhost:${PORT}`)
  console.log(`Ctrl+C로 종료\n`)
})
