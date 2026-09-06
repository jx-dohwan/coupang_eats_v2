# 1. ---- 빌드 스테이지 (Build Stage) ----
# NestJS 11은 Node.js 18 이상을 권장하며, 최신 환경을 위해 20-alpine을 사용합니다.
FROM node:20-alpine AS builder

# bcrypt, argon2 등 네이티브 모듈 컴파일을 위해 필요한 도구 설치
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 의존성 설치를 위해 파일 복사
COPY package*.json ./

# 모든 의존성 설치 (Nest CLI 등 devDependencies 포함)
RUN npm ci

# 소스 코드 복사
COPY . .

# NestJS 빌드 실행 -> dist 폴더 생성
RUN npm run build


# 2. ---- 실행 스테이지 (Production Stage) ----
FROM node:20-alpine
WORKDIR /app

# 프로덕션 환경임을 명시
ENV NODE_ENV=production

# 실행 환경에서도 네이티브 모듈을 위해 필요한 라이브러리 설치 (컴파일된 결과물 실행용)
RUN apk add --no-cache python3 make g++

COPY package*.json ./

# 프로덕션 의존성만 설치 (용량 최적화)
RUN npm ci --only=production

# 빌드 스테이지에서 생성된 결과물(dist)만 복사
COPY --from=builder /app/dist ./dist

# 애플리케이션 포트 노출 (NestJS 기본값 3000)
EXPOSE 3000

# [권장] 'node dist/main'으로 실행 (가장 빠르고 가벼움)
# package.json의 "start:prod" 스크립트 내용과 동일합니다.
# CMD ["node", "dist/src/main"]
CMD sh -c "npm run migration:run && npm run start:prod" 