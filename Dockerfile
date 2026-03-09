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
