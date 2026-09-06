# CoupangEats2 테스트 결과 총정리 — 단위 · 통합 · E2E · 도메인 인프라

> 작성일: 2026-09-05 (KST)  
> 환경: 로컬 Mac + AWS `ap-northeast-2` (비용 최소화 스모크 후 destroy)  
> 도메인: `https://hdg1234.cloud`

이 문서는 이날 진행한 **앱 3층 테스트**와 **`hdg1234.cloud` 인프라 E2E**를 한곳에 모은 정본이다.  
짧은 메모는 아래에 링크만 남긴다.

- [로컬 3층 요약](./blog-local-three-layer-test-results.md)
- [도메인 HTTPS 요약](./blog-domain-https-e2e-results.md)

---

## 0. 한 줄 판정

| 영역 | 판정 |
|------|------|
| Backend 단위 테스트 | **PASS** (9 suites / 58 tests) |
| Frontend 빌드 (단위 대체) | **PASS** |
| Backend 통합 (`test:e2e`) | **PASS** (6 suites / 31 tests) |
| 로컬 앱 E2E (`test:smoke`) | **PASS** |
| `https://hdg1234.cloud` 인프라 E2E | **PASS** (ACM · DNS · 301 · `/` · `/health`) |
| 테스트 후 AWS 정리 | **PASS** (destroy 완료, 호스팅존만 유지) |

**앱 품질(단위·통합·로컬 E2E)은 AWS 없이 검증 가능했다.**  
**도메인 HTTPS 경로**는 AWS를 짧게 올린 뒤 검증하고 즉시 내렸다.

---

## 1. 테스트 전략

### 1.1 세 층 + 인프라 층

```text
[단위]     서비스/함수 격리          → Jest (BE) · FE는 build로 대체
[통합]     HTTP + DB                → Nest e2e-spec + MySQL(test)·Redis
[앱 E2E]   브라우저 경로에 가까운 스모크 → Nest + Vite proxy + smoke-api.mjs
[인프라 E2E] 공인 도메인 HTTPS         → Route53 + ACM + ALB + ASG + ECR stub
```

### 1.2 비용 원칙

1. 앱 3층은 **로컬 Docker**만 사용 → AWS 과금 0  
2. 도메인 검증 시에만 AWS 기동  
3. `module.database` **제외** (EC2×3·EBS 비용 차단)  
4. `t3.micro` · ASG `desired=min=max=1`  
5. 검증 끝나면 **같은 날 destroy** · `settings.tf` 원복  
6. 호스팅존 `hdg1234.cloud` (`Z0415918FG5D1E4H0AC7`) **삭제하지 않음**

### 1.3 의도적 미실시

| 항목 | 이유 |
|------|------|
| InnoDB Cluster bootstrap | 입주·시간·비용. 앱 API는 로컬 통합으로 대체 |
| 실제 Nest 풀 이미지 + React SPA 풀 이미지 on AWS | stub으로 HTTPS 경로만 검증 |
| FE Jest 단위 스위트 신규 작성 | 레포에 없음 → `npm run build`로 대체 |
| CloudFront / API Gateway | 프로젝트 범위 밖 |

---

## 2. 단위 테스트

### 2.1 Backend

**위치:** `coupang_eats_backend_v2`  
**명령:**

```bash
cd coupang_eats_backend_v2
npm test
```

**결과:**

```text
Test Suites: 9 passed, 9 total
Tests:       58 passed, 58 total
```

**대상 파일 (service spec):**

| 파일 |
|------|
| `src/modules/auth/auth.service.spec.ts` |
| `src/modules/user/user.service.spec.ts` |
| `src/modules/restaurant/restaurant.service.spec.ts` |
| `src/modules/dish/dish.service.spec.ts` |
| `src/modules/category/category.service.spec.ts` |
| `src/modules/order/order.service.spec.ts` |
| `src/modules/order/order-cron.service.spec.ts` |
| `src/modules/payment/payment.service.spec.ts` |
| `src/modules/review/review.service.spec.ts` |

실행 중 `console.error` 로그(의도된 예외 경로)는 보였으나 **실패 테스트는 없음**.

### 2.2 Frontend

**위치:** `coupang_eats_frontend_v2`  
**레포 상태:** 앱 소스에 Jest/`*.spec.ts` 없음.  
**대체 명령:**

```bash
cd coupang_eats_frontend_v2
npm run build   # tsc -b && vite build
```

**사전 수정 (빌드 통과용):**

