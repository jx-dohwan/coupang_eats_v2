# 밑바닥부터 다시 쌓는 3-Tier 인프라 — 최종 총정리 (기획 대비 · 데이터 영속 · 완성 판정)

이 글은 시리즈의 **마지막 총정리**다.

- 초기 기획이 무엇을 약속했는지  
- 무엇을 고쳤는지 (Docker·ECR)  
- 무엇을 코드·문서로 채웠는지  
- **DB 데이터는 어디에 사는지 (EBS / S3 / EFS가 아닌 이유)**  
- **EC2가 종료되면 어떻게 살아남는지, 왜 백업본이 필수인지**  
- 스모크 테스트와 destroy  
- “완성”의 정확한 의미  

한 줄 판정:

> **인프라 설계 · Terraform 5모듈 · 문서 SSOT · 짧은 apply 스모크까지는 완성이다.**  
> **이미지 push · Cluster bootstrap · Nest E2E는 “입주” 단계로 남긴다.**  
> **고객 데이터(자산)는 EBS에 살고, S3에 복사본을 남기며, EFS는 쓰지 않는다.**

---

## 0. 이 프로젝트가 처음부터 말했던 것

출처: [서문](./blog-ecs-less-3tier-intro.md), [기획 수정](./blog-planning-revision-docker-ecr.md)

### 0.1 왜 만들었는가

내일부터 교육은 **ECS / Kubernetes**다.  
그 수업은 오케스트레이터다. “컨테이너를 어디에 몇 개, 죽으면 누가 다시.”

오늘까지 배운 것은 그 오케스트레이터가 **전제하는 바닥**이다.

```text
VPC · SG · EC2 · ALB · ASG · Nginx · Docker · ECR
Compose/Swarm 감각 · MySQL 클러스터 · Route 53 · ACM
```

Fargate + RDS만 쓰면 이 층이 한 번에 가려진다.  
그래서 **Fargate를 쓰지 않고**, 위 목록을 **직접 이어** 3-Tier를 만들었다.

온프레미스 DIY가 아니다. 실습은 모두 **AWS**다.

### 0.2 넣을 것 / 빼는 것 (수정 후 정본)

| 넣는다 | 뺀다 |
|--------|------|
| VPC · SG · EC2 · ALB · ASG | ECS Fargate / Cluster·Task·Service |
| **Docker · ECR · Compose** | Swarm **제품** 클러스터 |
| Nginx WEB · Nest WAS | RDS / Aurora |
| Route 53 · ACM HTTPS | CloudFront · API Gateway |
| EC2 MySQL InnoDB Cluster | Compose 안 `my-db` |

### 0.3 티어 한 장

```text
WEB  → Nginx 컨테이너 (SPA + /api 리버스 프록시)
WAS  → Nest 컨테이너 + ALB + ASG   ← ECS 스케줄러 대체
DB   → EC2 × 3 InnoDB Cluster      ← RDS 바닥
정문 → https://hdg1234.cloud (ACM, ALB에서 TLS 종료)
```

### 0.4 중간에 고친 기획 — 왜 중요한가

처음 발행분은 Docker·ECR을 **2차**로 미뤘다.  
“실패 지점을 나누자”는 논리는 맞았지만, 커리큘럼 질문과 충돌했다.

> 오늘까지가 ECS 대체 밑바닥 **전체**인데, Docker를 빼면  
> 내일 대조할 바닥이 “컨테이너 런타임”이 아니라 **패키지 서버**가 된다.

[기획 수정편](./blog-planning-revision-docker-ecr.md)에서 **1차에 Docker·ECR**을 넣도록 고쳤다.  
VPC·SG·ACM·DB·ALB `instance:80` 축은 그대로였다.  
설계가 한 번에 맞는 경우는 드물다. **변경 이력을 남기는 것**이 실무다.

---

## 1. 최종 산출물 — 어디에 무엇이 있는가

### 1.1 Terraform 모듈 다섯

| 모듈 | 역할 | 비유 |
|------|------|------|
| `network` | VPC, 서브넷 9, NAT, S3 Endpoint | 도로·담장·배기구 |
| `security` | sg-alb/app/db/bastion/router… | 출입증·도어락 |
| `dns` | ACM + DNS 검증 CNAME | 정문 명패 |
| `compute` | ALB·ASG·ECR·Bastion·Alias·Compose User Data | 로비·주방·경비실 |
| `database` | EC2×3·EBS·S3 백업·IAM·cron 골격 | 지하 금고 3칸 |

