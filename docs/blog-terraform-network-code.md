# 밑바닥부터 다시 쌓는 3-Tier 인프라 — 네트워크 Terraform 코드 해설

네트워크 **왜 이렇게 짜는지**는 [VPC 설계 본편](./blog-vpc-network-design.md)에 있다.  
이번 글은 그 설계를 **Terraform으로 어떻게 옮겼는지**만 다룬다.

전체 비유는 하나다.

> **서울에 ‘쿠팡이츠 단지’를 짓는다.**  
> Terraform 코드는 도면이고, `terraform apply`는 시공이다.

읽을 때 규칙을 하나 둔다.

> **파일 이름 = 그 파일에 들어 있는 것.**  
> 주소(CIDR)를 찾으면 `cidrs.tf`만 연다. 리전·간판은 `settings.tf`. 모듈 조립은 `main.tf`.

---

## 0. 무엇을 만들었는가 (한 장)

실습 1차로 깐 토목은 이것이다.

| AWS 리소스 | 개수 | 역할 |
|------------|------|------|
| VPC | 1 | 단지 담장 `10.0.0.0/16` |
| 서브넷 | 9 | 로비 3 + 주방 3 + 금고 3 (`/24`, AZ a/b/c) |
| Internet Gateway | 1 | 단지 정문 (양방향) |
| NAT Gateway + EIP | 1쌍 | 직원 출구 (지금은 로비 a만, SPOF 허용) |
| 라우팅 테이블 | 5 | 퍼블릭 1 + 앱 a/b/c 각 1 + DB 1 |
| S3 Gateway Endpoint | 1 | S3로 가는 지하 통로 (NAT 요금 회피) |

안 만든 것: Security Group, Bastion, ALB, ASG, EC2, DynamoDB Endpoint, 커스텀 NACL.

리전은 `ap-northeast-2`(서울).  
이 레이어는 이미 apply 되어 있고, 파일만 나눠도 `terraform plan`은 **No changes**다. 도면을 읽기 쉽게 고친 것이지 단지를 다시 깐 것이 아니다.

---

## 1. 왜 디렉터리를 이렇게 나눴는가

처음에는 CIDR이 `environments/dev/variables.tf`의 **변수 기본값**에 들어 있었다.

문제는 이것이다.

- 파일 이름이 `variables.tf`면 “입력 칸”이지 “호수 대장”이 아니다.
- Terraform에서 `variable`은 환경변수·tfvars·`-var`로도 덮일 수 있어, **숫자가 어디에 적혀 있는지** 사람이 한 번에 못 찾는다.
- 이 레포는 `*.tfvars`를 gitignore 한다. 주소를 tfvars에 두면 Git에 안 보여서 더 숨는다.

그래서 **숫자를 코드에 하드코딩하되, 파일 하나로 모았다.** 자동 계산도 하지 않는다. `10.0.10.0/24`는 “10번대 = 앱”이라는 약속이지, 공식으로 뽑은 값이 아니다.

| 파일 | 사람이 찾는 것 |
|------|----------------|
| `cidrs.tf` | VPC·AZ·서브넷 주소. 퍼블릭 0번대 / 앱 10번대 / DB 20번대 |
| `settings.tf` | 리전, 단지 이름(`name_prefix`), 태그 |
| `main.tf` | 시공팀 조립 (`module "network"` / `"security"`) |
| `versions.tf` | Terraform 버전 + S3 state 금고 주소 |
| `providers.tf` | AWS provider (리전 값은 settings에서) |
| `outputs.tf` | 다음 공사(SG, Bastion…)가 받을 필지 번호 |

모듈 `modules/network/variables.tf`는 **입구 모양(타입)** 만 정한다. 주소 숫자는 없다.

---

## 2. 디렉터리 전체

