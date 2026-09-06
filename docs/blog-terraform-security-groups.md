# 밑바닥부터 다시 쌓는 3-Tier 인프라 — 보안 그룹 Terraform 코드 해설

보안 그룹 **왜 이렇게 짜는지**(NACL vs SG, 체이닝, GR 포트 오버플로)는 [보안 그룹 본편](./blog-security-groups.md)에 있다.  
이번 글은 그 명세를 **Terraform으로 어떻게 옮겼는지**만 다룬다.

전체 비유는 네트워크 편과 이어진다.

> **서울에 ‘쿠팡이츠 단지’를 짓는다.**  
> 지난 편에서 **담장(VPC)·9개 구역(서브넷)·정문(IGW)·직원 출구(NAT)·길안내판(RT)** 을 깔았다.  
> 이번 편은 건물이 들어서기 **전에**, 각 집 **현관 스마트 도어락(Security Group)** 과 **출입증(SG ID)** 을 미리 발급하는 일이다.

Terraform 코드는 출입증 대장이고, `terraform apply`는 도어락 설치다.

읽을 때 규칙:

> **파일 이름 = 그 파일에 들어 있는 것.**  
> 문 번호(포트)·경비실 허용 명단은 `ports.tf`.  
> 시공팀 호출은 `main.tf`.  
> 집마다 현관 규칙은 `modules/security/rules_*.tf`.

인스턴스(Bastion, ALB, ASG, MySQL, Redis)는 **아직 없다.**  
비유하면 **가구를 들이기 전에 도어락만 벽에 달아 둔 상태**다. 다음에 건물을 세울 때 이 도어락을 ENI에 붙인다(attach).

실습 중에는 apply로 AWS에 올렸다가, 비용 때문에 destroy로 다시 내린 상태일 수 있다.  
아래의 `sg-0…` ID는 **한 번 시공했을 때의 예시**다. 다시 apply 하면 ID는 새로 나온다. 설계와 파일 구조는 그대로다.

---

## 0. 무엇을 만들었는가 (한 장)

단지 안에 발급하는 출입증은 **6종류**다.

| 출입증 (SG) | 비유 | 붙일 건물 | 현관이 누구를 들이나 |
|-------------|------|-----------|----------------------|
| `sg-alb` | 로비 에스컬레이터·안내데스크 | ALB | 인터넷 손님 80·443 |
| `sg-app` | 매장·주방 직원증 | Nginx+Nest ASG | 에스컬레이터(ALB)와 경비(Bastion)만 |
| `sg-db` | 금고실 출입증 | MySQL 노드 3대 | 주방·라우터·**금고끼리** |
| `sg-redis` | 단기 보관 사물함 | Redis EC2 | 주방만 6379 |
| `sg-router` | (선택) DB 안내원 전용증 | Router 전용 EC2 | 주방만 6446·6447. **1차는 안 붙임** |
| `sg-bastion` | 경비실 출입증 | 점프 호스트 | 운영자 집 주소(`/32`)만 22 |

내부 통행은 “어느 **동네(CIDR)** 에서 왔나”가 아니라 “어떤 **출입증(SG)** 을 찼나”로 본다.  
같은 주방 복도(`10.0.10.0/24`)에 임시 작업 부스를 세워도, `sg-app`이 없으면 금고 문은 안 열린다.

한 번 apply 했을 때 콘솔에 찍힌 이름·ID 예:

| Name | 예시 ID |
|------|---------|
| `coupang-eats-dev-sg-alb` | `sg-051f9fae0352e396f` |
| `coupang-eats-dev-sg-app` | `sg-0ab84cf3f102f2c58` |
| `coupang-eats-dev-sg-db` | `sg-02cd2496453fb0167` |
| `coupang-eats-dev-sg-redis` | `sg-0518a832143f053b5` |
| `coupang-eats-dev-sg-router` | `sg-05f6c3684858011aa` |
| `coupang-eats-dev-sg-bastion` | `sg-03fbbc85b9e2250a0` |