| 파일 | 내용 |
|------|------|
| `src/App.tsx` | 미사용 `Link` / `Home` / `Stores` 제거 |
| `src/CustomQueryProvider.tsx` | children 렌더하도록 정리 |
| `src/pages/Login/Login.tsx` | `FormEvent` → `import type` |

**결과:** `✓ built` — `dist/` 생성 성공.

---

## 3. 통합 테스트 (Backend e2e)

### 3.1 전제

`docker-compose.local.yml` 서비스:

| 컨테이너 | 포트 | 용도 |
|----------|------|------|
| `local-mysql-test` | `3307→3306` | e2e DB (`coupang_test`) |
| `local-mysql-dev` | `3306` | 로컬 개발 |
| `local-redis` | `6379` | 캐시 |

`test/jest-setup.ts`가 DB를 `localhost:3307` / `coupang_test`로 강제한다.

### 3.2 명령

```bash
cd coupang_eats_backend_v2
npm run docker:up          # 이미 떠 있으면 유지
npm run test:e2e
```

### 3.3 결과

```text
Test Suites: 6 passed, 6 total
Tests:       31 passed, 31 total
```

**스위트:**

| 파일 | 성격 |
|------|------|
| `test/auth/auth.e2e-spec.ts` | 회원가입·로그인 등 |
| `test/restaurant/restaurant.e2e-spec.ts` | 식당 API |
| `test/order/order.e2e-spec.ts` | 주문 |
| `test/order/order-lifecycle.e2e-spec.ts` | 주문 생명주기 |
| `test/payment/payment.e2e-spec.ts` | 결제 |
| `test/review/review.e2e-spec.ts` | 리뷰 |

**비고:** MySQL/Redis 이미지가 로컬 캐시에 있어 Docker Hub 키체인 pull이 필요 없었다.

---

## 4. 로컬 앱 E2E (smoke)

사람이 브라우저로 두드리는 경로를 스크립트로 대체했다.

### 4.1 기동

```bash
# BE
cd coupang_eats_backend_v2
NODE_ENV=local npm run start:local   # dotenv/.env.local → DB 3306

# FE
cd coupang_eats_frontend_v2
npm run dev -- --host 127.0.0.1 --port 5173
```

Vite proxy (`vite.config`)가 `/health`, `/auth`, `/categories` 등을 Nest `:3000`으로 넘긴다.

### 4.2 명령

```bash
cd coupang_eats_frontend_v2
npm run test:smoke   # scripts/smoke-api.mjs
```

### 4.3 결과

```text
OK    BE GET /health status=200
OK    BE /health envelope
OK    FE proxy GET /health status=200
OK    FE proxy /health envelope
OK    FE proxy GET /categories status=200
OK    FE proxy /categories envelope
OK    FE proxy POST /auth/sign-in status=200
OK    FE proxy /auth/sign-in returns accessToken

All smoke checks passed
```

**판정: PASS**

---

## 5. `https://hdg1234.cloud` 인프라 E2E

### 5.1 Apply 범위 (비용 최소화)

`dev_infra/environments/dev` 에서:

```bash
# settings.tf 임시: t3.micro, ASG 1/1/1
terraform plan \
  -target=module.network \
  -target=module.security \
  -target=module.dns \
  -target=aws_key_pair.main \
  -target=module.compute \
  -out=tfplan-domain

terraform apply tfplan-domain
```

**미적용:** `module.database`

**대략 생성 규모:** 약 99 resources (network · SG · ACM · ALB · ASG · ECR · Bastion · NAT 등)

### 5.2 검증 항목과 결과

| # | 항목 | 기대 | 실측 | 판정 |
|---|------|------|------|------|
| 1 | ACM | Issued | `hdg1234.cloud` **ISSUED** | PASS |
| 2 | DNS | apex → ALB | A 레코드 ALB 공인 IP로 해석 | PASS |
| 3 | HTTP | 301 → HTTPS | `Location: https://hdg1234.cloud:443/` | PASS |
| 4 | HTTPS TLS | 인증서 유효 | ALB에서 ACM 종료, HTTP/2 응답 | PASS |
| 5 | HTTPS `/` | 200 | stub HTML `hdg1234.cloud` | PASS |
| 6 | HTTPS `/health` | 200 JSON | `{"success":true,"data":{"status":"ok"}}` | PASS |

### 5.3 이미지 · User Data

경로 검증용 **stub** 사용 (풀 Nest/React 아님).

| 이미지 | ECR | 역할 |
|--------|-----|------|
| nest stub | `.../coupang-eats-dev/nest:latest` | `/health` JSON만 |
| nginx stub | `.../coupang-eats-dev/nginx:latest` | 정적 `/` + `/health` → nest |

