# 밑바닥부터 다시 쌓는 3-Tier 인프라 — WEB·WAS 컴퓨트 Terraform 구현편 (최종)

[설계편](./blog-compute-web-was-design.md)에서 "무엇을 만들고, 무엇을 버리는가"를 고정했다.  
[DNS 구현편](./blog-dns-terraform-implementation.md)에서 ACM 인증서와 Route 53 검증을 Terraform으로 완성했다.

이 글은 그 설계를 **Terraform 코드로 시공한 최종 기록**이다. 리소스 한 줄마다 "왜 이렇게 짰는가"를 비유와 함께 풀어 놓는다.

> **운영 원칙:** `terraform apply`는 **비용이 발생**한다. NAT Gateway·ALB·EC2가 켜지는 순간 시간당 과금이 시작된다. 코드 작성과 `plan` 확인까지가 Terraform 작업이고, **실제 AWS 반영(apply/destroy)은 반드시 본인이 승인한 뒤**에만 실행한다.

---

## 0. 전체 흐름 — 한 장 다이어그램

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Terraform compute 모듈                                                  │
│                                                                          │
│  ① aws_ecr_repository (nginx, nest)                                     │
│     "냉동 창고(ECR) 두 칸 마련"                                          │
│            │                                                             │
│            ▼                                                             │
│  ② aws_iam_role + aws_iam_instance_profile                            │
│     "앱 EC2에게 창고 출입증 발급"                                        │
│            │                                                             │
│            ▼                                                             │
│  ③ aws_lb + aws_lb_target_group + aws_lb_listener (443/80)             │
│     "아파트 정문 에스컬레이터(ALB) + 층 안내판(TG)"                      │
│            │                                                             │
│            ▼                                                             │
│  ④ aws_launch_template + aws_autoscaling_group                          │
│     "세대 설계도(LT) + 입주민 자동 배치(ASG)"                            │
│     User Data → Docker 설치 → ECR pull → compose up                     │
│            │                                                             │
│            ▼                                                             │
│  ⑤ aws_instance (bastion)                                               │
│     "경비실 — 관리자 SSH 전용"                                           │
│            │                                                             │
│            ▼                                                             │
│  ⑥ aws_route53_record.apex (A Alias → ALB)                              │
│     "단지 입구 안내 화살표: hdg1234.cloud → ALB"                         │
│                                                                          │
│  output → alb_dns_name, ecr_*_url, bastion_public_ip                    │
└──────────────────────────────────────────────────────────────────────────┘
```

비유로 말하면:

1. **냉동 창고(ECR)** 두 칸을 짓고  
2. **입주민(EC2)에게 출입증(IAM Profile)** 을 발급하고  
3. **정문 에스컬레이터(ALB)** 를 설치한 뒤  
4. **세대(Launch Template + ASG)** 를 자동으로 채우고  
5. **경비실(Bastion)** 을 두어 관리자만 들어오게 하고  
6. **도로 표지판(Route 53 Alias)** 으로 "이 주소로 오면 정문으로" 안내한다.

---

## 1. 선행 조건 — compute보다 먼저 있어야 하는 것

| 모듈 | 역할 | compute에 넘기는 값 |
|------|------|---------------------|
| `network` | VPC, 서브넷, NAT, S3 Endpoint | `vpc_id`, `public_subnet_ids`, `private_app_subnet_ids` |
| `security` | sg-alb, sg-app, sg-bastion | 각 SG ID |
| `dns` | ACM 발급 + DNS 검증 | `acm_certificate_arn`, `zone_id` |

compute 모듈은 **dns 모듈의 ACM ARN**을 ALB 443 리스너에 꽂는다. 인증서가 없으면 HTTPS 정문을 열 수 없다. 그래서 [설계편](./blog-acm-route53-https-design.md)에서 dns를 compute보다 먼저 두었다.

---

## 2. 디렉터리 구조

```text
dev_infra/
├── environments/dev/
│   ├── settings.tf       # 리전, name_prefix, 도메인, ASG 용량, SSH 키 경로
│   ├── cidrs.tf          # VPC·서브넷 CIDR (compute는 ID만 받음)
│   ├── ports.tf          # 포트 번호 + bastion_ssh_cidrs ★ apply 전에 IP 채우기
│   ├── main.tf           # network / security / dns / compute 모듈 조립
│   └── outputs.tf        # alb_dns_name, ecr URL, bastion IP 등
│
└── modules/compute/
    ├── variables.tf      # 모듈 입력 (타입·설명만)
    ├── ecr.tf            # ECR 리포지토리 + lifecycle
    ├── iam.tf            # Instance Profile (ECR pull + SSM)
    ├── alb.tf            # ALB + Target Group + Listeners
    ├── asg.tf            # Launch Template + ASG
    ├── bastion.tf        # Bastion EC2 + Ubuntu AMI 조회
    ├── route53.tf        # apex A Alias → ALB
    ├── outputs.tf        # ALB DNS, ECR URL, Bastion IP
    └── userdata/
        └── app.sh        # EC2 부팅 시 Docker + ECR login + compose up