안 만든 것: EC2, ALB, ASG, NACL 커스텀, S3용 SG.  
S3 Gateway Endpoint는 **현관이 없다.** 길안내판(RT)에 지하 통로만 적혀 있을 뿐이다.

네트워크 편에서 깐 단지 주소는 그대로 전제한다.  
퍼블릭 `10.0.0/1/2`, 앱 `10.0.10/11/12`, DB `10.0.20/21/22`, NAT는 로비 a **하나**.  
SG는 그 VPC 안에만 산다. 담장 밖 출입증은 없다.

---

## 1. 아파트 2중 보안과 Terraform의 대응

본편의 NACL vs SG를 코드 관점에서 다시 붙이면 이렇다.

```text
[ 외부 인터넷 ]
      │
      ▼
┌─ 서브넷 (아파트 동) ─────────────────────────────┐
│  NACL = 동 입구 경비실                             │
│  · 이번 프로젝트: 기본 Allow (장부만 두고 통과)   │
│  · Terraform 네트워크 모듈이 커스텀 NACL을 안 만듦 │
│                                                    │
│    ┌─ EC2 / ALB ENI (한 세대) ─────────────────┐  │
│    │  Security Group = 세대 스마트 도어락         │  │
│    │  · 이번 모듈이 만드는 것                     │  │
│    │  · Stateful: 들어올 때 허가되면 응답은 자동  │  │
│    └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

비유를 한 줄로 줄이면:

| AWS | 단지 비유 | 이번 Terraform |
|-----|-----------|----------------|
| NACL | 동 입구 장부 (Stateless) | 손대지 않음. 기본 통과 |
| Security Group | 세대 도어락 (Stateful) | `modules/security` |
| SG ID | 출입증 바코드 | `aws_security_group.*.id` |
| ingress rule | “이 출입증이면 이 문으로” | `rules_*.tf` |
| CIDR Source | “이 동네 주소면” | 인터넷·운영자만 |
| SG Source | “이 출입증이면” | 단지 안 전부 |

동 입구(NACL)를 느슨히 두고 세대 도어락(SG)을 촘촘히 조이는 전략이다.  
악성 IP를 동 앞에서 막을 일이 생기면 그때 NACL Deny를 보조로 쓴다.

---

## 2. 왜 디렉터리를 이렇게 나눴는가

네트워크에서 CIDR을 `variables.tf` 기본값에 숨기지 않았던 것과 같다.

포트를 모듈 기본값이나 gitignore 된 tfvars에 두면, 사람이 “금고 문 번호 13306이 어디 있지?”를 못 찾는다.  
비유하면 **호수 대장과 출입증 문 번호 대장을 서랍 깊숙이 숨긴 것**이다.

| 파일 | 단지 비유 | 사람이 찾는 것 |
|------|-----------|----------------|
| `cidrs.tf` | 필지 호수 대장 | 서브넷 주소. **SG Source로 쓰지 않음** |
| `ports.tf` | ★ 문 번호·경비실 화이트리스트 | 13306, 13361, 6379, Bastion `/32` |
| `settings.tf` | 단지 간판·도시 | 리전, `name_prefix`, 태그 |
| `main.tf` | 시공팀 조립 | `module "network"` + `module "security"` |
| `sg.tf` | 도어락 **본체** 6개 | 규칙은 아직 없음 |
| `rules_*.tf` | 집마다 **앱 등록** | 누가 몇 번 문으로 |
| `variables.tf`(모듈) | 주문서 양식 | 타입만. 숫자 없음 |

규칙을 SG 이름별로 파일로 쪼갠 이유: `rules_db.tf`를 열면 **금고 도어락만** 보인다.  
한 `main.tf`에 규칙을 다 넣으면 “GR 13361이 어디 있지?”가 다시 숨는다.  
비유하면 로비·주방·금고·경비실 매뉴얼을 **한 권에 섞어 놓은 아파트 관리 지침서**다.

---

## 3. 디렉터리 전체

```text
dev_infra/
  environments/dev/                 ← 현장 소장실 (토목 + 출입증 같이)
    cidrs.tf                        필지 호수
    ports.tf                        ★ 문 번호·경비실 명단
    settings.tf                     간판·도시
    main.tf                         모듈 조립 (network + security)
    versions.tf                     도면 금고(S3) 주소
    providers.tf
    outputs.tf                      필지 번호 + 출입증 번호
  modules/security/                 ← 출입증·도어락 전문 시공팀
    sg.tf                           본체 6개 (빈 도어락)
    rules_alb.tf                    로비 에스컬레이터
    rules_app.tf                    주방
    rules_db.tf                     금고 ★
    rules_redis.tf                  사물함
    rules_router.tf                 (선택) DB 안내원
    rules_bastion.tf                경비실
    variables.tf                    주문서 양식만
    outputs.tf                      출입증 ID 인수인계
