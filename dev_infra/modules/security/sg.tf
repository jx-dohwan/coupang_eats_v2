# =============================================================================
# modules/security — 보안 그룹 껍데기만
#
# 규칙을 이 리소스 안에 넣지 않는다.
# sg-app outbound가 sg-db를 보고, sg-db inbound가 sg-app을 보면
# inline rule은 순환 참조가 된다.
# 규칙은 rules_*.tf 의 aws_vpc_security_group_*_rule 로 분리한다.
#
# Terraform이 SG를 만들면 AWS 기본 "egress all" 을 지운다.
# 그래서 egress도 rules_*.tf에 명시한다.
# =============================================================================

locals {
  common_tags = merge(
    {
      Project   = var.name_prefix
      ManagedBy = "terraform"
      Layer     = "security"
    },
    var.tags,
  )
}

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-sg-alb"
  description = "ALB. Internet 80/443 in, App 80 out"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-sg-alb"
    Role = "alb"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-sg-app"
  description = "Nginx+Nest ASG. ALB/Bastion in, DB/Redis/Router out"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-sg-app"
    Role = "app"
  })

  lifecycle {
    create_before_destroy = true
  }
}

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

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-sg-redis"
  description = "Redis. App 6379 and Bastion SSH in"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-sg-redis"
    Role = "redis"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "router" {
  name        = "${var.name_prefix}-sg-router"
  description = "MySQL Router dedicated EC2 only. Unused if Router is local on app"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-sg-router"
    Role = "router"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "bastion" {
  name        = "${var.name_prefix}-sg-bastion"
  description = "Jump host. SSH from operator CIDR, SSH out to private SGs"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-sg-bastion"
    Role = "bastion"
  })

  lifecycle {
    create_before_destroy = true
  }
}
