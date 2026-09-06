# Coupang Eats Backend — 문서 인덱스

NestJS 기반 쿠팡이츠 클론 백엔드의 학습·구현 기록과, AWS 인프라 연동 가이드입니다.

**관련 인프라:** [coupang-eats-infra](https://github.com/jx-dohwan/coupang-eats-infra)  
**인프라 설계도:** `coupang-eats-infra/doc/architecture.drawio`

---

## 빠른 링크

| 목적 | 문서 |
|------|------|
| 인프라 맞춤 변경 (최신) | [14. Infra Sync](./14.%20Infra%20Sync.md) |
| 로컬 셋업 · Config | [1. 프로젝트 셋팅](./1.프로젝트%20셋팅.md) |
| S3 · SES · CDN | [10. S3 & SES](./10.%20S3%20%26%20SES.md) |
| 인증 · JWT · 로깅 | [2. 인증 및 로깅](./2.%20인증%20및%20로깅%20아키텍처%20구현.md) |

---

## 목차 (구현 순서)

| # | 문서 | 요약 |
|---|------|------|
| 1 | [프로젝트 셋팅](./1.프로젝트%20셋팅.md) | Docker MySQL/Redis, Type-Safe Config, TypeORM |
| 2 | [인증 및 로깅](./2.%20인증%20및%20로깅%20아키텍처%20구현.md) | JWT, Guard, 로깅 |
| 3 | [공급자 · 비즈니스](./3.%20공급자%20전용,%20비즈니스%20로직.md) | 사장님/가게 도메인 |
| 4 | [주문 시스템](./4.%20주문%20시스템.md) | 주문 플로우 |
| 5 | [결제 & 리뷰](./5.%20결제%20%26%20리뷰.md) | 결제·리뷰 |
| 6 | [Socket & Gateway](./6.%20Socket%20%26%20Gateway.md) | 실시간 |
| 7 | [Swagger](./7.Swagger.md) | API 문서화 |
| 8 | [Unit Test](./8.%20Unit%20Test.md) | 단위 테스트 |
| 9 | [E2E Test](./9.%20E2E%20Test.md) | E2E |
| 10 | [S3 & SES](./10.%20S3%20%26%20SES.md) | 이미지·메일 (**CDN 반영**) |
| 11 | [리팩토링](./11.%20리팩토링,%20수정%20기능%20추가.md) | 보완 |
| 12 | [Unit Test 수정](./12.%20Unit%20Test%5B수정%5D.md) | 테스트 보강 |
| 13 | [E2E Test2](./13.E2E%20Test2.md) | E2E 보강 |
| **14** | **[Infra Sync](./14.%20Infra%20Sync.md)** | **ECS/Aurora/CloudFront 맞춤 백엔드 변경** |
| — | [기타](./기타.md) | 메모 |

---

## 런타임 아키텍처 (요약)

```
Client / ALB
    │  GET /health
    ▼
NestJS (:3000)  ← ECS Fargate
    ├── Aurora MySQL (Writer)     DB_*
    ├── ElastiCache Redis (TLS)   REDIS_HOST
    ├── S3 upload + CloudFront    AWS_S3_BUCKET_NAME, AWS_CDN_URL
    └── SES                       AWS_SES_SENDER_EMAIL
```

로컬은 `docker-compose`의 MySQL/Redis를 쓰고, 배포 환경은 Terraform이 env를 주입합니다.
