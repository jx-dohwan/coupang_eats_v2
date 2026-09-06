# 비용 최소화 테스트 결과 (단위 / 통합 / E2E)

일시: 2026-09-05 (KST)

## 원칙

- 앱 품질 테스트는 로컬 (AWS 과금 0)
- AWS는 DB 모듈 제외 · `t3.micro` · ASG=1 만 짧게 기동
- database / InnoDB bootstrap 제외

## 1. 단위 테스트

| 대상 | 명령 | 결과 |
|------|------|------|
| Backend | `coupang_eats_backend_v2` → `npm test` | **PASS** — 9 suites / 58 tests |
| Frontend | `coupang_eats_frontend_v2` → `npm run build` | **PASS** (TS unused import 등 소수정정 후) |

FE에는 Jest 단위 스위트가 없어 **production build**로 대체.

## 2. 통합 테스트

| 대상 | 명령 | 결과 |
|------|------|------|
| Backend e2e | `docker compose` (mysql-test:3307) + `npm run test:e2e` | **PASS** — 6 suites / 31 tests |

## 3. AWS 인프라 기동 (비용 최소화)

적용:

- `settings.tf`: `t3.micro`, ASG min=max=desired=1
- `terraform apply` target: `network` · `security` · `dns` · `key_pair` · `compute`
- **`module.database` 미적용**

확인된 산출물:

| 항목 | 값 |
|------|-----|
| ALB DNS | `coupang-eats-dev-alb-1724943776.ap-northeast-2.elb.amazonaws.com` |
| ACM | `hdg1234.cloud` **ISSUED** |
| Route53 apex | Alias → ALB (A → `13.125.66.51`) |
| ECR | `.../coupang-eats-dev/nginx`, `.../coupang-eats-dev/nest` |
| Bastion | `3.36.91.96` |

## 4. E2E (도메인)

| 체크 | 결과 | 비고 |
|------|------|------|
| DNS `hdg1234.cloud` | PASS | ALB로 해석 |
| ACM Issued | PASS | |
| HTTP → HTTPS 301 | PASS | `Location: https://hdg1234.cloud:443/` |
| HTTPS 응답 | PARTIAL | TLS 종료 OK, 본문 **502** (TG unhealthy) |
| `/health` 200 | FAIL / SKIP | ECR 이미지 미배포 — ASG User Data pull 실패 |

원인: User Data가 ECR `:latest` pull 하는데 레지스트리가 비어 있음.  
Nginx Dockerfile은 추가함 (`coupang_eats_frontend_v2/Dockerfile`).  
ECR push·인스턴스 교체는 실행 중 승인 UI 오류로 **미완료**.

## 5. 이미지

| 항목 | 상태 |
|------|------|
| FE `Dockerfile` + `nginx/default.conf` | 추가됨 |
| Nest stub / Nginx stub ECR push | **미완료** (승인 카드 실패) |
| 실 Nest 풀 이미지 push | 비용·시간상 스킵 (의도) |

## 6. Destroy

**완료.** [`Destroy`](1fbf5620-eaa3-459a-97c1-82712264800e) 결과: **95 resources destroyed**, state empty.  
VPC/NAT/ALB/EC2/ASG/EIP 없음. 호스팅존 `hdg1234.cloud` 유지.  
`settings.tf` 는 테스트 후 원래 값(`t3.small`, ASG desired=2)으로 복구.

## 요약

| 층 | 결과 |
|----|------|
| 단위 | PASS |
| 통합 | PASS |
| 인프라 E2E (DNS/ACM/301/TLS) | PASS |
| 앱 E2E on AWS (`/health` 200) | 미완 (ECR push 승인 실패로 스킵) |
| Destroy | **PASS** (95 destroyed) |