조립 위치: `dev_infra/environments/dev/main.tf`

```text
network ──▶ security ──▶ compute
                │
dns ────────────┴──▶ compute (ACM ARN, zone)
network + security ──▶ database
```

### 1.2 문서 시리즈 (읽는 순서)

| 순서 | 글 |
|------|-----|
| 1 | [서문](./blog-ecs-less-3tier-intro.md) |
| 2 | [기획 수정 — Docker·ECR](./blog-planning-revision-docker-ecr.md) |
| 3 | [네트워크 설계](./blog-vpc-network-design.md) · [네트워크 Terraform](./blog-terraform-network-code.md) |
| 4 | [보안 그룹](./blog-security-groups.md) · [SG Terraform](./blog-terraform-security-groups.md) |
| 5 | [ACM·Route 53 설계](./blog-acm-route53-https-design.md) · [DNS Terraform](./blog-dns-terraform-implementation.md) |
| 6 | [컴퓨트 설계](./blog-compute-web-was-design.md) · [컴퓨트 Terraform](./blog-compute-terraform-implementation.md) |
| 7 | [DB 설계](./blog-database-innodb-cluster-design.md) · [DB Terraform](./blog-database-terraform-implementation.md) |
| 8 | **이 글 — 최종 총정리** |
| 9 | [전체 아키텍처 Draw.io](./blog-architecture-drawio-design.md) · [`coupang-eats-ecs-less-3tier.drawio`](./architecture/coupang-eats-ecs-less-3tier.drawio) |
| 10 | [테스트 결과 총정리](./blog-test-results-full-report.md) (단위·통합·E2E·도메인) |
| 11 | [전 경로·FE·비용 최종](./blog-test-final-full-coverage.md) (5천원 기준) |
| 12 | [CloudWatch 기본 모니터링](./blog-cloudwatch-monitoring.md) (로그·알람·대시보드·확인법) |

### 1.3 실제 시공 순서

```text
[수동 1회] 호스팅케이알 NS ↔ Route 53 NS 위임
     ↓
terraform: network → security → dns → compute → database
     ↓
[입주] ECR push · MySQL 설치 · Cluster bootstrap · Router · Nest
     ↓
검증 후 destroy (또는 승인된 장기 운영)
```

NS 위임만 Terraform 밖이다. destroy/apply로 호스팅 영역을 새로 만들면 NS가 바뀌어 ACM이 영원히 Pending이 된다.

---

## 2. 기획 대비 대조 — 지켰는가

### 2.1 “넣는다” 체크리스트

| 기획 | 최종 구현 | 판정 |
|------|-----------|------|
| VPC `/16` + 서브넷 9 (0/1/2 · 10/11/12 · 20/21/22) | `cidrs.tf` + network | ✅ |
| 앱은 NAT, DB는 local-only + S3 EP | network RT | ✅ |
| SG 분리 · mysql 13306 · GR 13361 | `ports.tf` + rules | ✅ |
| Bastion + 본인 IP `/32` | compute + ports | ✅ |
| ACM 루트+`*` · HTTPS · 80→301 | dns + ALB | ✅ |
| ALB → TG **`instance` :80** (Fargate `ip:3000` 아님) | compute alb | ✅ |
| ASG + LT + User Data | compute asg | ✅ |
| Docker Compose Nginx+Nest · ECR | ecr + app.sh | ✅ |
| Apex Alias → ALB | route53 | ✅ |
| DB EC2×3 · 3AZ · EBS | database | ✅ |
| 백업 S3 + 보존 N일 | s3 Lifecycle + cron 골격 | ✅ |
| Fargate·RDS·Swarm·CF·APIGW 없음 | 코드에 없음 | ✅ |

### 2.2 의도적 미실시 (기획과 동일)

| 항목 | 이유 |
|------|------|
| WEB ASG / WAS ASG 분리 | 2차 확장 |
| Router 전용 EC2 | 1차는 앱 로컬 `127.0.0.1:6446` |
| Redis | DB 다음 스프린트 |
| GitHub Actions 풀 자동화 | compose·클러스터 안정 후 |
| `api.hdg1234.cloud` | 경로 기반 단일 도메인 |

### 2.3 골격 완성 vs 입주 (정직한 경계)

