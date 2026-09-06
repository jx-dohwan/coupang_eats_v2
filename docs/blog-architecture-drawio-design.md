# 전체 인프라 설계도 — Draw.io

페이지 **1장만** 있다. (VPC · 9 Subnet · Route Table · NAT)

| | |
|--|--|
| 파일 | `docs/architecture/coupang-eats-ecs-less-3tier.drawio` |
| 열기 | [app.diagrams.net](https://app.diagrams.net) → **Open Existing** |
| PDF | File → Export as → PDF |

---

## 격자

| | AZ-a | AZ-b | AZ-c |
|--|------|------|------|
| Public | `10.0.0.0/24` ALB+NAT+Bastion | `10.0.1.0/24` ALB | `10.0.2.0/24` ALB |
| **RT lane** | `rt-private-app-a` → NAT | `rt-private-app-b` → NAT | `rt-private-app-c` → NAT |
| Private App | `10.0.10.0/24` | `10.0.11.0/24` | `10.0.12.0/24` |
| Private DB | `10.0.20.0/24` Primary | `10.0.21.0/24` Secondary | `10.0.22.0/24` Secondary |

- **IGW** = VPC attach (서브넷 안 아님)
- **NAT** = public-a 1개 ← app RT 세 개의 `0.0.0.0/0` (보라 화살표)
- **rt-private-db** = NAT 없음 + S3 Gateway EP

화살표가 겹치지 않도록 Public / RT lane / App / DB 행을 분리해 두었다.