```

소장실을 폴더로 나누지 않은 이유: 같은 날 시공할 때 `module.network.vpc_id`를 바로 넘긴다.  
비유: 토목 도면과 출입증 대장을 **같은 현장 사무실**에 둔다.

state 서랍 이름은 처음 만든 `environments/dev/network/terraform.tfstate`를 유지한다.  
금고(버킷)는 하나이고, 서랍 라벨만 예전에 “토목”이라고 적혀 있을 뿐이다. 키를 바꾸면 도면 이전이 필요하다.

---

## 4. 값이 흐르는 길

숫자를 바꿀 때 손대는 곳은 **한 군데**다. 호수 대장(`cidrs.tf`)과 문 번호 대장(`ports.tf`)을 헷갈리지 않는다.

```text
ports.tf / settings.tf
        │  “금고 문은 13306, 금고끼리 무전기는 13361”
        │  “단지 간판은 coupang-eats-dev”
        ▼
main.tf
        │  “이 단지(vpc_id)에 도어락 시공팀을 불러라”
        ▼
modules/security/variables.tf     ← 주문서에 칸만 있음 (타입)
        ▼
modules/security/sg.tf            ← 빈 도어락 6개 벽에 부착
        ▼
modules/security/rules_*.tf       ← “저 출입증이면 열어라” 등록
        ▼
outputs → terraform output security_group_ids
        │
        ▼
다음 편: 건물을 세울 때 이 도어락을 ENI에 장착
```

Terraform은 같은 디렉터리 `.tf`를 한 덩어리로 읽는다.  
`ports.tf`의 `locals`와 `settings.tf`의 `locals`는 이름이 안 겹치면 한 네임스페이스다.

`main.tf`에 `13306`을 다시 적지 않는다.  
적으면 **문 번호 대장이 두 장**이 되어, 나중에 하나만 고치면 현관과 엔진이 엇갈린다.

---

## 5. 현장 소장실 — `ports.tf`와 `main.tf`

### 5.1 `ports.tf` — 문 번호 대장

아파트에서 “101호 현관은 몇 번 키패드로 여나”를 한 장에 모아 둔 것과 같다.

```hcl
locals {
  mysql_port    = 13306
  mysql_gr_port = 13361 # 자동 13306×10+1=133061 금지
  mysql_x_port  = 33060

  enable_mysql_x_protocol = true

  mysql_router_rw_port = 6446
  mysql_router_ro_port = 6447
  redis_port           = 6379

  http_port  = 80
  https_port = 443
  ssh_port   = 22
  dns_port   = 53
  ntp_port   = 123

  bastion_ssh_cidrs = []  # "x.x.x.x/32"
}
```

| 이름 | 값 | 단지 비유 |
|------|-----|-----------|
| `mysql_port` | 13306 | 금고 **손님용 창구**. 흔한 3306을 안 써서 자동 침입을 조금 어렵게 |
| `mysql_gr_port` | **13361** | 금고 **직원끼리 무전기**. 공식 계산(`×10+1`)은 133061 → 건물 층수 제한(65535) 초과. **수동으로 채널 고정** |
| `mysql_x_port` | 33060 | 금고 **관리자 전용 키** (MySQL Shell) |
| `mysql_router_rw/ro` | 6446 / 6447 | DB 안내원이 쓰는 **창구 두 개** (쓰기 / 읽기) |
| `redis_port` | 6379 | 사물함 번호. Nest 세션·JWT 블랙리스트 |
| `bastion_ssh_cidrs` | `[]` | 경비실에 “우리 집 주소만 출입” 명단. 비우면 **명단이 없어서 바깥에서 못 두드림** |

중요한 함정 비유:

> 도어락에는 “13361로 열어라”고 적어 두고,  
> 금고 안 무전기(`group_replication_local_address`)는 다른 채널에 맞춰 두면  
> **문은 열려 있는데 직원끼리 교신이 안 된다.**  
> SG와 `my.cnf`는 **같은 문 번호 대장**을 봐야 한다.

`bastion_ssh_cidrs`가 비면 `for_each = toset([])` 이라 인터넷 → 경비실 22 리소스가 **0개**다.  
본인 공인 IP를 알면:

```hcl
bastion_ssh_cidrs = ["203.0.113.10/32"]
```

비유: 경비실 화이트리스트에 **우리 집 현관 주소만** 적는다. 전 세계(`0.0.0.0/0`)를 적지 않는다.

### 5.2 `main.tf` — 도어락 시공팀 호출

```hcl
module "security" {
  source = "../../modules/security"