| 완료 (1차 목표) | 미완료 (입주) |
|-----------------|---------------|
| 5모듈 Terraform | ECR에 실제 이미지 push |
| 설계·구현 블로그 | `https://` SPA·`/health` 실기동 |
| apply 스모크 후 destroy | DB에 MySQL 패키지 설치 |
| EBS·S3 경로 코드화 | `mysqlsh` Cluster bootstrap |
| | Router + Nest `6446` |
| | 실덤프 1회 + restore 리허설 |

서문의 질문:

> 오늘까지 배운 바닥을 **빼지 않고** 단지에 다 쓰는가?

**도면·코드: 예.**  
**주문이 24시간 사는지: 아직 아니오 (AWS는 destroy 상태).**  
둘을 한 문장으로 뭉개지 않는 것이 이 총정리의 역할이다.

---

## 3. 최종 아키텍처 — 손님이 장부까지

```text
[사용자 브라우저]
        │  https://hdg1234.cloud
        ▼
[Route 53 A Alias] ──▶ [ALB]
                         │ :443 ACM TLS 종료
                         │ :80 → 301 HTTPS
                         │ HTTP :80
                         ▼
              [ASG · 앱 private EC2]
              ┌─────────────────────────┐
              │ Docker Compose          │
              │  Nginx :80              │
              │    ├ / → SPA dist       │
              │    └ /api → Nest :3000  │
              │         │               │
              │         │ 127.0.0.1:6446│
              │         ▼               │
              │  MySQL Router (로컬)    │
              └──────────┼──────────────┘
                         │ sg-app → sg-db :13306
                         ▼
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
      [DB-a]          [DB-b]          [DB-c]
      Primary         Secondary       Secondary
      EBS-a           EBS-b           EBS-c
         └──── Group Replication :13361 ────┘
                         │
                         │ cron mysqldump
                         ▼
                      [S3 백업]
                   Lifecycle N일 만료

[관리자] → Bastion(SSH) → 앱/DB (공인 IP로 DB 직행 금지)
```

핵심 문장:

- 브라우저는 DB를 모른다.  
- Nest는 Primary IP를 외우지 않는다 → **Router `6446`**.  
- ALB는 Nest:3000이 아니라 **Nginx:80** → WEB 티어가 인프라에 있다.

---

## 4. ★ DB 데이터는 어디에 저장하는가 — EBS / S3 / EFS

가장 자주 헷갈리는 질문이다. **역할을 세 칸으로 나눈다.**

### 4.1 한눈에

| 저장소 | 역할 | 이 프로젝트 |
|--------|------|-------------|
| **EBS** (노드당 1개) | **살아 있는 DB 데이터** (`datadir` → `/data/mysql`) | ✅ **본문** |
| **S3** | **백업 덤프** (시간축 복사본) | ✅ **서류 창고** |
| **EFS** | 여러 EC2가 공유하는 파일시스템 | ❌ **안 씀** |
| 인스턴스 스토어 / 루트만 | OS와 장부 수명 결합 | ❌ 지양 |

```text
[DB-a EC2] ── EBS-a (/data)   ← 자기 장부
[DB-b EC2] ── EBS-b (/data)   ← GR로 맞춘 사본
[DB-c EC2] ── EBS-c (/data)   ← GR로 맞춘 사본

              cron / 수동 덤프
                    ↓
                 [S3]          ← 어제·그제 서류
              Lifecycle로 N일 후 폐기
```

### 4.2 왜 EBS인가 (클러스터 ≠ 공유 디스크)

InnoDB Cluster는 **디스크 하나를 세 대가 동시에 마운트**하는 구조가 아니다.

- 각 노드가 **자기 블록 스토리지**에 datadir을 둔다.  
- Group Replication(무전기 `:13361`)이 **내용의 합의·복제**를 한다.  
- 그래서 AZ마다 EBS가 있고, 노드 수 = 데이터 볼륨 수(원칙).

비유:

> 금고 칸이 세 개이고, **칸마다 철제 캐비닛(EBS)** 이 있다.  
> 세 칸이 **한 캐비닛을 동시에 여는** 구조가 아니다.  
> 무전기로 “방금 입출고”를 맞춰 적을 뿐이다.

### 4.3 왜 EFS가 아닌가

| EFS를 쓰고 싶은 유혹 | 왜 안 맞나 |
|----------------------|------------|
| “공유니까 클러스터에 딱” | MySQL datadir 동시 다중 마운트는 정석이 아님 |
| “한곳에만 두면 관리 편해” | 잠금·지연·장애 도메인이 달라짐 |
| “백업도 EFS에” | 우리는 **시간축 백업은 S3** |

