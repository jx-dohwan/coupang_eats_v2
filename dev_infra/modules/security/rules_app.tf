# sg-app (Nginx + Nest, 같은 EC2)
# In : 80 ← sg-alb  /  22 ← sg-bastion
#      Nest :3000 과 로컬 Router :6446 은 localhost 이라 SG에 안 연다
# Out: DB / Redis / (전용) Router 체이닝 + HTTPS/HTTP/DNS/NTP (NAT)

resource "aws_vpc_security_group_ingress_rule" "app_http_from_alb" {
  security_group_id            = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = var.http_port
  to_port                      = var.http_port
  referenced_security_group_id = aws_security_group.alb.id
  description                  = "HTTP from sg-alb only (no ALB bypass)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-in-alb-http" })
}

resource "aws_vpc_security_group_ingress_rule" "app_ssh_from_bastion" {
  security_group_id            = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
  referenced_security_group_id = aws_security_group.bastion.id
  description                  = "SSH from sg-bastion"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-in-bastion-ssh" })
}

# Router를 App 로컬에 두면 이 규칙으로 노드에 붙는다 (ENI = sg-app)
resource "aws_vpc_security_group_egress_rule" "app_to_db_mysql" {
  security_group_id            = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_port
  to_port                      = var.mysql_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "MySQL client to sg-db"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-db-mysql" })
}

resource "aws_vpc_security_group_egress_rule" "app_to_router_rw" {
  security_group_id            = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_router_rw_port
  to_port                      = var.mysql_router_rw_port
  referenced_security_group_id = aws_security_group.router.id
  description                  = "MySQL Router RW (dedicated EC2)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-router-rw" })
}

resource "aws_vpc_security_group_egress_rule" "app_to_router_ro" {
  security_group_id            = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_router_ro_port
  to_port                      = var.mysql_router_ro_port
  referenced_security_group_id = aws_security_group.router.id
  description                  = "MySQL Router RO (dedicated EC2)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-router-ro" })
}

resource "aws_vpc_security_group_egress_rule" "app_to_redis" {
  security_group_id            = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = var.redis_port
  to_port                      = var.redis_port
  referenced_security_group_id = aws_security_group.redis.id
  description                  = "Redis to sg-redis"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-redis" })
}

resource "aws_vpc_security_group_egress_rule" "app_https" {
  security_group_id = aws_security_group.app.id
  ip_protocol       = "tcp"
  from_port         = var.https_port
  to_port           = var.https_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTPS via NAT (API, npm, yum)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-https" })
}

resource "aws_vpc_security_group_egress_rule" "app_http" {
  security_group_id = aws_security_group.app.id
  ip_protocol       = "tcp"
  from_port         = var.http_port
  to_port           = var.http_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTP via NAT (package mirrors)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-http" })
}

resource "aws_vpc_security_group_egress_rule" "app_dns_udp" {
  security_group_id = aws_security_group.app.id
  ip_protocol       = "udp"
  from_port         = var.dns_port
  to_port           = var.dns_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "DNS UDP"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-dns-udp" })
}

resource "aws_vpc_security_group_egress_rule" "app_dns_tcp" {
  security_group_id = aws_security_group.app.id
  ip_protocol       = "tcp"
  from_port         = var.dns_port
  to_port           = var.dns_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "DNS TCP"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-dns-tcp" })
}

resource "aws_vpc_security_group_egress_rule" "app_ntp" {
  security_group_id = aws_security_group.app.id
  ip_protocol       = "udp"
  from_port         = var.ntp_port
  to_port           = var.ntp_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "NTP (keep TLS clocks in sync)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-app-out-ntp" })
}
