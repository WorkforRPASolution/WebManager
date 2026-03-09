# Docker + K8s 배포 구성 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** WebManager를 Docker 이미지로 빌드하고 Kubernetes(1.17.4, CentOS 7)에 배포하기 위한 인프라 파일 생성

**Architecture:** 멀티 스테이지 Dockerfile로 client 빌드 + server 실행 이미지 생성. Windows PC에서 소스 zip → Linux PC에서 docker build → tar 저장 → K8s에 load + apply. 환경변수는 K8s ConfigMap/Secret으로 관리.

**Tech Stack:** Docker (multi-stage, Node.js 18-alpine), Kubernetes 1.17.4 (Deployment, Service NodePort, ConfigMap, Secret)

---

### Task 1: .dockerignore 생성

**Files:**
- Create: `WebManager/.dockerignore`

**Step 1: 파일 생성**

```
node_modules
client/node_modules
client/src
.git
.gitignore
*.md
docs/
UI-refer/
server/.env
server/.env.example
server/uploads/
**/*.zip
**/*.tar
```

**Step 2: 확인**

파일이 존재하고 node_modules, .git 등이 제외 목록에 있는지 확인.

---

### Task 2: Dockerfile 생성

**Files:**
- Create: `WebManager/Dockerfile`

**Step 1: 멀티 스테이지 Dockerfile 작성**

```dockerfile
# ─── Stage 1: Client Build ───
FROM node:18-alpine AS client-build

WORKDIR /build/client

# 의존성 먼저 설치 (캐시 활용)
COPY client/package.json client/package-lock.json* ./
RUN npm ci

# 소스 복사 후 빌드
COPY client/ ./
ENV VITE_API_URL=/api
RUN npm run build

# ─── Stage 2: Production ───
FROM node:18-alpine

WORKDIR /app/server

# 서버 의존성 설치
COPY server/package.json server/package-lock.json* ./
RUN npm ci --production

# 서버 소스 복사
COPY server/ ./

# 클라이언트 빌드 결과물 복사 (app.js의 ../client/dist 경로에 맞춤)
COPY --from=client-build /build/client/dist /app/client/dist

# uploads 디렉토리 생성
RUN mkdir -p /app/server/uploads

EXPOSE 3000

CMD ["node", "index.js"]
```

**핵심 포인트:**
- `VITE_API_URL=/api`는 빌드 시점에 번들에 포함됨
- app.js의 `path.join(__dirname, '../client/dist')` 경로에 맞춰 `/app/client/dist`에 배치
- `npm ci --production`으로 devDependencies 제외
- `server/.env`는 이미지에 포함하지 않음 (K8s 환경변수로 주입)

**Step 2: 확인**

Dockerfile 구문이 올바른지, Stage 이름과 COPY 경로가 일치하는지 확인.

---

### Task 3: build-package.sh 수정 (소스 zip 패키징)

**Files:**
- Modify: `WebManager/scripts/build-package.sh`

**Step 1: Windows(Git Bash)/Mac 겸용 소스 zip 스크립트로 변경**

기존 npm 빌드 로직 제거. Docker가 빌드를 처리하므로 소스 코드만 zip으로 패키징.

```bash
#!/bin/bash
set -e

# 색상
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# 프로젝트 루트 이동
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

log "프로젝트 루트: $PROJECT_ROOT"

# 버전 추출 (server/package.json)
VERSION=$(node -p "require('./server/package.json').version" 2>/dev/null || echo "1.0.0")
DATE=$(date +%Y-%m-%d)
OUTPUT="WebManager-${DATE}.zip"

log "버전: ${VERSION}"
log "패키징 중... → ${OUTPUT}"

rm -f "$OUTPUT"

zip -r "$OUTPUT" \
  client/ \
  server/ \
  Dockerfile \
  .dockerignore \
  -x "client/node_modules/*" \
  -x "server/node_modules/*" \
  -x "server/.env" \
  -x "server/uploads/*" \
  -x ".git/*" \
  -x "*.zip" \
  -x "*.tar"

SIZE=$(du -h "$OUTPUT" | cut -f1)
ok "패키징 완료: ${OUTPUT} (${SIZE})"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} ${OUTPUT} 생성 완료${NC}"
echo -e "${GREEN}${NC}"
echo -e "${GREEN} 다음 단계:${NC}"
echo -e "${GREEN}   1. FTP로 Linux PC에 업로드${NC}"
echo -e "${GREEN}   2. SSH 접속 후 build-image.sh 실행${NC}"
echo -e "${GREEN}========================================${NC}"
```

---

### Task 4: build-image.sh 생성 (Linux Docker 빌드)

**Files:**
- Create: `WebManager/scripts/build-image.sh`

**Step 1: Docker 빌드 + tar 저장 스크립트 작성**

