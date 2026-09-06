# 로컬 3층 테스트 결과 (단위 / 통합 / E2E) — AWS 미기동

일시: 2026-09-05 18:22 KST  
원칙: **AWS 비용 0**. 단위·통합·앱 E2E는 로컬만으로 충분.

## 결론

| 층 | 결과 | 비고 |
|----|------|------|
| 단위 | **PASS** | BE 9 suites / 58 tests · FE `npm run build` |
| 통합 | **PASS** | BE `test:e2e` 6 suites / 31 tests (MySQL 3307) |
| E2E (앱) | **PASS** | Nest `:3000` + Vite `:5173` + `test:smoke` 전부 OK |

**AWS를 안 띄워도** 이 세 가지는 완료 가능.  
AWS는 `https://hdg1234.cloud` 인프라(ACM/ALB) 검증이 목표일 때만 최소 비용으로 올리면 된다.

## 상세

### 단위
- `coupang_eats_backend_v2`: `npm test` → 58 passed
- `coupang_eats_frontend_v2`: `npm run build` → success

### 통합
- 기존 Docker `local-mysql-test` / `local-redis` 사용 (이미지 캐시 → 키체인 pull 불필요)
- `npm run test:e2e` → 31 passed

### E2E (로컬 하드닝 대체)
- Nest `NODE_ENV=local` 기동 → `GET /health` 200
- Vite proxy → `/health`, `/categories`, `/auth/sign-in` 전부 OK
- `All smoke checks passed`

## AWS

이번 실행: **미기동** (비용 0).  
도메인 HTTPS E2E가 필요할 때만 micro/ASG=1 · DB 제외 · 즉시 destroy 권장.
