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

# ─── 프로젝트 루트 이동 ───
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

log "프로젝트 루트: $PROJECT_ROOT"

# ─── 버전 추출 ───
if command -v node &> /dev/null; then
  VERSION=$(node -p "require('./server/package.json').version" 2>/dev/null || echo "1.0.0")
else
  VERSION=$(grep -o '"version": *"[^"]*"' server/package.json | head -1 | grep -o '[0-9][0-9.]*')
  [ -z "$VERSION" ] && VERSION="1.0.0"
fi

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