```

파일을 **역할별로 쪼갠 이유:** ALB만 고치고 싶을 때 `alb.tf`만 열면 된다. ECS 시절처럼 `main.tf` 한 파일에 500줄이면, 한 줄 수정할 때마다 전체를 읽어야 한다.

---

## 3. environments/dev — 모듈 조립

### 3.1 `settings.tf` — 단지 이름표

```hcl
locals {
  aws_region  = "ap-northeast-2"
  name_prefix = "coupang-eats-dev"
  domain_name = "hdg1234.cloud"

  ssh_key_name      = "coupang-eats-dev-key"
  ssh_public_key    = pathexpand("~/.ssh/coupang-eats-dev-key.pub")
  app_instance_type = "t3.small"
  asg_min           = 1
  asg_max           = 3
  asg_desired       = 2

  tags = { Environment = "dev" }
}
```

| 변수 | 역할 | 비유 |
|------|------|------|
| `name_prefix` | 모든 리소스 이름 접두사 | **단지 이름** — `coupang-eats-dev-alb`, `-asg-app` 등 |
| `ssh_public_key` | 로컬 `.pub` 파일 경로 | **열쇠 공개 부분** — AWS에는 공개키만 등록 |
| `asg_desired = 2` | 평소 가동 EC2 대수 | **입주 세대 수** — 최소 1, 최대 3, 평소 2 |

### 3.2 `ports.tf` — 경비실 출입 허용 목록

```hcl
locals {
  # ...
  bastion_ssh_cidrs = ["222.238.48.113/32"]  # 본인 공인 IP/32
}
```

| 설정 | 역할 | 비유 |
|------|------|------|
| `bastion_ssh_cidrs` | Bastion SSH(22) 허용 IP | **경비실 방문자 명단** — 빈 배열이면 22번 포트 규칙 자체가 없어 SSH 불가 |

`0.0.0.0/0`으로 열면 전 세계가 SSH를 두드릴 수 있다. **반드시 본인 공인 IP `/32`만** 넣는다.

### 3.3 SSH 키 페어 — `aws_key_pair`

```hcl
resource "aws_key_pair" "main" {
  key_name   = local.ssh_key_name
  public_key = file(local.ssh_public_key)
}
```

| 구분 | 어디에 있나 | 비유 |
|------|-------------|------|
| **개인키** (`.pem` / 키 파일) | 로컬 `~/.ssh/` | **집 열쇠** — 절대 Git·Terraform에 넣지 않음 |
| **공개키** (`.pub`) | AWS `aws_key_pair` | **아파트 도어락에 등록된 지문** |

Terraform은 공개키만 AWS에 등록한다. 개인키는 로컬에서 `ssh-keygen`으로 미리 만들어 둔다.

### 3.4 `module "compute"` 호출

```hcl
module "compute" {
  source = "../../modules/compute"

