# bcrypt → bcryptjs 변경 가이드

> bcrypt는 네이티브 C++ 모듈로 컴파일이 필요하여 설치 시 에러가 발생할 수 있습니다.
> bcryptjs는 순수 JavaScript 구현으로 설치가 간편하며, API가 100% 호환됩니다.

---

## 1단계: 3개 파일에서 require 문 수정

### 파일 1: `server/features/auth/service.js` (5번째 줄)
```javascript
// 변경 전
const bcrypt = require('bcrypt')

// 변경 후
const bcrypt = require('bcryptjs')
```

### 파일 2: `server/features/users/service.js` (5번째 줄)
```javascript
// 변경 전
const bcrypt = require('bcrypt')

// 변경 후
const bcrypt = require('bcryptjs')
```

### 파일 3: `server/scripts/seedUsers.js` (8번째 줄)
```javascript
// 변경 전
const bcrypt = require('bcrypt')

// 변경 후
const bcrypt = require('bcryptjs')
```

---

## 2단계: package.json 수정

### 파일: `server/package.json` (18번째 줄)
```javascript
// 변경 전
"bcrypt": "^5.1.1",

// 변경 후
"bcryptjs": "^2.4.3",
```

---

## 3단계: 패키지 재설치

```bash
cd server
rm -rf node_modules package-lock.json
npm install
```

---

## 4단계: 테스트

```bash
npm run dev
```

서버가 정상 시작되면 완료입니다.
