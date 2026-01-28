# WebManager 배포 가이드

## 목차
1. [사전 요구사항](#사전-요구사항)
2. [소스 코드 준비](#소스-코드-준비)
3. [환경 변수 설정](#환경-변수-설정)
4. [의존성 설치](#의존성-설치)
5. [빌드](#빌드)
6. [실행](#실행)
7. [접속 확인](#접속-확인)
8. [문제 해결](#문제-해결)

---

## 사전 요구사항

### 필수 소프트웨어

| 소프트웨어 | 버전 | 용도 |
|-----------|------|------|
| Node.js | v18.x 이상 (v20.x 권장) | 서버 및 빌드 실행 |
| MongoDB | v6.0 이상 | 데이터베이스 |
| Git | 최신 | 소스 코드 관리 |

### Node.js 설치 (Windows)

1. [Node.js 공식 사이트](https://nodejs.org/) 에서 LTS 버전 다운로드
2. 설치 파일 실행 및 기본 옵션으로 설치
3. 설치 확인:
   ```cmd
   node --version
   npm --version
   ```

### MongoDB 설치 (Windows)

1. [MongoDB Community Server](https://www.mongodb.com/try/download/community) 다운로드
2. 설치 시 "Install MongoDB as a Service" 체크
3. MongoDB Compass (GUI 도구) 함께 설치 권장
4. 설치 확인:
   ```cmd
   mongosh --version
   ```

---

## 소스 코드 준비

### Git에서 클론
```cmd
cd C:\Projects
git clone <repository-url> WebManager
cd WebManager
```

### 또는 압축 파일로 전달받은 경우
```cmd
cd C:\Projects
:: 압축 해제 후 해당 폴더로 이동
cd WebManager
```

---

## 환경 변수 설정

### 1. 서버 환경 변수 파일 생성

`server/.env.example` 파일을 복사하여 `.env` 파일 생성:

```cmd
cd server
copy .env.example .env
```

그리고 `.env` 파일을 열어 환경에 맞게 수정:

```env
# 서버 포트
PORT=3000

# 환경 (development / production)
NODE_ENV=production

# MongoDB 연결 정보
# EARS: Akka 서버와 공유하는 데이터베이스
MONGODB_URI=mongodb://localhost:27017/EARS

# WEB_MANAGER: WebManager 전용 데이터베이스
WEBMANAGER_DB_URI=mongodb://localhost:27017/WEB_MANAGER

# CORS 허용 Origin (쉼표로 구분)
# 프론트엔드 접속 주소를 포함해야 함
ALLOWED_ORIGINS=http://localhost:5173,http://192.168.1.100:5173

# 보안 설정
BCRYPT_SALT_ROUNDS=12
JWT_SECRET=your-secure-random-string-change-this-in-production
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d
```

**주의사항:**
- `JWT_SECRET`은 반드시 복잡한 문자열로 변경
- `ALLOWED_ORIGINS`에 실제 접속할 IP/도메인 추가
- MongoDB가 다른 서버에 있다면 해당 주소로 변경

### 2. 클라이언트 API 주소 설정

`client/src/shared/api/index.js` 파일에서 baseURL 확인:

```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  // ...
})
```

다른 서버에서 API 접속 시 `client/.env` 파일 생성:
```env
VITE_API_URL=http://192.168.1.100:3000/api
```

---

## 의존성 설치

### 루트, 클라이언트, 서버 의존성 모두 설치

```cmd
:: 루트 디렉토리에서
npm install

:: 클라이언트 의존성 설치
cd client
npm install
cd ..

:: 서버 의존성 설치
cd server
npm install
cd ..
```

---

## 빌드

### 프론트엔드 빌드

```cmd
npm run build
```

빌드 완료 시 `client/dist/` 폴더에 정적 파일 생성됨.

---

## 실행

### 방법 1: 개발 모드 (개발/테스트용)

프론트엔드와 백엔드를 동시에 실행:
```cmd
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### 방법 2: 프로덕션 모드 (운영용)

#### Step 1: 프론트엔드 빌드
```cmd
npm run build
```

#### Step 2: 서버 실행
```cmd
npm start
```

또는 직접 실행:
```cmd
cd server
node index.js
```

#### Step 3: 정적 파일 서빙

프로덕션 모드(`NODE_ENV=production`)에서는 서버가 자동으로
`client/dist/` 폴더의 정적 파일을 서빙합니다.

별도의 웹 서버(Nginx) 없이 Express에서 직접 프론트엔드를 서빙하므로,
**단일 포트(3000)로 프론트엔드와 API를 모두 제공**합니다.

---

## 초기 데이터 설정

### 역할 권한 시드 데이터

```cmd
cd server
npm run seed:roles
```

### 기본 사용자 생성 (선택)

```cmd
cd server
npm run seed:users
```

---

## 접속 확인

### 1. 서버 상태 확인
브라우저에서 `http://localhost:3000/api/health` 접속 (health 엔드포인트가 있는 경우)

### 2. 웹 애플리케이션 접속
- 개발 모드: http://localhost:5173
- 프로덕션 모드: http://localhost:3000

### 3. 로그인 테스트
기본 관리자 계정으로 로그인 시도

---

## Windows 서비스로 등록 (선택)

### PM2 사용 (권장)

```cmd
:: PM2 전역 설치
npm install -g pm2
npm install -g pm2-windows-startup

:: 서비스 등록
cd C:\Projects\WebManager\server
pm2 start index.js --name webmanager

:: 시작 시 자동 실행 등록
pm2 startup
pm2 save
```

### NSSM 사용 (대안)

1. [NSSM](https://nssm.cc/download) 다운로드
2. 관리자 권한 CMD에서:
   ```cmd
   nssm install WebManager "C:\Program Files\nodejs\node.exe" "C:\Projects\WebManager\server\index.js"
   nssm set WebManager AppDirectory "C:\Projects\WebManager\server"
   nssm start WebManager
   ```

---

## 문제 해결

### MongoDB 연결 실패

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**해결:**
1. MongoDB 서비스 실행 확인
   ```cmd
   :: Windows 서비스 확인
   services.msc
   :: MongoDB Server 서비스 시작
   ```
2. `.env` 파일의 `MONGODB_URI` 확인

### 포트 충돌

```
Error: listen EADDRINUSE: address already in use :::3000
```

**해결:**
1. 해당 포트 사용 프로세스 확인
   ```cmd
   netstat -ano | findstr :3000
   ```
2. 프로세스 종료 또는 `.env`에서 PORT 변경

### CORS 에러

```
Access to XMLHttpRequest has been blocked by CORS policy
```

**해결:**
- `server/.env`의 `ALLOWED_ORIGINS`에 프론트엔드 주소 추가
- 프로토콜(http/https), 호스트, 포트 모두 일치해야 함

### 빌드 실패

```
npm ERR! code ERESOLVE
```

**해결:**
```cmd
:: node_modules 삭제 후 재설치
rd /s /q node_modules
rd /s /q client\node_modules
rd /s /q server\node_modules
npm install
cd client && npm install
cd ..\server && npm install
```

---

## 방화벽 설정 (원격 접속 시)

Windows 방화벽에서 포트 열기:

```cmd
:: 관리자 권한 CMD
netsh advfirewall firewall add rule name="WebManager API" dir=in action=allow protocol=tcp localport=3000
netsh advfirewall firewall add rule name="WebManager Frontend" dir=in action=allow protocol=tcp localport=5173
```

---

## 버전 정보

| 구성 요소 | 버전 |
|----------|------|
| Node.js | v18+ |
| Vue.js | 3.5.x |
| Express | 5.x |
| MongoDB | 6.0+ |
| Mongoose | 9.x |

---

## 참고 문서

- [CLAUDE.md](../CLAUDE.md) - 프로젝트 개요
- [SCHEMA.md](./SCHEMA.md) - MongoDB 스키마
- [CONTRIBUTING.md](./CONTRIBUTING.md) - 개발 가이드