```text
dev_infra/
  .gitignore                      ← *.tfvars 무시. 주소는 코드(cidrs.tf)에 둔다
  global/s3-backend/              ← 1단계: 도면 금고(S3+DynamoDB) 자체
    main.tf
  environments/dev/               ← 2단계: 이번 단지(dev) 소장실
    cidrs.tf                      ★ 주소만
    settings.tf                   리전·이름·태그
    main.tf                       모듈 조립 (network + security)
    versions.tf                   backend S3
    providers.tf
    outputs.tf
    README.md
  modules/network/                ← 시공팀: 실제로 VPC를 까는 로직
    main.tf                       VPC, 서브넷, IGW, NAT, RT, S3 Endpoint
    variables.tf                  입력 타입만
    outputs.tf                    모듈이 소장실에 돌려주는 ID
```

비유:

| 위치 | 비유 |
|------|------|
| `global/s3-backend` | 본사 문서고를 **먼저** 짓는다 |
| `environments/dev` | 현장 소장실. “이번 단지의 호수·간판·지시” |
| `modules/network` | 토목 시공팀. 담장·칸막이·정문·출구·안내판 |

소장이 아스팔트 까는 법을 매번 다시 적지 않는다.  
**주소는 `cidrs.tf`에만 적고**, `main.tf`에서 시공팀을 부른다.  
출입증(SG) 모듈도 같은 `main.tf`에 모아 둔다. CIDR·포트 숫자는 `main.tf`에 넣지 않는다.

---

## 3. 값이 흐르는 길

숫자를 바꿀 때 손대는 곳은 **한 군데**다.

```text
cidrs.tf / ports.tf / settings.tf
        │  주소·포트·간판 (숫자는 여기만)
        ▼
   main.tf
        │  module "network" { ... = local.xxx }
        │  module "security" { vpc_id = module.network.vpc_id, ... }
        ▼
modules/network  ·  modules/security
        ▼
environments/dev/outputs.tf
```

Terraform은 **같은 디렉터리의 `.tf`를 한 덩어리로** 읽는다.  
`cidrs.tf`의 `locals { }`와 `settings.tf`의 `locals { }`는 이름이 겹치지 않으면 **한 local 네임스페이스**가 된다.  
그래서 `main.tf`에서 `local.vpc_cidr`과 `local.name_prefix`를 같이 쓸 수 있다.

`variable`을 소장실에 두지 않은 이유: 덮어쓸 입구를 만들면 “숫자가 어디에 있나”가 다시 흐려진다.  
dev 단지의 주소는 **이 레포의 약속**이라서, 코드에 박아 두는 편이 읽기 쉽다.

---

## 4. 0단계 — 도면 금고 (`global/s3-backend`)

네트워크 apply보다 **먼저** 만든 것이다.  
현장 일지(`tfstate`)를 노트북 USB에 두지 않고, 본사 금고에 넣기 위해서다.

하는 일:

1. **S3 버킷** `coupang-eats-v2-dev-infra-tfstate-20260817`  
   - 버저닝: 잘못된 apply를 과거 버전으로 되돌릴 수 있다.  
   - AES256 암호화.  
   - 퍼블릭 액세스 전부 차단. state에는 서브넷 ID·라우트 같은 내부 지도가 들어 있다.
2. **DynamoDB** `coupang-eats-tfstate-locks`  
   - 파티션 키 `LockID` (문자열). Terraform이 요구하는 이름이다.  
   - 두 사람이 동시에 `apply` 하면 도면이 찢어진다. 자물쇠가 그걸 막는다.

이 디렉터리 자신의 state는 `global/s3/terraform.tfstate` 키에 둔다.  
**dev 네트워크** state는 같은 버킷의 **다른 서랍**이다.

```text
버킷 안 서랍
  global/s3/terraform.tfstate                 ← 금고 자체의 기록
  environments/dev/network/terraform.tfstate  ← 이번 단지 토목 기록
```

나중에 SG 레이어를 분리하면 `environments/dev/security/terraform.tfstate`처럼 서랍만 늘리면 된다.

---

## 5. 현장 소장실 — `environments/dev`