  name_prefix = local.name_prefix
  vpc_id      = module.network.vpc_id
  tags        = local.tags

  mysql_port              = local.mysql_port
  mysql_gr_port           = local.mysql_gr_port
  # … ports.tf 의 local 을 그대로 전달
  bastion_ssh_cidrs       = local.bastion_ssh_cidrs
}
```

소장의 일은 “**어느 단지에**, **문 번호 대장은 이 장**”만 넘기는 것이다.  
`vpc_id`를 문자열로 박지 않는다. 토목이 준 단지 등기번호를 그대로 쓴다.  
담장이 바뀌면 출입증도 자동으로 그 담장 안에 발급된다.

### 5.3 `outputs.tf` — 출입증 인수인계 서류

```hcl
output "security_group_ids" {
  value = module.security.security_group_ids
}
```

다음에 건물을 세울 때 “주방 도어락은 이 바코드”라고 넘긴다.  
지금은 서류만 뽑아 둔다. `terraform output security_group_ids`.

---

## 6. 시공팀 — 도어락 본체를 먼저 (`sg.tf`)

### 6.1 순환 참조 = “서로가 서로의 비밀번호를 먼저 알아야 함”

체이닝은 현실에서도 고리다.

```text
주방 직원증을 찬 사람만 금고에 들어가고 (db ingress ← app)
주방은 금고로 물건을 나른다                 (app egress → db)
```

보안 그룹 **리소스 한 덩어리 안**에 서로 규칙을 넣으면 Terraform이 이렇게 말한다.

> 주방을 만들려면 금고 ID가 필요하고,  
> 금고를 만들려면 주방 ID가 필요하다.  
> → Cycle.

코드로 쓰면:

```hcl
# 이렇게 하면 Cycle — 하지 말 것
resource "aws_security_group" "app" {
  egress {
    security_groups = [aws_security_group.db.id]
  }
}
resource "aws_security_group" "db" {
  ingress {
    security_groups = [aws_security_group.app.id]
  }
}
```

해결은 아파트 시공 순서와 같다.

```text
1) 벽에 스마트 도어락 본체 6개만 단다     sg.tf
   → 아직 “누구를 들여보낼지”는 비어 있음
2) 앱에 “저 출입증이면 열어라”를 등록한다  rules_*.tf
   → 본체 ID는 이미 있으니까 서로를 가리킬 수 있음
