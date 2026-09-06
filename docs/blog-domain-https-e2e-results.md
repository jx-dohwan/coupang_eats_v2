# https://hdg1234.cloud 인프라 E2E 결과 (비용 최소화)

일시: 2026-09-05 KST

## 범위

- DB 모듈 **미적용**
- `t3.micro` · ASG=1
- stub 이미지(헬스/정적 HTML)로 경로 검증
- 검증 후 **즉시 destroy (99 resources)**

## 결과

| 체크 | 결과 |
|------|------|
| ACM `hdg1234.cloud` | **ISSUED** |
| DNS apex → ALB | **PASS** |
| HTTP → HTTPS 301 | **PASS** |
| HTTPS `/` 200 | **PASS** (`hdg1234.cloud` HTML) |
| HTTPS `/health` 200 | **PASS** (`{"success":true,"data":{"status":"ok"}}`) |
| Destroy | **PASS** — 99 destroyed, state empty |
| Hosted zone 유지 | **PASS** |

## 이슈 · 조치

1. 첫 ECR 이미지가 Mac 기본 플랫폼이라 EC2 amd64 pull 실패  
   → `--platform linux/amd64` 재빌드·푸시 후 인스턴스에서 `docker compose up`으로 복구
2. User Data 단독으로는 빈 ECR / 잘못된 아키텍처 시 TG unhealthy → 이미지 준비 후 재기동 필요

## 비용

장시간 방치하지 않고 destroy 완료. `settings.tf`는 원래 값(`t3.small`, ASG desired=2)으로 복구됨.