### 5.1 `versions.tf` — 공구와 금고 주소

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  backend "s3" {
    bucket         = "coupang-eats-v2-dev-infra-tfstate-20260817"
    key            = "environments/dev/network/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "coupang-eats-tfstate-locks"
    encrypt        = true
  }
}
```

- **required_version / provider:** Terraform과 AWS 플러그인 버전 하한.  
- **backend `key`:** 이 폴더에서 `apply`하면 **네트워크 레이어 서랍만** 고친다.  
- backend 블록의 `region`은 **버킷이 있는 리전**이다. VPC를 어느 도시에 지을지와는 별개지만, 지금은 둘 다 서울이다.

`terraform init`이 이 블록을 읽고 금고에 연결한다.

### 5.2 `settings.tf` — 간판·도시 (주소 아님)

```hcl
locals {
  aws_region  = "ap-northeast-2"
  name_prefix = "coupang-eats-dev"
  tags = {
    Environment = "dev"
  }
}
```

| 이름 | 쓰이는 곳 |
|------|-----------|
| `aws_region` | `providers.tf`의 AWS provider |
| `name_prefix` | 리소스 Name 태그 접두사. 콘솔에서 `coupang-eats-dev-vpc`처럼 보임 |
| `tags.Environment` | 모듈 `common_tags`에 합쳐짐 |

CIDR을 여기에 넣지 않는다. 간판과 호수는 다른 장부다.

### 5.3 `providers.tf` — 어느 도시에 시공할지

```hcl
provider "aws" {
  region = local.aws_region
}
```

값은 `settings.tf`에 있다. provider 파일에는 리전 문자열을 중복으로 적지 않는다.

### 5.4 `cidrs.tf` — 필지 호수 대장 (주소는 여기만)

IP 한 줄을 이렇게 읽는다.

```text
10.0.X.0/24
 │  │ │
 │  │ └─ 서브넷 안 자리 (호스트)
 │  └─── 3번째 옥텟 X = 구역 번호 (티어를 눈으로 구분하는 숫자)
 └────── VPC 앞자리
```

구역 번호 약속 (하드코딩):

| X | 티어 | 비유 |
|---|------|------|
| 0, 1, 2 | 퍼블릭 | 정문·로비·택배함 |
| 10, 11, 12 | 앱 프라이빗 | 매장·주방 |
| 20, 21, 22 | DB | 금고실 |

같은 파일의 실제 값:

```hcl
locals {
  vpc_cidr = "10.0.0.0/16"

  azs = {
    a = "ap-northeast-2a"
    b = "ap-northeast-2b"
    c = "ap-northeast-2c"
  }

  public_subnet_cidrs = {
    a = "10.0.0.0/24" # X = 0
    b = "10.0.1.0/24" # X = 1
    c = "10.0.2.0/24" # X = 2
  }

  private_app_subnet_cidrs = {
    a = "10.0.10.0/24" # X = 10
    b = "10.0.11.0/24" # X = 11
    c = "10.0.12.0/24" # X = 12
  }

  private_db_subnet_cidrs = {
    a = "10.0.20.0/24" # X = 20
    b = "10.0.21.0/24" # X = 21
    c = "10.0.22.0/24" # X = 22
  }
}
```

키를 `a` / `b` / `c`로 둔 이유: 서브넷, 앱 라우팅 테이블, association이 **같은 열쇠**를 쓰기 때문이다.  
리스트(`[0]`, `[1]`, `[2]`)로 두면 “0번이 a동인가”를 머리로 맞춰야 한다.

`/16`은 단지 전체(약 65,536칸). `/24`는 동 하나(256칸).  
AWS가 서브넷마다 주소 5개를 예약하므로 실제 ENI는 약 251개.

주소를 바꾸려면 **이 파일만** 고친다. 그다음 `plan`으로 서브넷 교체인지 확인한다. CIDR 변경은 서브넷 재생성에 가깝다는 점을 기억한다.

### 5.5 `main.tf` — 시공팀 호출

```hcl
module "network" {
  source = "../../modules/network"