학습·운영 모두, 이 프로젝트의 DB 본문은 **EBS**다.

### 4.4 왜 S3인가 (그리고 S3만으로는 안 되는가)

| S3가 하는 일 | S3가 아닌 일 |
|--------------|--------------|
| cron `mysqldump` 결과 보관 | MySQL이 실시간으로 쿼리하는 저장소 |
| Lifecycle로 보존 기간 후 삭제 | GR 복제 통로 |
| 실수·전면 손실 시 restore 원본 | EC2 stop 동안의 “즉시 재기동용 datadir” |

DB 서브넷에 NAT가 없어도, **S3 Gateway Endpoint**로 백업을 올릴 수 있게 네트워크를 짜 두었다.  
금고가 담장 밖 길을 안 쓰면서도 **서류 창고에는 닿는다.**

### 4.5 Terraform에 박힌 설정

```text
ebs_block_device {
  device_name           = "/dev/sdf"   # Nitro면 nvme1n1
  delete_on_termination = false        # ★ EC2 종료 ≠ 장부 삭제
  encrypted             = true
}

S3 bucket + Lifecycle expiration = backup_retention_days (예: 7)
User Data: /data 마운트 + backup-to-s3.sh + cron
```

루트 볼륨은 OS용(`delete_on_termination = true` 가능).  
**장부는 데이터 EBS**다.

---

## 5. ★ EC2가 종료되면 어떻게 하나 — 백업본이 있어야 하는 이유

맞다. **EC2가 끝난다고 데이터가 같이 죽으면 설계 실패다.**  
다만 “백업”이라고 부르는 것을 **한 층으로만 생각하면** 또 실패한다.  
우리는 **3층 방어**다.

### 5.1 1층 — EBS가 인스턴스보다 오래 산다

| 사건 | EC2 | 데이터 EBS (`delete_on_termination=false`) |
|------|-----|-----------------------------------------------|
| **stop / start** | 멈춤/재기동 | 유지, 다시 붙음 |
| **terminate** (콘솔·장애) | 삭제 | **남음** (`available`) |
| 볼륨만 삭제 / destroy가 볼륨까지 | — | **사라짐** → S3 필요 |
| 루트에만 datadir을 둔 경우 | terminate | **장부도 같이 사망** (피해야 할 패턴) |

terminate 후 회복(개념):

```text
1) 콘솔/CLI에서 남은 EBS volume-id 확인
2) 같은 AZ에 새 DB EC2 생성 (또는 Terraform으로 노드 재생성)
3) EBS attach → /data 마운트
4) MySQL 기동
5) 클러스터에 다시 addInstance (멤버십 복구)
```

비유:

> 금고 **건물(EC2)** 을 허물어도,  
> **철제 캐비닛(EBS)** 은 창고에 남아 있다.  
> 새 건물을 짓고 캐비닛만 다시 넣으면 된다.  
> 단, 캐비닛 자체를 폐기하면 끝이다.

스모크 destroy 때 `delete_on_termination=false` 때문에 **고아 EBS 3개**가 남았다.  
비용이 나와서 수동 삭제했다.  
교훈: **장부를 남기려는 플래그는, destroy 절차에 “볼륨 점검”을 강제한다.**

### 5.2 2층 — 클러스터 사본 (노드 1대 장애)

InnoDB Cluster:

- Primary 1 + Secondary 2  
- 노드 **한 대**가 죽어도 과반(2/3)으로 버틸 수 있게 설계  
- 다른 노드 EBS에 **복제된 데이터**가 있음  

| 돕는 것 | 못 막는 것 |
|---------|------------|
| EC2 1대 다운 | `DROP DATABASE` (세 칸에 동시에 복제됨) |
| AZ 1곳 장애 | 랜섬·잘못된 마이그레이션 |
| Primary 페일오버 | terraform이 볼륨까지 지운 경우 |

> 클러스터는 **고가용**이지, **시간 여행(백업)** 이 아니다.

### 5.3 3층 — S3 백업본 (진짜 “어제 서류”)

초안이 강조한 문장 그대로다.

> EC2가 꺼져도 데이터가 날아가면 안 된다.  
> 볼륨으로 영속하고, **crontab으로 일정 시각에 백업**하고,  
> **일정 기간이 지나면** 오래된 백업을 지운다.

```text
mysqldump (또는 동등 도구)
    → gzip
    → s3://…/mysql-backup/<node>/<timestamp>.sql.gz
    → Lifecycle: N일 후 expiration
```