  name_prefix = local.name_prefix
  aws_region  = local.aws_region
  vpc_id      = module.network.vpc_id

  public_subnet_ids      = module.network.public_subnet_ids
  private_app_subnet_ids = module.network.private_app_subnet_ids

  alb_security_group_id     = module.security.alb_security_group_id
  app_security_group_id     = module.security.app_security_group_id
  bastion_security_group_id = module.security.bastion_security_group_id

  acm_certificate_arn = module.dns.acm_certificate_arn
  enable_https        = true
  zone_id             = module.dns.zone_id
  domain_name         = local.domain_name

  ssh_key_name      = aws_key_pair.main.key_name
  app_instance_type = local.app_instance_type
  asg_min           = local.asg_min
  asg_max           = local.asg_max
  asg_desired       = local.asg_desired

  tags = local.tags
}
```

**모듈 간 데이터 흐름:**

```text
module.network  ── vpc_id, subnet_ids ──▶ module.compute
module.security ── sg IDs ──────────────▶ module.compute
module.dns      ── acm_arn, zone_id ────▶ module.compute
aws_key_pair    ── key_name ────────────▶ module.compute
```

---

## 4. modules/compute — 파일별 상세

### 4.1 `ecr.tf` — 냉동 창고 두 칸

```hcl
resource "aws_ecr_repository" "nginx" {
  name                 = "${var.name_prefix}/nginx"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  # ...
}