  name_prefix              = local.name_prefix
  vpc_cidr                 = local.vpc_cidr
  azs                      = local.azs
  public_subnet_cidrs      = local.public_subnet_cidrs
  private_app_subnet_cidrs = local.private_app_subnet_cidrs
  private_db_subnet_cidrs  = local.private_db_subnet_cidrs
  tags                     = local.tags
}
```

소장의 일은 여기까지다. **무엇을** 넘기는지만 적고, **어떻게 깔지**는 모듈에 있다.  
`10.0.10.0/24` 같은 숫자는 이 파일에 다시 적지 않는다. 적으면 호수 대장이 두 장이 된다.

같은 파일에 출입증 시공팀도 부른다.

```hcl
module "security" {
  source = "../../modules/security"
  vpc_id = module.network.vpc_id
  # 포트는 ports.tf 의 local.*
}
```

주석으로 예약한 다음 공사:

```text
module "compute"  { ... }  # 경비실·에스컬레이터·매장 건물
```

### 5.6 `outputs.tf` — 인수인계 서류

모듈이 준 ID를 한 번 더 밖으로 꺼낸다. 다음 레이어가 “로비 어느 동에 Bastion을 둘지”를 이 서류로 받는다.

| output | 내용 |
|--------|------|
| `vpc_id` | 단지 ID |
| `igw_id` | 정문 |
| `public_subnet_ids` | 로비 a/b/c |
| `private_app_subnet_ids` | 주방 a/b/c |
| `private_db_subnet_ids` | 금고 a/b/c |
| `nat_gateway_id` / `nat_eip_public_ip` | 직원 출구와 밖으로 보이는 공인 IP |
| `s3_vpc_endpoint_id` | S3 지하 통로 |
| `route_table_ids` | `{ public, private_app(a/b/c), private_db }` |

확인:

```bash
cd dev_infra/environments/dev
terraform output
```

---

## 6. 시공팀 — `modules/network`

### 6.1 `variables.tf` — 입구 모양만

주소 숫자의 출처는 `cidrs.tf`다. 모듈은 이런 모양만 받는다.

- `name_prefix` : string  
- `vpc_cidr` : string  
- `azs` : **map**(키 a/b/c → AZ 이름)  
- `public_subnet_cidrs` / `private_app_subnet_cidrs` / `private_db_subnet_cidrs` : **map**  
- `tags` : map, 기본 `{}`

리스트가 아닌 맵인 이유: `for_each` 키가 `a`로 고정된다.  
`azs[0]`과 `cidrs[0]`을 인덱스로 맞추는 방식은, 한 줄만 순서가 바뀌어도 a동이 b동 AZ에 붙을 수 있다.

### 6.2 `main.tf`의 `locals` — 명패를 한 번에 찍기

```hcl
locals {
  common_tags = merge(
    {
      Project   = var.name_prefix
      ManagedBy = "terraform"
      Layer     = "network"
    },
    var.tags,
  )

  public_subnets = {
    for k, cidr in var.public_subnet_cidrs : k => {
      az   = var.azs[k]
      cidr = cidr
      name = "${var.name_prefix}-public-subnet-${k}"
    }
  }
  # private_app_subnets, private_db_subnets 도 같은 패턴
}
```

사람 손으로 서브넷 리소스를 아홉 번 복붙하지 않는다.  
키 `"a"` ↔ AZ `ap-northeast-2a` ↔ CIDR `10.0.0.0/24` ↔ Name `…-public-subnet-a` 를 묶는다.

같은 키로 앱 RT·association을 찍는다.  
헷갈리면 주방 a동이 금고 b동 안내판을 보게 된다.

`common_tags`는 단지 공통 스티커다. `Project`, `ManagedBy=terraform`, `Layer=network`, 소장이 넘긴 `Environment=dev`.

---

## 7. 리소스 시공 순서

Terraform은 코드 줄 순서가 아니라 **의존 그래프**대로 짓는다. 대체로 아래와 같다.

```text
VPC (담장)
  → IGW (정문)
  → Subnet 9개 (칸막이)
  → EIP + NAT (직원 출구)   ※ IGW가 먼저 있어야 함
  → Route Table + Association (길안내판을 벽에 붙임)
  → S3 Gateway Endpoint (지하 창고 통로를 안내판에 추가)
