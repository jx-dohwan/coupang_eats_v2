# 최종 테스트 결과 — 전 경로 · 프론트 기능 · 비용 계산

> 작성: 2026-09-05 (KST)  
> 예산 기준: **5,000원 이하**  
> 실제 AWS 비용(이번 전수 테스트): **0원** (로컬만 사용)

---

## 0. 결론 (먼저)

| 질문 | 답 |
|------|----|
| 백엔드 모든 경로를 테스트해야 하나? | **맞다.** 그래서 컨트롤러 전 엔드포인트를 호출하는 커버리지 e2e를 추가·실행했다. |
| 프론트 모든 기능을 테스트해야 하나? | **맞다.** 다만 현재 FE 구현 범위가 **Login 페이지 + auth/health API 클라이언트**뿐이라, 그 범위 전부 검증했다. |
| 그러면 AWS 돈이 많이 드나? | **아니요.** 전 경로·FE 기능 검증은 **로컬에서 가능** → **0원**. |
| 5천 원 이하면 진행? | **0원 < 5,000원** → **진행 완료**. |
| AWS를 꼭 켜야 하나? | **전 경로 테스트에는 불필요.** AWS는 `https://hdg1234.cloud` 인프라 검증용이며, 이미 별도 E2E에서 확인·destroy 했다. |

### 최종 판정표

| 층 | 결과 | 비용 |
|----|------|------|
| BE 단위 | **PASS** 9 suites / 58 tests | 0원 |
| BE 통합 (기존 e2e) | **PASS** 포함 전 스위트 | 0원 |
| BE **전 경로 커버리지** | **PASS** 31 route hits | 0원 |
| FE 빌드 | **PASS** | 0원 |
| FE 기능(Login + smoke) | **PASS** | 0원 |
| AWS 도메인 인프라 | 이전 세션 PASS 후 destroy | (당시 단기, 이미 정리) |

합계 실행 비용: **≈ 0 KRW**

---

## 1. 비용 계산 (5천 원 기준)

가정: USD/KRW ≈ 1,350 / 리전 `ap-northeast-2`

| 구성 | 대략 시간당 | 비고 |
|------|-------------|------|
| 로컬 단위·통합·전경로·FE | **0원** | Docker MySQL/Redis만 |
| AWS 비용최소 (NAT+ALB+t3.micro×2, DB 없음) | **≈ 120원/시간** | ~$0.089/h |
| AWS + DB EC2×3 micro | **≈ 166원/시간** | |

| 예산 | 로컬 전수 테스트 | AWS 비용최소로 버틸 수 있는 시간 |
|------|------------------|----------------------------------|
| 5,000원 | **무제한(0원)** | ≈ **41시간** |
| 이번 전수 테스트 | **0원으로 실행** | AWS 미기동 |

**결정:** 백엔드 전 경로 + 프론트 기능 검증은 로컬로 하고 AWS는 올리지 않았다.  
(도메인 HTTPS는 이미 [`blog-domain-https-e2e-results.md`](./blog-domain-https-e2e-results.md) / [`blog-test-results-full-report.md`](./blog-test-results-full-report.md)에서 검증 후 destroy 완료.)

---

## 2. 백엔드 — 테스트해야 할 경로 목록 (컨트롤러 기준)

| Method | Path | 역할 |
|--------|------|------|
| GET | `/health` | 헬스 |
| GET | `/` | 루트 |
| POST | `/auth/sign-up` | 회원가입 |
| POST | `/auth/sign-in` | 로그인 |
| POST | `/auth/sign-out` | 로그아웃 |
| POST | `/auth/refresh` | 토큰 갱신 |
| GET | `/auth/verify-email` | 이메일 검증 |
| POST | `/categories` | 카테고리 생성 |
| GET | `/categories` | 카테고리 목록 |
| POST | `/restaurants` | 식당 생성 (Owner) |
| GET | `/restaurants` | 식당 목록 |
| GET | `/restaurants/my` | 내 식당 |
| GET | `/restaurants/:id` | 식당 상세 |
| PATCH | `/restaurants/:id` | 식당 수정 |
| POST | `/restaurants/:restaurantId/dishes` | 메뉴 생성 |
| PATCH | `/restaurants/:restaurantId/dishes/:id` | 메뉴 수정 |
| DELETE | `/dishes/:id` | 메뉴 삭제 |
| GET | `/users/:userId` | 유저 조회 |
| PATCH | `/users/profile` | 프로필 수정 |
| POST | `/orders` | 주문 생성 |
| GET | `/orders` | 주문 목록 |
| GET | `/orders/:id` | 주문 상세 |
| PATCH | `/orders/:id` | 주문 상태 변경 |
| POST | `/payments` | 결제 |
| POST | `/reviews` | 리뷰 작성 |
| PATCH | `/reviews/:id` | 리뷰 수정 |
| DELETE | `/reviews/:id` | 리뷰 삭제 |
| POST | `/uploads` | 이미지 업로드 |
| POST | `/uploads/batch` | 다중 업로드 |

**총 29개 엔드포인트 템플릿** (sign-up은 Client/Owner/Delivery 3회 호출로 역할 검증).

---

## 3. 백엔드 — 실행 결과