| 지표 | 의미 | 1차 예 |
|------|------|--------|
| **RPO** | 최대 얼마나 과거로 돌아가나 | 일 1회 덤프면 최대 ~24h |
| **RTO** | 얼마나 빨리 되돌리나 | restore 런북 1회 성공 |

언제 S3가  Compulsory 한가:

- 세 노드에 잘못된 DELETE가 퍼진 뒤  
- EBS까지 실수로 삭제  
- 리전·계정 사고에 가까운 시나리오 (더 큰 DR은 범위 밖이지만 방향은 S3·스냅샷)

### 5.4 층별 요약 표

| 층 | 수단 | EC2 terminate | DROP DATABASE | 비고 |
|----|------|---------------|---------------|------|
| 1 | EBS 분리 | 볼륨 재부착으로 회복 가능 | ❌ 이미 지워진 데이터가 볼륨에 있음 | `delete_on_termination=false` |
| 2 | Cluster GR | 다른 노드로 서비스 | ❌ 잘못된 쓰기도 복제 | HA |
| 3 | **S3 덤프** | EBS 없을 때 최후 | ✅ **시점 복구의 핵심** | cron + Lifecycle |

**“백업본이 있어야지”** — 맞다.  
그 백업본의 정식 자리는 **S3**이고,  
EBS는 “지금 켜진 장부”, 클러스터는 “켜진 장부의 사본들”이다.

### 5.5 학습 vs 실서비스 (데이터 = 자산)

설계편에 못 박은 문장:

> 서비스에서 가장 중요한 것은 **고객의 데이터**다. **데이터는 곧 자산**이다.  
> 보안(네트워크·SG·Bastion·HTTPS)을 신경 쓰는 이유도 유출·변조·소실을 막기 위해서다.

| | 이 프로젝트 (학습) | 실제 서비스 |
|--|-------------------|-------------|
| DB | EC2 InnoDB Cluster로 **원리 확인** | 대개 **RDS/Aurora** + 자동 백업 |
| 영속 | EBS + S3 덤프를 **손으로** | 스냅샷·PITR·보존 기간 UI |
| 목적 | RDS가 가리던 바닥을 본다 | 자산 보호·운영 부담 최소화 |

직접 구축은 RDS를 무시하라는 뜻이 아니다.  
**다음에 관리형을 켤 때, 버튼 뒤에서 무엇이 도는지를 알기 위한 훈련**이다.

---

## 6. 티어별 최종 고정값 (치트시트)

### 6.1 네트워크·보안

| 항목 | 값 |
|------|-----|
| VPC | `10.0.0.0/16` |
| 퍼블릭 | `10.0.0/1/2` |
| 앱 private | `10.0.10/11/12` |
| DB private | `10.0.20/21/22` |
| MySQL | **13306** |
| GR | **13361** (×10+1=133061 금지) |
| Router | **6446 / 6447** |
| DB 인터넷 | RT·SG 모두 차단 |

### 6.2 컴퓨트

| 항목 | 값 |
|------|-----|
| AMI | Ubuntu 24.04 |
| ALB TG | `instance`, port **80** |
| Compose | nginx + nest, nest는 expose만 |
| 프록시 | `http://nest:3000` (Compose DNS, 헤어핀 금지) |
| 도메인 | apex 하나, 경로 분기 |

### 6.3 데이터베이스

| 항목 | 값 |
|------|-----|
| 노드 | 3 (a/b/c) |
| 역할 | Primary 1 + Secondary 2 |
| 스토리지 | **EBS** `/data` |
| 백업 | **S3** + Lifecycle |
| ASG | **없음** |
| Router 1차 | 앱 EC2 로컬 |

---

## 7. 스모크 테스트 기록

승인 하에 비용 축소 apply → 확인 → destroy.

| 축소 | 값 |
|------|-----|
| 앱 | `t3.micro`, desired **1** |
| DB | `t3.micro` × 3, EBS **10GB** |
| 이후 | settings 원복 (`t3.small`, desired 2, EBS 20) |

| 확인 | 결과 |
|------|------|
| DB 3대 · 3AZ · private | running |
| EBS attach | OK |
| S3 + Lifecycle 7일 | OK |
| Bastion :22 · ALB active | OK |
| destroy | **110 resources** |
| 고아 EBS | 별도 삭제 (요금 방지) |
| 재확인 | `coupang-eats-dev-*` 과금 리소스 없음 |
| TF state | 비어 있음 |

남은 소액 가능 항목: **tfstate 백엔드 S3** (인프라 destroy 대상 아님).