**장애 1 — 아키텍처 mismatch**

```text
no matching manifest for linux/amd64 in the manifest list entries
```

Mac Docker Desktop 기본 빌드가 EC2(amd64)와 안 맞음.

**조치:**

```bash
docker build --platform linux/amd64 ...
docker push ...
# bastion jump 후 앱 인스턴스에서
cd /opt/app && docker compose pull && docker compose up -d
```

이후 인스턴스 로컬 `curl http://127.0.0.1/health` 및 공인 `https://hdg1234.cloud/health` **200**.

**장애 2 — 빈 ECR / 첫 User Data**

이미지 없이 ASG가 뜨면 compose pull 실패 → TG unhealthy → ALB **502**.  
이미지는 apply **이후** push하고, 필요 시 인스턴스에서 compose 재실행 또는 ASG 교체가 필요하다.

### 5.4 User Data 관련 수정 (사전)

Ubuntu 24.04에는 `apt install awscli` 패키지가 **없다**  
([packages.ubuntu.com/noble/awscli](https://packages.ubuntu.com/noble/awscli) → not available).

[`dev_infra/modules/compute/userdata/app.sh`](../dev_infra/modules/compute/userdata/app.sh) 는 **AWS CLI v2 공식 zip 설치**로 바꿔 둔 상태다. 이번 스모크에서도 `/usr/local/bin/aws` 설치·ECR login까지 확인했다.

### 5.5 Destroy

```bash
terraform destroy -auto-approve \
  -target=module.compute \
  -target=module.dns \
  -target=aws_key_pair.main \
  -target=module.security \
  -target=module.network
```

| 항목 | 결과 |
|------|------|
| Destroy | **99 resources destroyed** |
| Terraform state | **empty** |
| VPC / NAT / ALB / ASG / EIP | **없음** |
| Route 53 호스팅존 | **유지** |
| `settings.tf` | `t3.small` / ASG desired=2 등으로 **원복** |

---

## 6. 산출물 · 코드 변경 (테스트 과정에서 생긴 것)

| 경로 | 내용 |
|------|------|
| `coupang_eats_frontend_v2/Dockerfile` | Nginx+SPA 빌드용 (정식 입주용) |
| `coupang_eats_frontend_v2/nginx/default.conf` | `/api`·`/auth`·`/health` 프록시 |
| `dev_infra/modules/compute/userdata/app.sh` | AWS CLI v2 공식 설치 |
| FE TS 정리 (`App.tsx` 등) | build 통과 |

---

## 7. 재실행 체크리스트

### 앱만 (비용 0)

```bash
# 단위
cd coupang_eats_backend_v2 && npm test
cd coupang_eats_frontend_v2 && npm run build

# 통합
cd coupang_eats_backend_v2 && npm run docker:up && npm run test:e2e

# 로컬 E2E
# (터미널1) NODE_ENV=local npm run start:local
# (터미널2) npm run dev -- --host 127.0.0.1 --port 5173
cd coupang_eats_frontend_v2 && npm run test:smoke
```

### 도메인 인프라 (짧게 · 과금 주의)

1. `settings` micro / ASG=1  
2. DB 제외 target apply  
3. ECR에 **`linux/amd64`** 이미지 push  
4. `https://hdg1234.cloud` · `/health` 확인  
5. **즉시 destroy** · settings 원복  

---

## 8. 남은 것 (입주 / 다음 스프린트)

| 항목 | 상태 |
|------|------|
| 실 Nest 이미지 + 실 SPA Nginx 이미지 ECR | stub만 검증함 |
| MySQL InnoDB Cluster on AWS | 미실시 |
| Nest ↔ Router `:6446` on AWS | 미실시 |
| FE 전용 Jest 단위 스위트 | 없음 |
| 장기 운영(destroy 없이 유지) | 비용 승인 후 |

---

## 9. 최종 요약

이날 테스트로 확인한 것:

1. **Backend 비즈니스 로직·API·DB 연동**은 로컬 단위·통합·스모크로 통과했다.  
2. **`hdg1234.cloud` 정문** — Route 53 Alias · ACM Issued · HTTP→HTTPS · ALB TLS · `/` · `/health` — 비용 최소화 스택으로 **실제 공인 HTTPS 200**까지 확인했다.  
3. 장애 포인트(Ubuntu 24.04 awscli apt 부재, Mac→EC2 이미지 아키텍처)를 문서·스크립트에 반영했다.  
4. AWS는 검증 후 **destroy** 했고, 호스팅존만 남겼다.

> **앱 테스트 PASS + 도메인 인프라 E2E PASS + 비용 정리 완료.**