```

### 7.1 VPC = 담장 친 단지

```hcl
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
}
```

- 담장 밖 = 공인터넷, 담장 안 = `10.0.x.x`.  
- DNS를 켠 것은 단지 **안내데스크**(VPC 네트워크 주소 +2, Route 53 Resolver)를 두는 것.  
- **Main Route Table에는 IGW/NAT를 넣지 않는다.**  
  실수로 새 서브넷이 기본 안내판에 붙어도 인터넷이 열리지 않게, **빈 복도만** 남긴다.  
  아홉 구역은 전부 아래 커스텀 안내판에만 명시적으로 연결한다.

Name 태그: `coupang-eats-dev-vpc`.

### 7.2 IGW = 단지 정문 (하나)

```hcl
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
}
```

외부와 **양방향**으로 통하는 유일한 큰 문.  
단일 서버가 아니라 AWS가 수평 확장하는 논리적 관문이다.  
퍼블릭 서브넷만 이 문으로 직접 나간다.

### 7.3 서브넷 9개 = 구역 칸막이

세 종류, 각각 `for_each = local.*_subnets`.

| 리소스 | 구역 | `map_public_ip_on_launch` | 올리는 것 |
|--------|------|---------------------------|-----------|
| `aws_subnet.public` | 로비 a/b/c | `true` | Bastion, NAT, (나중에) ALB |
| `aws_subnet.private_app` | 주방 a/b/c | `false` | Nginx + Nest ASG |
| `aws_subnet.private_db` | 금고 a/b/c | `false` | MySQL 클러스터 |

퍼블릭만 공인 명찰을 자동으로 다는 이유: 손님이 찾아오는 문과 직원 출구가 여기 있기 때문이다.  
주방·금고 인스턴스에 공인 IP를 달면, 담장 밖에서 주소를 알고 두드릴 수 있다.

태그 `Tier = public | private-app | private-db` 는 콘솔·빌링·로그에서 구역을 걸러 보기 위한 명찰이다.

`each.key`가 `a`이면 AZ는 `local`에서 이미 `ap-northeast-2a`로 묶여 있다.

### 7.4 NAT + EIP = 나갈 때만 쓰는 직원 출구

```hcl
resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public["a"].id
  depends_on    = [aws_internet_gateway.this]
}
```

- 주방 직원은 **정문으로 손님이 들어오게 두면 안 된다.**  
- yum/apt, 외부 API, 이미지 pull은 해야 하니 **직원 출구(NAT)** 로만 나간다.  
- 나갈 때 **공인 명찰(EIP)** 로 갈아입고, 밖에선 단지 안 사번을 모른다.  
- **밖에서 먼저 두드리는 연결은 NAT가 버린다** (세션에 없는 inbound drop).

`depends_on = [IGW]`: 정문이 없는데 직원 출구를 만들 수 없다. NAT는 퍼블릭 서브넷 + IGW가 붙은 VPC에서만 산다.

**지금은 출구를 하나(로비 a)만 둔다.** 비용 때문이다.  
주방 b·c도 전부 이 출구로 나간다. a동이 멈추면 outbound가 같이 멈춘다(SPOF).  
그래서 안내판은 미리 동마다 나눠 두었다. 나중에 동마다 NAT를 늘리면 **각 앱 RT의 `0.0.0.0/0` 타겟만** 바꾸면 된다.

금고(DB) RT에는 `0.0.0.0/0`을 넣지 않는다. 금고는 이 출구를 쓰지 않는다.

### 7.5 라우팅 테이블 = 구역별 길 안내판

한 줄로: **서브넷은 칸이고, 패킷이 어디로 가는지는 안내판이 정한다.**  
AWS는 서브넷마다 안내판 하나(association)를 붙인다.

#### 퍼블릭 RT — 로비 세 곳이 같은 정문 안내

```hcl
aws_route_table.public
aws_route.public_internet          # 0.0.0.0/0 → IGW
aws_route_table_association.public # public a/b/c → 이 RT 하나
```

손님·Bastion·NAT 모두 “밖은 정문으로”라는 **같은 안내**를 봐도 된다.  
정문(IGW)은 AZ 장애에 강한 분산 서비스라, 퍼블릭은 RT를 나눠 가리킬 NAT가 없다.

#### 프라이빗 앱 RT — 주방 동마다 자기 안내판

```hcl
aws_route_table.private_app               # for_each a/b/c
aws_route.private_app_nat                 # 각 RT마다 0.0.0.0/0 → (지금은) 같은 NAT
aws_route_table_association.private_app   # a동 서브넷 ↔ a동 RT
```

핵심 제약: **한 안내판의 `0.0.0.0/0`은 타겟이 하나**다.  
동마다 다른 NAT로 보내려면 안내판이 동마다 있어야 한다.  
지금은 세 안내판이 **같은 NAT**를 가리키지만, 구조는 이미 “각자 길”이다.

association은 `aws_route_table.private_app[each.key].id`로 묶는다.  
`each.key`가 어긋나면 주방 a동이 b동 안내판을 본다.

#### DB RT — 금고는 단지 안 복도만

```hcl
aws_route_table.private_db
# 0.0.0.0 라우트 없음
aws_route_table_association.private_db  # db a/b/c → 이 RT 하나
```

금고 세 곳은 **인터넷 길 자체가 없다.**  
VPC 안(`local`)만 있다. WAS가 MySQL 포트로 들어오는 것은 나중에 보안 그룹이 막고,  
네트워크 층에서는 이미 “밖으로 나가는 도로를 안 깔아 둔” 상태다.

세 금고가 같은 안내판을 공유해도 되는 이유: 갈 곳이 NAT/IGW가 아니라 **전부 local**이라, AZ별로 다른 출구를 가리킬 일이 없다.

S3 Endpoint만 이 안내판에 나중에 한 줄 더 붙는다. 그건 인터넷이 아니라 AWS 내부 길이다.

### 7.6 S3 Gateway Endpoint = 단지→창고 지하 통로

```hcl
data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = concat(
    [aws_route_table.public.id],
    [for rt in aws_route_table.private_app : rt.id],
    [aws_route_table.private_db.id],
  )
}
```

이미지·백업·아티팩트를 S3에 둘 때, 직원 출구(NAT)로 나갔다 공인터넷을 돌면 **NAT 데이터 요금**이 붙는다.

Gateway Endpoint는 **시간당 요금이 없다.**  
각 안내판에 `pl-xxxx (S3 접두 목록) → vpce-xxxx` 가 추가된다.  
리눅스/VPC 라우터는 **더 구체적인 길(Longest Prefix Match)** 을 고르므로, S3로 가는 패킷은 `0.0.0.0/0`(NAT/IGW)보다 S3 전용 길을 탄다.

퍼블릭 RT에도 붙인 이유: 정문으로 나가도 S3에 갈 수는 있지만, **인터넷을 안 거치는 습관**이 요금·정책에 낫다.

연결하는 RT는 **5개**: 퍼블릭 1 + 주방 3 + 금고 1.  
`data.aws_region.current.region`을 쓰는 이유: 예전 속성 `id`는 deprecated다. 서울이면 `com.amazonaws.ap-northeast-2.s3`가 된다.

DynamoDB Endpoint는 안 만든다. 앱이 DynamoDB에 상시 붙지 않으니까 문을 더 안 연다.

NACL은 VPC 기본(Allow All)을 유지한다. 세밀한 출입은 다음 편 보안 그룹이 담당한다.

---

## 8. 모듈이 소장에게 돌려주는 번호

`modules/network/outputs.tf` → `environments/dev/outputs.tf`.

| 모듈 output | 다음에 쓰는 곳 |
|-------------|----------------|
| `vpc_id` | SG, Bastion, ALB 전부 “이 단지 안” |
| `public_subnet_ids["a"]` 등 | ALB, Bastion, (나중에) NAT 추가 |
| `private_app_subnet_ids` | ASG (Nginx+Nest) |
| `private_db_subnet_ids` | MySQL 클러스터 노드 |
| `nat_eip_public_ip` | 주방이 밖으로 나갈 때 보이는 공인 IP (`curl ifconfig.me`와 비교) |
| `private_app_route_table_ids` | Multi-AZ NAT 때 타겟만 교체 |
| `s3_vpc_endpoint_id` | 콘솔에서 지하 통로 확인 |

키를 `a/b/c` 맵으로 둔 것도 명패 시스템과 같다.

---

## 9. 한 장으로 보는 완성 단지

```text
[단지 VPC 10.0.0.0/16]                    서울 3개 부지 (AZ a/b/c)

  정문 IGW
       │
       ├── 로비×3  (10.0.0 / 10.0.1 / 10.0.2)
       │     안내판 1개 ──▶ 정문
       │     로비 a에 직원출구 NAT + EIP
       │
       ├── 주방×3  (10.0.10 / 10.0.11 / 10.0.12)
       │     안내판 각자 ──▶ (지금은) 같은 NAT
       │
       └── 금고×3  (10.0.20 / 10.0.21 / 10.0.22)
             안내판 1개 ──▶ 단지 안만 (밖 길 없음)

  지하통로 S3 Endpoint
       └── 로비·주방×3·금고 안내판에 공통 표기