```

본체를 달 때는 옆집 비밀번호를 몰라도 된다.  
앱을 등록할 때는 이미 옆집 도어락 바코드가 있다.

### 6.2 껍데기 코드

```hcl
resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-sg-db"
  description = "MySQL InnoDB Cluster. App/Router/self/Bastion in. No internet egress"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-sg-db"
    Role = "db"
  })

  lifecycle {
    create_before_destroy = true
  }
}
```

| 포인트 | 비유 |
|--------|------|
| 인라인 ingress/egress 없음 | 본체만 달고 앱은 다음에 |
| `description`은 ASCII만 | 제조사 명판에 한글을 못 새김. 한글은 관리 일지(주석)에 |
| `create_before_destroy` | 도어락 교체 시 **새것을 먼저** 달고 옛것을 뗀다. 집에 사람이 있을 때 잠깐 문 없음 방지 |
| 기본 egress all 삭제 | AWS가 달아 둔 “아무 데나 나가기” 열쇠를 Terraform이 뽑는다. 우리가 다시 적지 않으면 **나가는 문이 전부 잠김** |

`common_tags`는 단지 공통 스티커다. `Project`, `ManagedBy=terraform`, `Layer=security`, `Environment=dev`.

---

## 7. 규칙 리소스 하나 읽는 법

체이닝 한 줄은 “이 집 도어락에, 저 출입증이면, 이 문 번호로”다.

```hcl
resource "aws_vpc_security_group_ingress_rule" "app_http_from_alb" {
  security_group_id            = aws_security_group.app.id   # 주방 도어락
  referenced_security_group_id = aws_security_group.alb.id   # 에스컬레이터 출입증
  ip_protocol                  = "tcp"
  from_port                    = var.http_port               # ports.tf → 80
  to_port                      = var.http_port
}
```

| 필드 | 단지 비유 |
|------|-----------|
| `security_group_id` | **어느 집** 도어락에 규칙을 다는가 |
| `referenced_security_group_id` | **어떤 출입증**이면 통과 (체이닝) |
| `cidr_ipv4` | **어떤 주소지**면 통과 (인터넷, 운영자 집). 출입증과 한 규칙에 같이 못 씀 |
| `from_port` / `to_port` | 몇 번 문. 항상 `ports.tf`에서 옴 |

손님(인터넷)과 관리자 집(`/32`)만 주소지로 받고,  
단지 안 직원 통행은 전부 출입증이다.

구식 `aws_security_group_rule` 대신 `aws_vpc_security_group_ingress_rule`을 쓴다.  
규칙마다 고유 ID와 `Name` 태그가 생겨, 콘솔에서 “주방-ALB-HTTP” 스티커를 바로 찾을 수 있다.

---

## 8. 파일별 시공 — 집마다 현관 규칙

### 8.1 `rules_alb.tf` — 로비 에스컬레이터

손님은 밖에서 오고, 에스컬레이터만 주방으로 사람을 보낸다.

| 방향 | 포트 | Source / Dest | 비유 |
|------|------|----------------|------|
| In | 80, 443 | 인터넷 | 누구나 로비에 들어올 수 있음 (HTTPS로 안내) |
| Out | 80 | `sg-app`만 | 에스컬레이터는 **주방 출입증을 찬 집**으로만 내려감 |

TLS 가방(ACM)은 로비에서 벗긴다. 주방 문에 443을 또 달지 않는다.  
헬스체크도 에스컬레이터 → 주방 80이라 별도 규칙이 없다.

ALB 우회 방지의 **반대편**: 주방이 ALB만 들이는 것과 맞춰, ALB도 주방만 두드린다.

### 8.2 `rules_app.tf` — 매장·주방 (Nginx + Nest 같은 집)

WEB과 WAS가 **한 세대**에 산다. 안방(Nest:3000)과 거실(Nginx:80)은 집 안 통화다.

| 방향 | 포트 | Source / Dest | 비유 |
|------|------|----------------|------|
| In | 80 | `sg-alb` | 에스컬레이터 탄 손님만. 담장 밖이 주방 초인종을 직접 누르면 거절 |
| In | 22 | `sg-bastion` | 경비 동행 SSH만 |
| Out | 13306 | `sg-db` | 금고 창구. **집 안 DB 안내원(로컬 Router)도 나갈 때는 이 출입증** |
| Out | 6446·6447 | `sg-router` | 안내원을 **다른 동**에 둘 때만 |
| Out | 6379 | `sg-redis` | 사물함 |
| Out | 443·80·53·123 | 인터넷 (NAT) | 직원 출구로 택배·DNS·시계 맞춤 |

**SG에 안 연 것 (집 안 내선)**

- Nest `:3000` — 거실 Nginx가 `127.0.0.1:3000`으로 속삭임. 단지 복도(ENI)로 안 나감.  
- 로컬 Router `:6446` — Nest → `127.0.0.1:6446`. 복도로 안 나감.  
  안내원이 금고로 물건을 나를 때 비로소 `sg-app` → `sg-db` 13306을 탄다.

비유: 가족끼리 집 안에서 말하는 건 동 경비실·세대 도어락과 무관하다.  
**복도로 나오는 순간**부터 출입증이 필요하다.

### 8.3 `rules_db.tf` — 금고 3칸 (InnoDB Cluster) ★

네 개 SG만으로 부족했던 이유의 중심이다.  
금고는 **손님 창구**와 **직원 무전기**가 따로다.

| 방향 | 포트 | Source / Dest | 비유 |
|------|------|----------------|------|
| In | 13306 | `sg-app` | 주방(또는 집 안 안내원)이 창구로 |
| In | 13306 | `sg-router` | 안내원을 다른 동에 둘 때 |
| In | 13306 | **self** | 금고 직원끼리 창구로 서류 주고 |
| In | **13361** | **self** | **무전기. 빼면 세 금고가 서로를 못 보고 클러스터 붕괴** |
| In | 22 | `sg-bastion` | 경비 동행 점검 |
| In | 33060 | bastion·self | 관리자 전용 키 (선택) |
| Out | 13306·13361·33060 | **self만** | 바깥 인터넷으로 안 나감 |

```hcl
# 무전기 수신 + 송신. 둘 다 필요
resource "aws_vpc_security_group_ingress_rule" "db_gr_self" { … mysql_gr_port, self }
resource "aws_vpc_security_group_egress_rule"  "db_gr_self" { … mysql_gr_port, self }
```

**ingress만 열고 egress를 안 열면?**  
Stateful은 “들어온 대화의 대답”은 자동이다.  
그런데 GR은 금고 A가 **먼저** B에게 말을 건다.  
기본 “아무 데나 나가기” 열쇠를 뽑은 뒤라, egress self가 없으면 **무전기를 켤 수 없다.**

네트워크 편에서 DB 안내판에 `0.0.0.0/0`을 안 깔았다.  
이번 편에서 DB 도어락도 인터넷 egress를 안 연다.  
**길도 없고, 출입증도 바깥으로 안 나간다.** 이중 자물쇠다.

X Protocol은 `count = enable_mysql_x_protocol ? 1 : 0`.  
관리자 키를 안 쓰려면 `ports.tf`에서 스위치만 끄면 된다.

### 8.4 `rules_redis.tf` — 단기 사물함

| 방향 | 포트 | Source | 비유 |
|------|------|--------|------|
| In | 6379 | `sg-app`만 | 주방 직원만 사물함 열쇠 |
| In | 22 | `sg-bastion` | 경비 동행 |
| Out | 없음 | — | 주방이 먼저 열고, 응답은 Stateful로 돌아감 |

사물함을 인터넷이나 “주방 복도 전체”에 열어 두지 않는다.  
패치용 바깥 나들이(443)가 필요해지면 그때 egress 한 줄을 더한다.

### 8.5 `rules_router.tf` — (선택) DB 안내원 전용 동

1차 권장: 안내원을 **주방 집 안**에 둔다 (`127.0.0.1:6446`).  
전용증(`sg-router`)은 **발급만 해 두고 건물에 안 붙인다.**  
비유: 예비용 출입증을 서랍에 넣어 둔 것. 규칙은 만들어 둬도 비용이 거의 없다.

| 방향 | 포트 | Source / Dest |
|------|------|----------------|
| In | 6446·6447 | `sg-app` |
| In | 22 | `sg-bastion` |
| Out | 13306 | `sg-db` |

나중에 안내원을 단독 동으로 빼면, 그 ENI에 `sg-router`만 채우면 된다.

### 8.6 `rules_bastion.tf` — 경비실

```hcl
resource "aws_vpc_security_group_ingress_rule" "bastion_ssh_from_operator" {
  for_each = toset(var.bastion_ssh_cidrs)
  …
}
```

명단이 비면 **바깥에서 경비실 초인종을 누를 규칙이 0개**다.  
IP를 넣기 전에 Bastion EC2를 켜도 SSH는 닫혀 있다. 의도된 기본값이다.

아웃바운드 22는 주방·금고·사물함·안내원 **각각의 출입증**으로만 점프한다.  
단지 전체(`10.0.0.0/16`)에 22를 한 방에 열지 않는다.  
비유: 경비가 “이 단지 아무 집이나 열쇠로 연다”가 아니라, **등록된 출입증 집만** 동행한다.

경비실은 로비(퍼블릭)에 살 예정이라, yum·시계용 443·53·123 egress가 있다.  
관리자 키(33060) → 금고도 스위치가 켜져 있을 때 연다.

---

## 9. 한 장으로 보는 단지 통행도

```text
[ 인터넷 손님 ]
      │  80, 443  (주소지 = 전 세계)
      ▼
