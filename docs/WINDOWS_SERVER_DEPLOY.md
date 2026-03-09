# WebManager Windows Server 배포 가이드

개인 PC에서 빌드하고, Windows Server에서는 실행만 하는 배포 방법입니다.

---

## 개요

| 단계 | 어디서 | 설명 |
|------|--------|------|
| 빌드 | 개인 PC | 프론트엔드 빌드 + 서버 의존성 설치 |
| 실행 | Windows Server | Node.js 설치 + 파일 복사 + 실행 |

---

## Part 1: 개인 PC에서 준비

### 1-1. 클라이언트 환경변수 설정

`client/.env` 파일을 프로덕션용으로 수정합니다.

```env
# 프로덕션에서는 Express가 프론트엔드를 같이 서빙하므로 상대경로 사용
VITE_API_URL=/api
```

> **중요**: 이 값은 빌드 시점에 번들에 포함됩니다. 빌드 전에 반드시 설정하세요.

### 1-2. 프론트엔드 빌드

```bash
cd client
npm install
npm run build
```

`client/dist/` 폴더가 생성되면 성공입니다.

### 1-3. 서버 의존성 설치

```bash
cd server
npm install --production
```

> `--production` 옵션으로 런타임 의존성만 설치합니다 (vitest 등 개발 도구 제외).

### 1-4. 서버 환경변수 설정

`server/.env` 파일을 프로덕션 환경에 맞게 수정합니다.

```env
PORT=3000
NODE_ENV=production

# MongoDB 연결 (실제 주소로 변경)
MONGODB_URI=mongodb://사용자:비밀번호@DB서버:27017/EARS?directConnection=true&authSource=EARS
WEBMANAGER_DB_URI=mongodb://사용자:비밀번호@DB서버:27017/WEB_MANAGER?directConnection=true&authSource=EARS

# CORS (같은 서버에서 서빙하므로 서버 주소만 등록)
ALLOWED_ORIGINS=http://서버IP:3000

# 보안 - 반드시 변경!
JWT_SECRET=실제-복잡한-랜덤-시크릿-문자열
BCRYPT_SALT_ROUNDS=12
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# ManagerAgent RPC / FTP (환경에 맞게 설정)
MANAGER_AGENT_PORT=7180
SOCKS_PROXY_PORT=30000
FTP_PORT=7181
FTP_USER=ARS
FTP_PASS=ars2015!
FTP_TIMEOUT=30000
```

> MongoDB 인증 관련 상세 설정은 [DEPLOYMENT.md](./DEPLOYMENT.md)의 "MongoDB 인증 환경 설정" 섹션을 참고하세요.

### 1-5. 전송 파일 패키징

아래 파일들을 압축하여 Windows Server에 전송합니다.

```
WebManager/
├── client/
│   └── dist/                ← 빌드 결과물 (필수)
├── server/                  ← 전체 포함 (필수)
│   ├── index.js
│   ├── app.js
│   ├── package.json
│   ├── .env                 ← 프로덕션 설정 (필수)
│   ├── node_modules/        ← 의존성 포함 (필수, 서버에서 npm install 불필요)
│   ├── features/
│   ├── shared/
│   └── scripts/
```

**제외 항목** (전송하지 않아도 되는 것):
- `client/node_modules/` - 빌드 완료 후 불필요
- `client/src/` - 빌드 완료 후 불필요
- `.git/` - 버전 관리 불필요

---

## Part 2: Windows Server 설정

### 2-1. Node.js 설치 (최초 1회)