resource "aws_ecr_lifecycle_policy" "nginx" {
  # 최근 5개 이미지만 유지, 나머지 자동 삭제
}
```

| 설정 | 값 | 비유 |
|------|-----|------|
| `name = coupang-eats-dev/nginx` | Nginx+프론트 dist 이미지 | **WEB 반찬 보관함** |
| `name = coupang-eats-dev/nest` | NestJS API 이미지 | **WAS 반찬 보관함** |
| `force_delete = true` | destroy 시 이미지 있어도 삭제 | **창고 철거 시 안에 뭐가 있어도 부수기** (dev 편의) |
| lifecycle "Keep last 5" | 5개 초과 이미지 자동 삭제 | **냉장고 정리** — push를 반복해도 저장비 폭발 방지 |

ECS Fargate 시절에도 ECR은 썼다. 이번에도 **이미지 저장소 역할은 동일**하고, pull 주체만 "ECS Task" → "EC2 User Data"로 바뀐다.

---

### 4.2 `iam.tf` — EC2 출입증

```hcl
resource "aws_iam_role" "app" {
  assume_role_policy = jsonencode({
    Statement = [{
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "app_ecr" {
  # ecr:GetAuthorizationToken (Resource = "*")
  # ecr:BatchGetImage, GetDownloadUrlForLayer ... (nginx, nest ARN만)
}

resource "aws_iam_instance_profile" "app" {
  role = aws_iam_role.app.name
}
```

| ECS Fargate | EC2 (이번) | 비유 |
|-------------|------------|------|
| `ecsTaskExecutionRole` | `aws_iam_instance_profile.app` | **출입증** |
| Task가 ECR pull | EC2가 ECR pull | 창고 열쇠를 **누가** 쥐느냐만 다름 |

권한은 **최소한만** 준다:
- ECR: nginx·nest 리포지토리 ARN만
- SSM: `parameter/coupang-eats-dev/*` (JWT 등, DB 연결 전에도 확장 가능)

프라이빗 서브넷 EC2가 ECR에 접속하려면 **NAT Gateway**(ECR API) + **S3 Gateway Endpoint**(이미지 레이어) 경로가 network 모듈에서 이미 열려 있어야 한다.

---

### 4.3 `alb.tf` — 정문 에스컬레이터

#### ALB 본체

```hcl
resource "aws_lb" "main" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = values(var.public_subnet_ids)
}
```

| 필드 | 값 | 비유 |
|------|-----|------|
| `internal = false` | 인터넷-facing | **아파트 정문** (안쪽 통로가 아님) |
| `subnets = values(public...)` | 퍼블릭 a/b/c | **정문을 3개 동에 걸쳐** — AZ 하나가 죽어도 정문 유지 |

#### Target Group — ECS에서 가장 많이 바뀌는 부분

```hcl
resource "aws_lb_target_group" "app" {
  name        = "${var.name_prefix}-tg-app"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  health_check {
    path     = "/health"
    matcher  = "200"
    interval = 30
  }
}
```

| 필드 | ECS(Fargate) | EC2 (이번) | 비유 |
|------|--------------|------------|------|
| `target_type` | `ip` (Task ENI) | **`instance`** | 손님을 **세대(EC2)** 에 안내 |
| `port` | 3000 (Nest 직접) | **80 (Nginx)** | 정문에서 **로비(Nginx)** 까지만 안내. 주방(Nest)은 로비 안쪽 |
| health_check `path` | `/health` | `/health` | **"영업 중" 표시등** — 200이 아니면 손님 안 보냄 |

`target_type = ip`를 그대로 두면 ASG EC2가 TG에 **등록되지 않는다.** Fargate 코드를 복붙할 때 **반드시 깨지는 지점**이다.

#### HTTPS 리스너 (443)

```hcl
resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  port            = 443
  protocol        = "HTTPS"
  ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
```

| 요소 | 역할 | 비유 |
|------|------|------|
| `certificate_arn` | dns 모듈 ACM ARN | **정문 자물쇠(명패)** |
| TLS Termination | ALB에서 HTTPS → HTTP | **정문에서 외투 벗기기** — 안쪽 EC2는 HTTP 80만 받음 |
| `ssl_policy = TLS13...` | TLS 1.3 지원 정책 | **2024년 이후 보안 기준 자물쇠** |

**`enable_https` bool을 둔 이유:**

`count = var.acm_certificate_arn != "" ? 1 : 0`처럼 **런타임 값(ACM ARN)** 으로 count를 쓰면, 첫 `plan`에서 "apply 전까지 개수를 모른다"는 Terraform 에러가 난다.  
`enable_https = true`는 **plan 시점에 이미 알 수 있는 bool**이라 count 조건으로 안전하게 쓸 수 있다.

#### HTTP 리스너 (80) — 301 리다이렉트

```hcl
resource "aws_lb_listener" "http" {
  default_action {
    type = var.enable_https ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = var.enable_https ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}
```

| 동작 | 비유 |
|------|------|
| `http://hdg1234.cloud` 접속 | **옛날 쪽문(HTTP)** 으로 들어온 손님 |
| 301 → `https://...` | **"정문으로 가세요"** 안내판 |

---

### 4.4 `asg.tf` — 세대 설계도 + 자동 입주

#### Launch Template

```hcl
resource "aws_launch_template" "app" {
  image_id      = data.aws_ami.ubuntu.id   # Ubuntu 24.04 LTS
  instance_type = var.app_instance_type      # t3.small
  key_name      = var.ssh_key_name

  vpc_security_group_ids = [var.app_security_group_id]

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  user_data = base64encode(templatefile("${path.module}/userdata/app.sh", {
    region       = var.aws_region
    ecr_registry = "${account_id}.dkr.ecr.${region}.amazonaws.com"
    nginx_image  = "${aws_ecr_repository.nginx.repository_url}:latest"
    nest_image   = "${aws_ecr_repository.nest.repository_url}:latest"
  }))

  lifecycle { create_before_destroy = true }
}
```

| ECS Fargate | EC2 Launch Template | 비유 |
|-------------|---------------------|------|
| Task Definition (CPU/메모리/이미지) | LT (instance_type, user_data) | **세대 설계도** |
| `container_definitions` | `user_data` → app.sh | **입주 시 자동으로 해 줄 일** |
| Task Role | Instance Profile | **출입증** |

`create_before_destroy = true`: LT를 수정할 때 **새 설계도를 먼저 만들고** 옛 LT를 지운다. ASG가 잠깐 설계도 없이 떠는 것을 방지.

#### Auto Scaling Group

```hcl
resource "aws_autoscaling_group" "app" {
  min_size            = var.asg_min      # 1
  max_size            = var.asg_max      # 3
  desired_capacity    = var.asg_desired  # 2
  vpc_zone_identifier = values(var.private_app_subnet_ids)
  target_group_arns   = [aws_lb_target_group.app.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 180

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }
}
```

| 필드 | 역할 | 비유 |
|------|------|------|
| `vpc_zone_identifier` | 프라이빗 앱 a/b/c | **입주 가능 동** — 외부에서 직접 접근 불가 |
| `target_group_arns` | ALB TG 자동 등록 | **새 세대가 생기면 에스컬레이터 층수표에 자동 등록** |
| `health_check_type = "ELB"` | ALB 헬스체크 기준 | EC2 자체 ping이 아니라 **"손님이 실제로 들어올 수 있나"** 로 판단 |
| `health_check_grace_period = 180` | 부팅 후 3분 유예 | **이사 첫날** — Docker pull·compose up 시간 |

ECS의 `desired_count = 2` → ASG의 `desired_capacity = 2`. **역할은 같고 이름만 다르다.**

---

### 4.5 `userdata/app.sh` — 입주 당일 자동화

```bash
#!/bin/bash
set -euo pipefail

# Ubuntu 24.04(noble)에는 apt 패키지 awscli 가 없다.
apt-get update -y
apt-get install -y docker.io docker-compose-v2 curl unzip
systemctl enable docker && systemctl start docker

# AWS CLI v2 — 공식 바이너리 (apt awscli 사용 금지)
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -qo /tmp/awscliv2.zip -d /tmp
/tmp/aws/install -i /usr/local/aws-cli -b /usr/local/bin

aws ecr get-login-password --region ${region} | \
  docker login --username AWS --password-stdin ${ecr_registry}

# docker-compose.yml 생성 후 docker compose up -d
```

**한 EC2 안에서의 통신:**

```text
[ALB] ── HTTP :80 ──▶ [nginx 컨테이너 :80]
                              │
                              │ proxy_pass http://nest:3000
                              │ (Compose 내부 DNS — 같은 EC2 안 "로컬 통화")
                              ▼
                        [nest 컨테이너 :3000]
```

| 질문 | 답 |
|------|-----|
| 왜 `http://nest:3000`인가? | Compose 서비스 이름 `nest`가 **같은 EC2 내부 DNS**로 해석됨 |
| 왜 `api.hdg1234.cloud`가 아닌가? | EC2 → NAT → 인터넷 → ALB → 다시 EC2 **헤어핀** — 비용·지연·복잡 |
| Nest 포트를 호스트에 안 여는 이유? | ALB는 Nginx :80만 두드림. Nest는 **로비 뒤 주방** |

User Data는 **인스턴스가 처음 켜질 때 1회** 실행된다. 이미지를 업데이트하려면 ECR에 새 `:latest` push 후 **인스턴스 교체**(ASG instance refresh 또는 terminate)가 필요하다.

---

### 4.6 `bastion.tf` — 경비실

```hcl
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_instance" "bastion" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.bastion_instance_type  # t3.micro
  subnet_id                   = var.public_subnet_ids["a"]
  vpc_security_group_ids      = [var.bastion_security_group_id]
  key_name                    = var.ssh_key_name
  associate_public_ip_address = true
}
```

| 설정 | 역할 | 비유 |
|------|------|------|
| 퍼블릭 서브넷 a | 공인 IP 보유 | **경비실은 길가(퍼블릭)에** |
| `bastion_ssh_cidrs`만 22 허용 | 본인 IP만 SSH | **출입 명단에 있는 사람만** |
| 앱 EC2는 프라이빗 | SSH 직접 불가 | **세대는 안쪽 동** — Bastion 경유만 |

접속 흐름:

```text
[내 PC] ── SSH ──▶ [Bastion 공인 IP] ── SSH ──▶ [앱 EC2 프라이빗 IP]
```

---

### 4.7 `route53.tf` — 입구 안내 화살표

```hcl
resource "aws_route53_record" "apex" {
  zone_id = var.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
```

| 설정 | 역할 | 비유 |
|------|------|------|
| `type = "A"` + `alias` | Apex 도메인 → ALB | **"hdg1234.cloud → 정문(ALB)으로"** |
| `evaluate_target_health = true` | ALB unhealthy면 DNS도 unhealthy | **정문 공사 중이면 안내판도 "잠시 우회"** |

루트 도메인(Apex)에는 RFC상 CNAME을 못 쓴다. Route 53 Alias가 이 제약을 우회한다. [DNS 설계편](./blog-acm-route53-https-design.md) §7 참고.

---

## 5. ECS Fargate → EC2 치환 요약표

| ECS Fargate | EC2 + ASG + Docker (이번) |
|-------------|---------------------------|
| `aws_ecs_cluster` | (없음 — ASG가 대체) |
| `aws_ecs_task_definition` | `aws_launch_template` + User Data |
| `aws_ecs_service` + `desired_count` | `aws_autoscaling_group` + `desired_capacity` |
| TG `target_type = ip`, port 3000 | TG `target_type = instance`, port 80 |
| `ecsTaskExecutionRole` (ECR pull) | `aws_iam_instance_profile` |
| ECS Service `load_balancer {}` | ASG `target_group_arns` |
| Fargate ENI in private subnet | EC2 in private subnet + NAT |

**살린 것:** ALB, ECR, ACM/HTTPS 리스너, HTTP→HTTPS 301  
**새로 만든 것:** Launch Template, ASG, Bastion, User Data, Route 53 Apex Alias  
**통째로 삭제한 것:** ECS Cluster, Task Definition, Service

---

## 6. Apply 순서와 비용 주의

### 6.1 모듈 apply 순서

```text
[수동] NS 위임 (호스팅케이알 ↔ Route 53)
   ↓
terraform apply  ← network + security + dns  (NAT·ACM)
   ↓
terraform apply  ← compute 추가              (ALB·EC2·ASG ← ★ 비용 급증)
   ↓
[수동] ECR에 nginx·nest 이미지 push
   ↓
[수동] ASG 인스턴스 헬스체크 healthy 확인
   ↓
브라우저 https://hdg1234.cloud 접속 테스트
```

### 6.2 비용이 큰 리소스 (compute apply 시)

| 리소스 | 대략 시간당 (서울) | 비유 |
|--------|-------------------|------|
| NAT Gateway | ~$0.059 | **단지 공용 배기구** — 꺼두지 않으면 24시간 과금 |
| ALB | ~$0.024 | **에스컬레이터 유지비** |
| EC2 t3.small × 2 | ~$0.045 | **세대 2호 관리비** |
| Bastion t3.micro | ~$0.011 | **경비실** |

**8시간 가동 시 대략 $1~1.5 (약 1,500~2,000원).**  
테스트 후에는 `terraform destroy`로 내리거나, ASG `desired = 0`으로 EC2만 줄이는 방법도 있다.

### 6.3 apply 전 체크리스트

- [ ] `ports.tf` → `bastion_ssh_cidrs`에 본인 공인 IP `/32`
- [ ] `~/.ssh/coupang-eats-dev-key.pub` 존재 (없으면 `ssh-keygen -t ed25519 -f ~/.ssh/coupang-eats-dev-key -N ""`)
- [ ] Route 53 NS 위임 완료 (`dig NS hdg1234.cloud` → awsdns 확인)
- [ ] S3 tfstate backend 버킷 존재 (`global/s3-backend`)
- [ ] **`terraform plan` 결과 확인 후, 본인 승인 뒤 apply**

---

## 7. Apply 이후 — Terraform 밖에서 할 일

Terraform은 **인프라 뼈대**만 만든다. 앱이 실제로 뜨려면:

### 7.1 Docker 이미지 빌드 & ECR push

```bash
# ECR URL은 terraform output으로 확인
terraform output ecr_nginx_url
terraform output ecr_nest_url

aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.ap-northeast-2.amazonaws.com

docker build -t <ecr_nginx_url>:latest ./frontend
docker push <ecr_nginx_url>:latest

docker build -t <ecr_nest_url>:latest ./backend
docker push <ecr_nest_url>:latest
```

ECR이 **비어 있으면** User Data의 `docker compose up`이 실패하고, ALB Target Group이 **unhealthy** 상태로 남는다. 이건 정상이다 — 이미지 push가 다음 단계.

### 7.2 ASG 인스턴스 갱신

이미지 push 후:
- ASG에서 인스턴스 1대 terminate → 새 인스턴스가 User Data로 최신 `:latest` pull
- 또는 AWS Console / CLI로 **Instance Refresh** 실행

### 7.3 접속 확인

```bash
curl -I http://hdg1234.cloud      # 301 → https
curl -I https://hdg1234.cloud     # 200 (Nginx)
curl https://hdg1234.cloud/health # 200
```

---

## 8. outputs — apply 후 확인할 값

| output | 용도 |
|--------|------|
| `alb_dns_name` | ALB 직접 접속 테스트 (도메인 전) |
| `bastion_public_ip` | `ssh -i ~/.ssh/coupang-eats-dev-key ubuntu@<IP>` |
| `ecr_nginx_url` / `ecr_nest_url` | docker push 대상 |
| `acm_certificate_arn` | ALB 443에 붙은 ARN 확인 |
| `ssh_key_pair_name` | AWS에 등록된 키 페어 이름 |

---

## 9. 트러블슈팅 메모

| 증상 | 원인 | 해결 |
|------|------|------|
| TG 전원 unhealthy | ECR에 이미지 없음 / `/health` 미구현 | 이미지 push, Nginx health endpoint 확인 |
| `plan`에서 HTTPS listener count 에러 | ACM ARN으로 count 사용 | `enable_https` bool 사용 (본 문서 §4.3) |
| Bastion SSH 거부 | `bastion_ssh_cidrs` 비어 있음 / IP 변경 | `ports.tf`에 현재 공인 IP `/32` |
| ECR pull 실패 (프라이빗 EC2) | NAT·IAM·SG 문제 | NAT Gateway 상태, Instance Profile, sg-app egress |
| HTTPS 리스너 apply 실패 (일시적) | AWS API DNS 일시 오류 | `terraform apply` 재실행 (멱등) |

---

## 10. 한 줄 요약

**compute 모듈**은 ECR(창고) + IAM(출입증) + ALB(정문) + ASG(자동 입주) + Bastion(경비실) + Route 53 Alias(안내판)을 Terraform으로 묶는다. ECS Fargate의 Task/Service는 Launch Template + ASG + Docker Compose User Data로 치환했고, ALB Target Group은 **`instance` + port `80`** 이 핵심 변경점이다. 코드까지 완성했어도 **apply는 비용이 붙으므로 plan 확인 후 직접 승인**하고, apply 다음에는 **ECR push**로 앱을 올린다.

---

## 관련 글

- [설계편 — WEB·WAS 컴퓨트 설계](./blog-compute-web-was-design.md)
- [DNS·ACM 설계편](./blog-acm-route53-https-design.md)
- [DNS Terraform 구현편](./blog-dns-terraform-implementation.md)
- [기획 수정 — Docker·ECR 1차 포함](./blog-planning-revision-docker-ecr.md)
- [프로젝트 서문 — ECS 없이 3-Tier](./blog-ecs-less-3tier-intro.md)
