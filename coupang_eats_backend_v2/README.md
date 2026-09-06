# Coupang Eats Backend v2

쿠팡이츠 클론 **NestJS** 백엔드.  
AWS 인프라는 별도 저장소 [coupang-eats-infra](https://github.com/jx-dohwan/coupang-eats-infra) (ECS Fargate · Aurora · Redis · CloudFront)에서 관리합니다.

## 문서

| 문서 | 설명 |
|------|------|
| **[doc/README.md](./doc/README.md)** | 문서 인덱스 (전체 목차) |
| **[doc/14. Infra Sync.md](./doc/14.%20Infra%20Sync.md)** | 인프라 v2 맞춤 백엔드 변경 내역 |
| [doc/1.프로젝트 셋팅.md](./doc/1.프로젝트%20셋팅.md) ~ [13](./doc/13.E2E%20Test2.md) | 기능별 구현 기록 |

## Quick Start (로컬)

```bash
npm install
npm run docker:up          # MySQL + Redis
cp dotenv/.env.example dotenv/.env.local   # 없으면 예제 참고해 작성
npm run start:dev
```

- Swagger: `http://localhost:3000/api`
- Health: `GET http://localhost:3000/health` → `{ "status": "ok" }`

## ECS와의 핵심 계약

| 항목 | 값 |
|------|-----|
| Health | `GET /health` (ALB Target Group) |
| 이미지 URL | `AWS_CDN_URL` + object key (CloudFront OAC) |
| DB | MySQL 호환 (Aurora Writer), `DB_*` |
| Redis | `REDIS_HOST` + TLS (비-localhost) |
| Port | `3000` |

자세한 env·변경 이유 → [doc/14. Infra Sync.md](./doc/14.%20Infra%20Sync.md)