1. 개인 PC에서 [Node.js 공식 사이트](https://nodejs.org/)에서 **LTS 버전** Windows Installer (`.msi`, 64-bit) 다운로드
2. `.msi` 파일을 USB 등으로 Windows Server에 복사
3. 더블클릭하여 설치 (기본 옵션, Next → Next → Finish)
4. PowerShell에서 설치 확인:

```powershell
node -v
npm -v
```

> 인터넷 없이 `.msi` 인스톨러만으로 설치 가능합니다.

### 2-2. 파일 배치

전송받은 파일을 서버에 배치합니다.

```
D:\WebManager\
├── client\dist\
└── server\
    ├── node_modules\
    ├── .env
    └── ...
```

### 2-3. 초기 데이터 설정 (최초 1회)

최초 배포 시에만 실행합니다.

```powershell
cd D:\WebManager\server

# 역할 권한 + 관리자 계정 초기화
node scripts\seedRolePermissions.js
node scripts\setupAdmin.js
```

> 초기 관리자 계정: `admin` / `admin` (첫 로그인 시 비밀번호 변경 필수)
>
> 자세한 관리자 계정 관리는 [DEPLOYMENT.md](./DEPLOYMENT.md)의 "초기 데이터 설정" 섹션을 참고하세요.

### 2-4. 서버 실행

```powershell
cd D:\WebManager\server
node index.js
```

정상 실행 시 아래 로그가 출력됩니다:

```
MongoDB EARS Connected: DB서버
MongoDB WEBMANAGER Connected: DB서버
Syncing permissions...
Permissions synced
Server running on http://localhost:3000
```

### 2-5. 접속 확인

브라우저에서 `http://서버IP:3000` 접속 → 로그인 페이지 확인

---

## Part 3: 방화벽 설정

외부에서 접속하려면 Windows 방화벽에서 포트를 열어야 합니다.

관리자 권한 PowerShell에서:

```powershell
netsh advfirewall firewall add rule name="WebManager" dir=in action=allow protocol=tcp localport=3000
```

---

## Part 4: 백그라운드 실행 (선택)

### 방법 A: PM2 (권장)

> PM2 설치에는 인터넷이 필요합니다. 오프라인 환경이라면 방법 B를 사용하세요.

```powershell
npm install -g pm2

cd D:\WebManager\server
pm2 start index.js --name webmanager

# 상태 확인
pm2 status

# 로그 확인
pm2 logs webmanager

# 중지 / 재시작
pm2 stop webmanager
pm2 restart webmanager
```

### 방법 B: NSSM (오프라인 가능)

[NSSM](https://nssm.cc/download)을 다운로드하여 Windows 서비스로 등록합니다.

1. `nssm.exe`를 서버에 복사 (예: `D:\tools\nssm.exe`)
2. 관리자 권한 PowerShell에서:

```powershell
D:\tools\nssm.exe install WebManager "C:\Program Files\nodejs\node.exe" "D:\WebManager\server\index.js"
D:\tools\nssm.exe set WebManager AppDirectory "D:\WebManager\server"
D:\tools\nssm.exe start WebManager
```

서비스로 등록하면 서버 재부팅 후에도 자동 시작됩니다.

서비스 관리:
```powershell
# 상태 확인
D:\tools\nssm.exe status WebManager

# 중지 / 시작 / 재시작
D:\tools\nssm.exe stop WebManager
D:\tools\nssm.exe start WebManager
D:\tools\nssm.exe restart WebManager

# 서비스 삭제
D:\tools\nssm.exe remove WebManager confirm
```

---

## 업데이트 배포

코드 변경 후 재배포 절차:

1. **개인 PC**: 프론트엔드 수정 시 `npm run build` 재실행
2. **개인 PC**: 서버 의존성 변경 시 `npm install --production` 재실행
3. 변경된 파일을 Windows Server에 덮어쓰기
4. 서버 재시작:

```powershell
# 직접 실행 중이라면: Ctrl+C 후 다시 node index.js
# PM2: pm2 restart webmanager
# NSSM: nssm restart WebManager
```

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `node`를 찾을 수 없음 | Node.js 미설치 또는 PATH 미등록 | Node.js `.msi` 재설치 |
| MongoDB 연결 실패 | DB 주소/인증 오류 | `server/.env`의 `MONGODB_URI` 확인 |
| 3000 포트 접속 불가 | 방화벽 차단 | Part 3 방화벽 설정 참고 |
| CORS 에러 | `ALLOWED_ORIGINS` 미설정 | `.env`에 접속 URL 추가 |
| 빈 화면 (API 실패) | `VITE_API_URL` 미설정 | `client/.env`를 `/api`로 설정 후 재빌드 |
| `MODULE_NOT_FOUND` | node_modules 누락 | 개인 PC에서 `npm install --production` 후 재전송 |

> 기타 문제는 [DEPLOYMENT.md](./DEPLOYMENT.md)의 문제 해결 섹션을 참고하세요.

---

## [해결됨] Windows Server 2012 R2 호환성 이슈

> **상태**: Docker + Kubernetes 배포로 전환하여 해결

### 문제

대상 서버가 **Windows Server 2012 R2**이며 OS 업그레이드 불가.
Node.js 18+는 Windows Server 2012 R2 지원을 공식 종료했으나, Express 5.x / Mongoose 9.x가 Node.js 18+를 요구.

### 해결

Windows Server 직접 배포 대신 **Docker 이미지 → Kubernetes (CentOS 7, K8s 1.17.4)** 배포로 전환.

- `Dockerfile`: 멀티 스테이지 빌드 (Node.js 18-alpine)
- `k8s/`: Deployment + Service (NodePort 30080) + ConfigMap + Secret
- `scripts/build-package.sh`: 소스 zip 패키징 (Windows/Mac)
- `scripts/build-image.sh`: Docker 이미지 빌드 + tar 저장 (Linux)

상세 배포 절차는 아래 Docker/K8s 배포 섹션 참고.

---

## Docker / Kubernetes 배포

### 배포 흐름

```
[ Windows PC ]
  git pull
  → ./scripts/build-package.sh
  → WebManager-YYYY-MM-DD.zip
  → FTP로 Linux PC에 업로드

[ Linux PC (CentOS 7.4) ]
  unzip WebManager-YYYY-MM-DD.zip
  cd WebManager
  → ./scripts/build-image.sh [--proxy http://ip:port]
  → WebManager@1.0.0.tar
  → K8s 클러스터로 전송

[ K8s Cluster ]
  docker load -i WebManager@1.0.0.tar
  kubectl apply -f k8s/
```

### 1. 소스 패키징 (Windows PC)

```bash
cd WebManager
./scripts/build-package.sh
```

### 2. Docker 이미지 빌드 (Linux PC)

```bash
cd WebManager

# 프록시 없이
./scripts/build-image.sh

# 프록시 사용
./scripts/build-image.sh --proxy http://192.168.1.100:3128
```

### 3. K8s 배포

```bash
# 이미지 로드
docker load -i WebManager@1.0.0.tar

# 환경 설정 (최초 1회 — 실제 값으로 수정 후 적용)
# k8s/configmap.yaml: MongoDB/Redis DNS, ALLOWED_ORIGINS 등
# k8s/secret.yaml: JWT_SECRET, FTP 계정
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 배포
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 확인
kubectl get pods -l app=webmanager
kubectl get svc webmanager
```

### 4. 접속 확인

`http://NODE_IP:30080` 접속 → 로그인 페이지 확인

### 5. 업데이트 배포

```bash
# 1. Windows PC: 소스 패키징
./scripts/build-package.sh

# 2. Linux PC: 이미지 빌드 (server/package.json 버전 올린 후)
./scripts/build-image.sh [--proxy ...]

# 3. K8s: 이미지 로드 + 재배포
docker load -i WebManager@새버전.tar
kubectl set image deployment/webmanager webmanager=webmanager:새버전
```