[ 로비 에스컬레이터 sg-alb ]
      │  80  (출입증 = sg-alb → 주방만)
      ▼
[ 주방 sg-app ]  Nginx + Nest (+ 집 안 Router)
      │
      ├─ 창구 13306 ──▶ [ 금고 sg-db ] ◀── 무전기 13361 ──▶ (금고끼리)
      ├─ 안내원 6446/7 ▶ [ sg-router ]   ※ 전용 동일 때만
      └─ 사물함 6379 ──▶ [ sg-redis ]

[ 운영자 집 /32 ]          ※ ports.tf 비면 이 화살표 자체 없음
      │  22
      ▼
[ 경비실 sg-bastion ] ──22──▶ 주방 / 금고 / 사물함 / 안내원
```

S3 지하 통로는 이 그림에 없다. 도어락이 아니라 **길안내판** 이야기다.

---

## 10. 체이닝 vs CIDR — 코드 한 줄 비유

```hcl
# 안 쓰는 방식 — “주방 복도(10.0.10.0/24)에 사는 사람이면 금고 통과”
cidr_ipv4 = "10.0.10.0/24"

# 쓰는 방식 — “주방 직원증(sg-app)을 찬 사람만 금고 통과”
referenced_security_group_id = aws_security_group.app.id
```

| | 동네(CIDR) | 출입증(SG) |
|--|------------|------------|
| 비유 | 그 동 주민이면 OK | 직원증 찬 사람만 OK |
| 임시 부스 | 같은 복도면 금고까지 갈 수 있음 | 직원증 없으면 차단 |
| ASG로 사람(IP)이 바뀌어도 | 대역만 맞으면 OK | 직원증만 같으면 OK |

교육에서 CIDR을 쓰는 것은 “복도만 보면 된다”는 가독성이다.  
이 프로젝트는 **출입증 하나**로 통일한다. 둘을 동시에 열면 구멍이 두 개다.

---

## 11. apply 때 겪은 함정 (다시 밟지 말 것)

1. **도어락 명판(`description`)에 한글**  
   AWS는 ASCII만 받는다. `전용 EC2일 때만` → 400.  
   한글은 관리 일지(`#` 주석)에만 쓴다.

