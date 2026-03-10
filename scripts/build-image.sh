#!/bin/bash
set -e

# ─── 색상 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ─── 옵션 파싱 ───
PROXY=""
NPM_REGISTRY=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --proxy)
      PROXY="$2"
      shift 2
      ;;
    --registry)
      NPM_REGISTRY="$2"
      shift 2
      ;;
    -h|--help)
      echo "사용법: $0 [--proxy http://ip:port] [--registry https://nexus-url/npm-all/]"
      echo ""
      echo "옵션:"
      echo "  --proxy URL       Docker 빌드 시 HTTP/HTTPS 프록시 설정"
      echo "  --registry URL    npm 레지스트리 URL (사내 Nexus 등)"
      echo "  -h, --help        도움말 표시"
      exit 0
      ;;
    *)
      fail "알 수 없는 옵션: $1\n사용법: $0 [--proxy http://ip:port] [--registry URL]"
      ;;
  esac
done

# ─── 기본 npm 레지스트리 (Dockerfile ARG 기본값과 동일) ───
DEFAULT_NPM_REGISTRY="https://scpnexus.itplatform.samsungdisplay.net:8081/nexus/repository/npm-all/"
if [ -z "$NPM_REGISTRY" ]; then
  NPM_REGISTRY="$DEFAULT_NPM_REGISTRY"
fi

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
  # 사내 레지스트리 호스트는 프록시를 거치지 않도록 no_proxy 설정
  NO_PROXY_HOSTS=""
  if [ -n "$NPM_REGISTRY" ]; then
    NO_PROXY_HOSTS=$(echo "$NPM_REGISTRY" | sed -E 's|https?://([^:/]+).*|\1|')
  fi
  BUILD_ARGS="--build-arg http_proxy=${PROXY} --build-arg https_proxy=${PROXY}"
  if [ -n "$NO_PROXY_HOSTS" ]; then
    log "no_proxy: ${NO_PROXY_HOSTS}"
    BUILD_ARGS="${BUILD_ARGS} --build-arg no_proxy=${NO_PROXY_HOSTS}"
  fi
fi
if [ -n "$NPM_REGISTRY" ]; then
  log "npm 레지스트리: ${NPM_REGISTRY}"
  BUILD_ARGS="${BUILD_ARGS} --build-arg NPM_REGISTRY=${NPM_REGISTRY}"
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