```

숫자와 파일의 대응:

```text
10.0.0.0/16          cidrs.tf  local.vpc_cidr
10.0.10.0/24         cidrs.tf  local.private_app_subnet_cidrs["a"]
ap-northeast-2       settings.tf  local.aws_region
module.network       main.tf
aws_nat_gateway      modules/network/main.tf  (subnet = public["a"])
```

---

## 10. 코드가 일부러 안 한 것

이 모듈은 **토목**까지만 한다.

| 안 한 것 | 비유 | 다음 |
|----------|------|------|
| Security Group | 출입증 | `modules/security` |
| Bastion | 경비실 | compute |
| ALB / ASG / EC2 | 에스컬레이터·매장 건물 | compute |
| Multi-AZ NAT | 동마다 직원 출구 | 비용 여유 시 앱 RT 타겟만 교체 |
| 커스텀 NACL | 단지 외곽 차단봉 | 기본 Allow, SG가 주력 |
| DynamoDB Endpoint | 안 쓰는 창고 문 | 생략 |
| CIDR 자동 계산 | 호수를 공식으로 뽑기 | 안 함. `cidrs.tf`에 직접 적음 |
| `*.tfvars`에 주소 | 숨은 환경설정 파일 | gitignore라서 쓰지 않음 |

---

## 11. 명령과 시공의 대응

금고를 아직 안 만들었다면 **한 번만**:

```bash
cd dev_infra/global/s3-backend
terraform init
terraform apply
```

단지 토목:

```bash
cd dev_infra/environments/dev
terraform init    # 공구 설치, 금고(S3 backend) 연결
terraform plan    # 시공 전 체크리스트
terraform apply   # 시공
terraform output  # 필지 번호 인수인계
```

`plan`이 `No changes`이면 도면과 현장이 같다.  
파일을 `variables.tf`에서 `cidrs.tf`로 옮긴 뒤에도 인프라를 다시 깔 필요는 없다. 주소와 리소스 주소(AWS ID)가 같으면 Terraform은 교체를 제안하지 않는다.

---

## 12. 한 줄 요약

이 Terraform은 **쿠팡이츠 단지의 담장·9개 구역·정문·직원 출구·길안내판·S3 지하 통로**를 코드로 고정한 것이다.

- 주소는 `environments/dev/cidrs.tf`에만 있다. 3번째 옥텟 `0 / 10 / 20`이 로비·주방·금고다.  
- 간판·리전은 `settings.tf`, 조립은 `main.tf`, 시공은 `modules/network`다.  
- 주방만 안내판을 동마다 나눠, **나중에 NAT를 AZ별로 바꿀 구멍**을 남겨 두었다.  
- 금고에는 바깥길을 아예 안 깔았다.

다음 공사는 이 단지 위에 **출입증(보안 그룹)** 을 붙이는 일이다.  
→ [보안 그룹 본편](./blog-security-groups.md) · [보안 그룹 Terraform 코드](./blog-terraform-security-groups.md)
