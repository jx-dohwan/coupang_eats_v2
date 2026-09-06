# sg-bastion
# In : 22 ← ports.tf 의 bastion_ssh_cidrs (비어 있으면 규칙 없음)
# Out: 22 → app / db / redis / router
#      HTTPS/DNS/NTP — 점프 호스트 패키지·시각

resource "aws_vpc_security_group_ingress_rule" "bastion_ssh_from_operator" {
  for_each = toset(var.bastion_ssh_cidrs)

  security_group_id = aws_security_group.bastion.id
  ip_protocol       = "tcp"
  from_port         = var.ssh_port
  to_port           = var.ssh_port
  cidr_ipv4         = each.value
  description       = "SSH from operator CIDR"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-in-ssh" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_ssh_to_app" {
  security_group_id            = aws_security_group.bastion.id
  ip_protocol                  = "tcp"
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
  referenced_security_group_id = aws_security_group.app.id
  description                  = "SSH to sg-app"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-app-ssh" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_ssh_to_db" {
  security_group_id            = aws_security_group.bastion.id
  ip_protocol                  = "tcp"
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "SSH to sg-db"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-db-ssh" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_ssh_to_redis" {
  security_group_id            = aws_security_group.bastion.id
  ip_protocol                  = "tcp"
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
  referenced_security_group_id = aws_security_group.redis.id
  description                  = "SSH to sg-redis"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-redis-ssh" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_ssh_to_router" {
  security_group_id            = aws_security_group.bastion.id
  ip_protocol                  = "tcp"
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
  referenced_security_group_id = aws_security_group.router.id
  description                  = "SSH to sg-router"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-router-ssh" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_https" {
  security_group_id = aws_security_group.bastion.id
  ip_protocol       = "tcp"
  from_port         = var.https_port
  to_port           = var.https_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTPS (yum, SSM agent)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-https" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_dns_udp" {
  security_group_id = aws_security_group.bastion.id
  ip_protocol       = "udp"
  from_port         = var.dns_port
  to_port           = var.dns_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "DNS UDP"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-dns-udp" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_dns_tcp" {
  security_group_id = aws_security_group.bastion.id
  ip_protocol       = "tcp"
  from_port         = var.dns_port
  to_port           = var.dns_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "DNS TCP"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-dns-tcp" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_ntp" {
  security_group_id = aws_security_group.bastion.id
  ip_protocol       = "udp"
  from_port         = var.ntp_port
  to_port           = var.ntp_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "NTP"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-ntp" })
}

resource "aws_vpc_security_group_egress_rule" "bastion_x_to_db" {
  count = var.enable_mysql_x_protocol ? 1 : 0

  security_group_id            = aws_security_group.bastion.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_x_port
  to_port                      = var.mysql_x_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "MySQL X Protocol to sg-db"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-bastion-out-db-x" })
}