2. **부분 실패 후 재시공**  
   본체 일부는 달리고 안내원 명판만 한글이라 실패했다.  
   고친 뒤 apply면 **안 달린 것만** 추가된다. 담장(네트워크)은 그대로.

3. **기본 “아무 데나 나가기” 열쇠를 뽑은 뒤**  
   사물함처럼 손님이 먼저 오면 egress를 안 적어도 응답은 돌아온다.  
   금고 무전기처럼 **우리가 먼저 걸면** egress self가 필수다.

4. **서랍 라벨**  
   state 키가 `…/network/…`여도 같은 사무실에 출입증 도면이 들어 있다.  
   라벨만 보고 출입증 state가 없다고 착각하지 않는다.

5. **destroy**  
   실습이 끝나면 단지·도어락을 내린다. NAT·EIP 요금이 계속 나기 때문이다.  
   코드와 문서는 남고, AWS ID만 사라진다. 다시 올리면 ID는 새로 발급된다.

---

## 12. 모듈 `outputs` — 다음에 건물에 붙일 바코드

| output | 다음에 장착할 건물 |
|--------|-------------------|
| `alb_security_group_id` | 로비 에스컬레이터(ALB) |
| `app_security_group_id` | 주방 ASG |
| `db_security_group_id` | 금고 노드 3대 |
| `redis_security_group_id` | 사물함 Redis |
| `router_security_group_id` | 안내원 전용 동 (쓸 때만) |
| `bastion_security_group_id` | 경비실 |
| `security_group_ids` 맵 | 한눈에 보기 |