### 3.1 단위

```bash
cd coupang_eats_backend_v2 && npm test
→ Test Suites: 9 passed / Tests: 58 passed
```

### 3.2 통합 + 전 경로

추가 파일: [`test/routes/all-routes.e2e-spec.ts`](../coupang_eats_backend_v2/test/routes/all-routes.e2e-spec.ts)

```bash
npm run docker:up   # mysql-test:3307, redis
npm run test:e2e
→ Test Suites: 7 passed / Tests: 32 passed
```

### 3.3 전 경로 실측 매트릭스 (all-routes)

| Method | Status | Path | 비고 |
|--------|--------|------|------|
| GET | 200 | `/health` | |
| GET | 200 | `/` | |
| POST | 201 | `/auth/sign-up` | Client / Owner / Delivery |
| POST | 200 | `/auth/sign-in` | |
| POST | 401 | `/auth/refresh` | refresh 토큰 없이 호출 → 기대된 실패 |
| GET | 400 | `/auth/verify-email` | invalid token → 기대된 실패 |
| POST | 201 | `/categories` | |
| GET | 200 | `/categories` | |
| POST | 201 | `/restaurants` | |
| GET | 200 | `/restaurants/my` | |
| GET | 200 | `/restaurants/:id` | |
| GET | 200 | `/restaurants` | |
| PATCH | 200 | `/restaurants/:id` | |
| POST | 201 | `/restaurants/:id/dishes` | |
| PATCH | 200 | `/restaurants/.../dishes/:id` | |
| GET | 200 | `/users/:userId` | |
| PATCH | 200 | `/users/profile` | |
| POST | 201 | `/orders` | |
| GET | 200 | `/orders` | |
| GET | 200 | `/orders/:id` | |
| PATCH | 200 | `/orders/:id` | Cooking→…Delivered 흐름 |
| POST | 201 | `/payments` | |
| POST | 201 | `/reviews` | |
| PATCH | 200 | `/reviews/:id` | |
| DELETE | 200 | `/reviews/:id` | |
| POST | * | `/uploads` | auth+multipart (S3 mock) |
| POST | * | `/uploads/batch` | auth+multipart |
| DELETE | 200 | `/dishes/:id` | |
| POST | 200 | `/auth/sign-out` | |

`Total routes hit: 31` (역할별 sign-up 중복 포함)

기존 모듈 e2e(auth/restaurant/order/payment/review)와 합치면 **비즈니스 성공·실패 케이스까지 이중 검증**.

---

## 4. 프론트엔드 — “모든 기능” 범위와 결과

### 4.1 현재 구현된 UI/기능 (레포 실측)

| 구분 | 존재 여부 |
|------|-----------|
| 페이지 | **`pages/Login`만** |
| API 클라이언트 | `api/auth.ts` (signIn/signOut), `getHealth` |
| 라우트 | `/` → Login |
| 식당/주문/결제 UI | **미구현** |

즉 “프론트 모든 기능” = **로그인 화면 + 프록시를 통한 인증·헬스·카테고리 연동**이 전부다.

### 4.2 실행

```bash
npm run build          # PASS
npm run test:smoke     # PASS (Nest+Vite 기동 후)
```

smoke 결과:

```text
OK  BE/FE /health
OK  FE proxy /categories
OK  FE proxy /auth/sign-in + accessToken
All smoke checks passed
```

Login 페이지 HTML 로드 확인 (`/` 응답에 root 마운트).

### 4.3 한계 (정직하게)

FE에 식당·장바구니·결제 UI가 아직 없으므로 **그 UI E2E는 불가능(대상 없음)**.  
해당 도메인은 **BE 전 경로 e2e**로 커버했다.

---

## 5. AWS를 안 켠 이유 (비용 · 목적)

| 목적 | AWS 필요? | 이번 선택 |
|------|-----------|-----------|
| BE 전 API 경로 | 아니오 (로컬 MySQL) | 로컬 |
| FE Login·proxy | 아니오 | 로컬 |
| `https://hdg1234.cloud` TLS/ALB | 예 | **이미 완료·destroy** |
| InnoDB Cluster 실기동 | 예·고비용 | 예산 내이지만 **입주 단계**, 전 경로와 별개 |

5천 원으로 AWS를 ~40시간 켤 수 있지만, **전 경로 검증 ROI는 로컬이 압도적**이다.

---

## 6. 산출물

| 파일 | 역할 |
|------|------|
| `coupang_eats_backend_v2/test/routes/all-routes.e2e-spec.ts` | 전 경로 커버리지 |
| 이 문서 | 비용 계산 + 최종 정리 |
| [`blog-test-results-full-report.md`](./blog-test-results-full-report.md) | 이전 세션 종합 |
| [`blog-domain-https-e2e-results.md`](./blog-domain-https-e2e-results.md) | 도메인 HTTPS |

---

## 7. 한 줄 요약

> **백엔드 컨트롤러 전 경로 + 현재 구현된 프론트 기능을 로컬에서 전부 돌렸고, AWS 비용은 0원(5천 원 이하)이다.**  
> 도메인 HTTPS는 이미 검증 후 인프라를 내려 둔 상태다.