운영 원칙:

> `plan`까지. **`apply` / `destroy`는 본인 승인 후.**

---

## 8. 여정에서 고정된 교훈

1. **“ECS 대체” 문장의 범위** — 스케줄러만 빼야지 Docker까지 빼면 안 된다.  
2. **WEB = ALB가 :80 Nginx를 침** — :3000 직접이면 2-Tier에 가깝다.  
3. **DB ≠ 앱 ASG** — 쿼럼·수명·포트가 다르다.  
4. **데이터 3층** — EBS(지금) · Cluster(사본) · S3(어제).  
5. **EC2 terminate에 대비** — `delete_on_termination=false` + 재부착 런북 + S3.  
6. **클러스터 ≠ 백업** — 잘못된 DELETE는 세 칸에 복제된다.  
7. **이중 자물쇠** — DB에 NAT도 없고 egress도 없다.  
8. **비용** — 장부가 무섭다고 켜 두면 청구서가 장부를 대신한다.  
9. **학습 vs 운영** — 원리는 EC2 Cluster, 자산 보호는 RDS를 존중.

---

## 9. 완성 판정표

| 질문 | 답 |
|------|-----|
| 수정 후 기획의 인프라 범위를 코드·문서로 채웠나? | **예 — 1차 완성** |
| Fargate·RDS·Swarm·CF를 넣지 않았나? | **예** |
| Docker·ECR 1차 포함했나? | **예** |
| DB 본문을 EBS, 백업을 S3로 설계·코드화했나? | **예** |
| EFS를 DB datadir로 쓰지 않았나? | **예** |
| EC2 종료 시 데이터 생존 전략이 문서에 있나? | **예 (EBS+S3+Cluster)** |
| 주문이 지금 AWS에서 도는가? | **아니오 (destroy·입주 전)** |
| ECS 수업과 대조할 바닥 단지가 저장소에 있나? | **예** |

**결론:**  
**ECS-less 3-Tier 인프라 프로젝트 1차(기획·설계·IaC·데이터 영속 원칙·스모크 사이클)는 완료**다.  
남은 것은 승인 후 **입주 스프린트**이지, 빠진 티어를 새로 파는 단계가 아니다.

---

## 10. 입주 체크리스트 (다음에 apply할 때)

1. `bastion_ssh_cidrs` = 현재 공인 IP `/32`  
2. `terraform plan` → **승인** → `apply`  
3. ECR push (nginx · nest)  
4. Bastion → MySQL 설치 (DB는 NAT 없음) → Cluster bootstrap  
5. 앱 Router · Nest `127.0.0.1:6446`  
6. HTTPS · `/health` · API  
7. `backup-to-s3.sh` 1회 성공 · (권장) restore  
8. **볼륨·버킷·NAT 비용 의식** — 끝나면 destroy, 고아 EBS 점검  

---

## 11. 관련 글

- [서문](./blog-ecs-less-3tier-intro.md)  
- [기획 수정 — Docker·ECR](./blog-planning-revision-docker-ecr.md)  
- [네트워크](./blog-vpc-network-design.md) · [네트워크 TF](./blog-terraform-network-code.md)  
- [보안 그룹](./blog-security-groups.md) · [SG TF](./blog-terraform-security-groups.md)  
- [ACM·DNS](./blog-acm-route53-https-design.md) · [DNS TF](./blog-dns-terraform-implementation.md)  
- [컴퓨트](./blog-compute-web-was-design.md) · [컴퓨트 TF](./blog-compute-terraform-implementation.md)  
- [DB 설계](./blog-database-innodb-cluster-design.md) · [DB TF](./blog-database-terraform-implementation.md)  

---

## 12. 한 줄 요약

Fargate·RDS가 가리던 바닥을, Docker·ECR·Nginx·ALB·ASG·ACM·**EC2 InnoDB Cluster**로 다시 쌓았다.  
장부의 **본문은 노드별 EBS**, **어제 서류는 S3**, **EFS는 쓰지 않는다.**  
EC2가 종료돼도 EBS를 남기고, 그래도 모자라면 S3 백업본으로 되돌린다 — 클러스터만 믿으면 잘못된 DELETE에 무너진다.  
모듈 다섯과 시리즈 글, 짧은 스모크까지가 1차 완성이다.  
주문이 사는 입주는 다음 승인 날의 일 — **단지 도면과 골조, 그리고 데이터가 어디에 사는지는 여기서 끝냈다.**