```bash
cd dev_infra/environments/dev
terraform output security_group_ids
```

---

## 13. 코드가 일부러 안 한 것

| 안 한 것 | 비유 | 이유 |
|----------|------|------|
| EC2/ALB/ASG에 attach | 가구 입주 | 다음 편. 도어락 ID만 준비 |
| Bastion 22 = `0.0.0.0/0` | 전 세계가 경비실 초인종 | 명단 없으면 안 연다 |
| DB·Redis 인터넷 egress | 금고·사물함이 바깥 나들이 | 길도 없고 출입증도 안 나감 |
| DB Source = 앱 CIDR | 복도 주민이면 통과 | 체이닝과 이중으로 안 염 |
| S3용 SG | 지하 통로에 현관 | Gateway는 안내판만 |
| Nest 3000, 로컬 6446 | 집 안 내선 | ENI 규칙이 아님 |
| 커스텀 NACL | 동 입구 장부 강화 | 1차는 세대 도어락이 주력 |
| NAT를 AZ마다 3개 | 직원 출구 3개 | 네트워크 레이어 범위. 앱 RT만 미리 3개 |

---

## 14. 명령과 시공의 대응

```bash
# (처음이라면) 도면 금고부터
cd dev_infra/global/s3-backend && terraform apply

# 단지 토목 + 출입증 도어락
cd dev_infra/environments/dev
terraform init
terraform plan    # 네트워크 No changes + SG add, 또는 전부 신규
terraform apply
terraform output security_group_ids

# 실습 종료 시 비용 차단
terraform destroy
# state 버킷까지 내릴지는 팀 정책. 완전 철거라면 global/s3-backend 도 destroy
```

경비실에 들어가려면 `ports.tf`의 `bastion_ssh_cidrs`만 고치고 다시 apply 한다.

---

## 15. 한 줄 요약

이 Terraform은 **쿠팡이츠 단지 안의 출입증 6장과 세대 스마트 도어락 규칙을 코드로 고정한 것**이다.

- 문 번호는 `ports.tf`에만 있다. 금고 무전기는 **13361 수동**.  
- 도어락 본체(`sg.tf`)와 앱 등록(`rules_*.tf`)을 나눠, “서로가 서로의 비밀번호를 먼저 알아야 하는” 순환을 피했다.  
- 단지 안은 **동네(CIDR)** 가 아니라 **출입증(SG ID)** 으로 통행한다.  
- 금고는 손님 창구(13306)와 무전기(13361) **수신·송신**이 모두 있어야 세 칸이 한 클러스터로 산다.  
- 안내원 전용증은 서랍에만 두고, 1차는 주방 집 안 Router를 쓴다.  
- 경비실 바깥 초인종은 명단(`/32`)을 넣기 전까지 없다.  
- 가구(EC2·ALB·ASG)는 다음 편에서, 이 도어락을 현관에 **장착**한다.

WEB·WAS를 어떤 순서로 올릴지(DB는 빼는 이유 포함)는 [WEB·WAS 컴퓨트 설계](./blog-compute-web-was-design.md)다.
