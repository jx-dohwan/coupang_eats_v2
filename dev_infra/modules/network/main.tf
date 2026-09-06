# =============================================================================
# modules/network — 3-Tier VPC 네트워크 모듈
#
# 만드는 것
#   1) VPC (/16)
#   2) 서브넷 9개: public×3, private-app×3, private-db×3 (/24, AZ a/b/c)
#   3) IGW 1개
#   4) NAT 1개 + EIP (실습 1차, public-a) — 이후 Multi-AZ NAT로 확장 가능
#   5) RT: public 1 + private-app 서브넷별 3 + db 1
#   6) S3 Gateway Endpoint (public / app×3 / db RT 연동)
#
# 안 만드는 것: SG, Bastion, ALB, EC2, DynamoDB Endpoint
# =============================================================================

locals {
  common_tags = merge(
    {
      Project   = var.name_prefix
      ManagedBy = "terraform"
      Layer     = "network"
    },
    var.tags,
  )

  # cidrs.tf 에서 받은 맵(키 a/b/c)을 서브넷 생성용으로 묶는다.
  # 주소 숫자 자체는 이 모듈이 만들지 않는다.
  public_subnets = {
    for k, cidr in var.public_subnet_cidrs : k => {
      az   = var.azs[k]
      cidr = cidr
      name = "${var.name_prefix}-public-subnet-${k}"
    }
  }

  private_app_subnets = {
    for k, cidr in var.private_app_subnet_cidrs : k => {
      az   = var.azs[k]
      cidr = cidr
      name = "${var.name_prefix}-private-app-${k}"
    }
  }

  private_db_subnets = {
    for k, cidr in var.private_db_subnet_cidrs : k => {
      az   = var.azs[k]
      cidr = cidr
      name = "${var.name_prefix}-private-db-${k}"
    }
  }
}

# -----------------------------------------------------------------------------
# 1. VPC
#    - Main Route Table에는 IGW/NAT를 넣지 않음 (실수 associate 방지)
#    - 서브넷은 아래 커스텀 RT에만 명시적으로 연결
# -----------------------------------------------------------------------------

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true # VPC DNS (.2 Resolver) 사용
  enable_dns_hostnames = true

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

# -----------------------------------------------------------------------------
# 2. Internet Gateway — 퍼블릭 서브넷의 유일한 양방향 인터넷 출입구
# -----------------------------------------------------------------------------

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-igw"
  })
}

# -----------------------------------------------------------------------------
# 3. Subnets × 9
# -----------------------------------------------------------------------------

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true # Bastion 등 퍼블릭 IP 자동 할당

  tags = merge(local.common_tags, {
    Name = each.value.name
    Tier = "public"
  })
}

resource "aws_subnet" "private_app" {
  for_each = local.private_app_subnets

  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = false

  tags = merge(local.common_tags, {
    Name = each.value.name
    Tier = "private-app"
  })
}

resource "aws_subnet" "private_db" {
  for_each = local.private_db_subnets

  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = false

  tags = merge(local.common_tags, {
    Name = each.value.name
    Tier = "private-db"
  })
}

# -----------------------------------------------------------------------------
# 4. NAT Gateway (실습 1차: 단일)
#    - public-a 에 배치, 프라이빗 앱 a/b/c RT가 모두 이 NAT를 가리킴
#    - Multi-AZ로 올릴 때: NAT를 AZ마다 만들고 각 private-app RT의 타겟만 교체
# -----------------------------------------------------------------------------

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-nat-eip"
  })

  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public["a"].id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-nat"
  })

  depends_on = [aws_internet_gateway.this]
}

# -----------------------------------------------------------------------------
# 5. Route Tables
#    - Public : 1개 공유 → IGW
#    - Private App : 서브넷(a/b/c)마다 1개 → NAT  (AZ별 NAT HA를 위한 구조)
#    - DB : 1개 공유 → local only (인터넷 기본 라우트 없음)
# -----------------------------------------------------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-rt-public"
    Tier = "public"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private_app" {
  for_each = local.private_app_subnets

  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-rt-private-app-${each.key}"
    Tier = "private-app"
    AZ   = each.value.az
  })
}

resource "aws_route" "private_app_nat" {
  for_each = aws_route_table.private_app

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this.id
}

resource "aws_route_table_association" "private_app" {
  for_each = aws_subnet.private_app

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_app[each.key].id
}

resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-rt-private-db"
    Tier = "private-db"
  })
}

resource "aws_route_table_association" "private_db" {
  for_each = aws_subnet.private_db

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_db.id
}

# -----------------------------------------------------------------------------
# 6. S3 Gateway Endpoint (요금 없음)
#    - NAT 없이 S3로 백업·아티팩트·이미지 접근
#    - DynamoDB Gateway Endpoint는 앱 범위 밖 → 생성하지 않음
# -----------------------------------------------------------------------------

data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"

  # public 1 + private-app 3 + db 1
  route_table_ids = concat(
    [aws_route_table.public.id],
    [for rt in aws_route_table.private_app : rt.id],
    [aws_route_table.private_db.id],
  )

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-vpce-s3"
  })
}

# NACL: VPC 기본(Allow All) 유지 — 세밀 제어는 Security Group 편
