# ─── Stage 1: Client Build ───
FROM node:20-alpine AS client-build

WORKDIR /build/client

# 소스 복사 → 의존성 설치 → 빌드
COPY client/ ./
ENV VITE_API_URL=/api
ARG NPM_REGISTRY=https://scpnexus.itplatform.samsungdisplay.net:8081/nexus/repository/npm-all/
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN rm -f package-lock.json \
    && npm config set registry ${NPM_REGISTRY} \
    && npm config set strict-ssl false \
    && npm install \
    && npm run build

# ─── Stage 2: Production ───
FROM node:20-alpine

WORKDIR /app/server

# 서버 소스 복사 → 의존성 설치
COPY server/ ./
ARG NPM_REGISTRY=https://scpnexus.itplatform.samsungdisplay.net:8081/nexus/repository/npm-all/
RUN rm -f package-lock.json \
    && npm config set registry ${NPM_REGISTRY} \
    && npm config set strict-ssl false \
    && npm install --production

# 클라이언트 빌드 결과물 복사 (app.js의 ../client/dist 경로에 맞춤)
COPY --from=client-build /build/client/dist /app/client/dist

# uploads 디렉토리 생성
RUN mkdir -p /app/server/uploads

EXPOSE 3000

CMD ["node", "index.js"]