```bash
#!/bin/bash
set -e

# 색상
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ─── 옵션 파싱 ───
PROXY=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --proxy)
      PROXY="$2"
      shift 2
      ;;
    *)
      fail "알 수 없는 옵션: $1\n사용법: $0 [--proxy http://ip:port]"
      ;;
  esac
done

# ─── 프로젝트 디렉토리 확인 ───
if [ ! -f "Dockerfile" ]; then
  fail "Dockerfile이 없습니다. WebManager 디렉토리에서 실행하세요."
fi

# ─── 버전 추출 ───
if command -v node &> /dev/null; then
  VERSION=$(node -p "require('./server/package.json').version" 2>/dev/null || echo "1.0.0")
else
  VERSION=$(grep -o '"version": *"[^"]*"' server/package.json | head -1 | grep -o '[0-9][0-9.]*')
  [ -z "$VERSION" ] && VERSION="1.0.0"
fi

IMAGE_NAME="webmanager"
IMAGE_TAG="${IMAGE_NAME}:${VERSION}"
TAR_NAME="WebManager@${VERSION}.tar"

log "이미지: ${IMAGE_TAG}"
log "출력: ${TAR_NAME}"

# ─── Docker Build ───
BUILD_ARGS=""
if [ -n "$PROXY" ]; then
  log "프록시: ${PROXY}"
  BUILD_ARGS="--build-arg http_proxy=${PROXY} --build-arg https_proxy=${PROXY}"
fi

log "Docker 빌드 시작..."
docker build \
  ${BUILD_ARGS} \
  --no-cache=true \
  --tag "${IMAGE_TAG}" \
  .

ok "Docker 빌드 완료: ${IMAGE_TAG}"

# ─── Docker Save ───
log "이미지 저장 중... → ${TAR_NAME}"
docker save -o "${TAR_NAME}" "${IMAGE_TAG}"

SIZE=$(du -h "${TAR_NAME}" | cut -f1)
ok "저장 완료: ${TAR_NAME} (${SIZE})"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} ${TAR_NAME} 생성 완료${NC}"
echo -e "${GREEN}${NC}"
echo -e "${GREEN} K8s 배포:${NC}"
echo -e "${GREEN}   1. docker load -i ${TAR_NAME}${NC}"
echo -e "${GREEN}   2. kubectl apply -f k8s/${NC}"
echo -e "${GREEN}========================================${NC}"
```

**사용법:**
```bash
# 프록시 없이
./scripts/build-image.sh

# 프록시 사용
./scripts/build-image.sh --proxy http://192.168.1.100:3128
```

---

### Task 5: K8s ConfigMap + Secret 생성

**Files:**
- Create: `WebManager/k8s/configmap.yaml`
- Create: `WebManager/k8s/secret.yaml`

**Step 1: ConfigMap (비민감 설정)**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: webmanager-config
data:
  PORT: "3000"
  NODE_ENV: "production"
  MONGODB_URI: "mongodb://mongodb-headless.default.svc.cluster.local:27017/EARS?directConnection=true&authSource=EARS"
  WEBMANAGER_DB_URI: "mongodb://mongodb-headless.default.svc.cluster.local:27017/WEB_MANAGER?directConnection=true&authSource=EARS"
  ALLOWED_ORIGINS: "http://NODEPORT_IP:NODEPORT_PORT"
  BCRYPT_SALT_ROUNDS: "12"
  JWT_EXPIRES_IN: "24h"
  REFRESH_TOKEN_EXPIRES_IN: "7d"
  MANAGER_AGENT_PORT: "7180"
  SOCKS_PROXY_PORT: "30000"
  FTP_PORT: "7181"
  FTP_TIMEOUT: "30000"
  IMAGE_STORAGE: "httpwebserver"
  REDIS_URL: "redis://redis-headless.default.svc.cluster.local:6379/10"
```

> MongoDB/Redis DNS는 실제 K8s headless 서비스 이름으로 변경 필요.

**Step 2: Secret (민감 정보)**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: webmanager-secret
type: Opaque
stringData:
  JWT_SECRET: "change-this-to-a-secure-random-string"
  FTP_USER: "ARS"
  FTP_PASS: "ars2015!"
```

---

### Task 6: K8s Deployment 생성

**Files:**
- Create: `WebManager/k8s/deployment.yaml`

**Step 1: Deployment 작성**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webmanager
  labels:
    app: webmanager
spec:
  replicas: 1
  selector:
    matchLabels:
      app: webmanager
  template:
    metadata:
      labels:
        app: webmanager
    spec:
      containers:
        - name: webmanager
          image: webmanager:1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: webmanager-config
            - secretRef:
                name: webmanager-secret
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
```

**핵심:**
- `imagePullPolicy: IfNotPresent` — 로컬 load된 이미지 사용
- `/api/health` 엔드포인트로 헬스체크 (app.js:34에 이미 존재)
- envFrom으로 ConfigMap + Secret 환경변수 일괄 주입

---

### Task 7: K8s Service (NodePort) 생성

**Files:**
- Create: `WebManager/k8s/service.yaml`

**Step 1: NodePort Service 작성**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: webmanager
  labels:
    app: webmanager
spec:
  type: NodePort
  selector:
    app: webmanager
  ports:
    - port: 3000
      targetPort: 3000
      nodePort: 30080
      protocol: TCP
```

---

### Task 8: 배포 문서 업데이트

**Files:**
- Modify: `WebManager/docs/WINDOWS_SERVER_DEPLOY.md` — [미해결] 섹션에 Docker 해결 방안 추가

**Step 1: 호환성 이슈 해결 상태 업데이트**

[미해결] 섹션을 [해결됨]으로 변경하고 Docker/K8s 배포 방식으로 전환했음을 기록.

---

## 배포 절차 요약

```
[ Windows PC ]
  git pull → ./scripts/build-package.sh → WebManager-2026-03-09.zip
                                              │
                                         FTP upload
                                              │
                                              ▼
[ Linux PC (CentOS 7.4) ]
  unzip → cd WebManager → ./scripts/build-image.sh [--proxy http://ip:port]
                              │
                              ▼
                       WebManager@1.0.0.tar
                              │
                         전송 (scp 등)
                              │
                              ▼
[ K8s Cluster (CentOS 7, K8s 1.17.4) ]
  docker load -i WebManager@1.0.0.tar
  kubectl apply -f k8s/
```
