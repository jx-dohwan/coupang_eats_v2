# sg-router — MySQL Router를 별도 EC2에 둘 때만 인스턴스에 attach
# 1차 권장: Router는 App 로컬(127.0.0.1:6446). 이 SG는 만들어 두되 안 붙인다.

resource "aws_vpc_security_group_ingress_rule" "router_rw_from_app" {
  security_group_id            = aws_security_group.router.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_router_rw_port
  to_port                      = var.mysql_router_rw_port
  referenced_security_group_id = aws_security_group.app.id
  description                  = "Router RW from sg-app"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-router-in-app-rw" })
}

resource "aws_vpc_security_group_ingress_rule" "router_ro_from_app" {
  security_group_id            = aws_security_group.router.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_router_ro_port
  to_port                      = var.mysql_router_ro_port
  referenced_security_group_id = aws_security_group.app.id
  description                  = "Router RO from sg-app"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-router-in-app-ro" })
}

resource "aws_vpc_security_group_ingress_rule" "router_ssh_from_bastion" {
  security_group_id            = aws_security_group.router.id
  ip_protocol                  = "tcp"
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
  referenced_security_group_id = aws_security_group.bastion.id
  description                  = "SSH from sg-bastion"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-router-in-bastion-ssh" })
}

resource "aws_vpc_security_group_egress_rule" "router_to_db_mysql" {
  security_group_id            = aws_security_group.router.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_port
  to_port                      = var.mysql_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "MySQL client to sg-db"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-router-out-db-mysql" })
}
