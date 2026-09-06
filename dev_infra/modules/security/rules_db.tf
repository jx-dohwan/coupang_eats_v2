# sg-db (MySQL InnoDB Cluster 노드 3대)
# In : mysql ← sg-app, sg-router, self
#      GR   ← self  (클러스터 필수. 자동 port×10+1 금지)
#      SSH  ← sg-bastion
#      X    ← sg-bastion, self (선택)
# Out: self mysql/GR 만. 인터넷 egress 없음 (DB RT도 local only)

resource "aws_vpc_security_group_ingress_rule" "db_mysql_from_app" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_port
  to_port                      = var.mysql_port
  referenced_security_group_id = aws_security_group.app.id
  description                  = "MySQL client from sg-app (includes local Router)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-in-app-mysql" })
}

resource "aws_vpc_security_group_ingress_rule" "db_mysql_from_router" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_port
  to_port                      = var.mysql_port
  referenced_security_group_id = aws_security_group.router.id
  description                  = "MySQL client from sg-router (dedicated EC2)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-in-router-mysql" })
}

resource "aws_vpc_security_group_ingress_rule" "db_mysql_self" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_port
  to_port                      = var.mysql_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "MySQL client between cluster nodes"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-in-self-mysql" })
}

resource "aws_vpc_security_group_ingress_rule" "db_gr_self" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_gr_port
  to_port                      = var.mysql_gr_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "Group Replication self (Paxos/XCom)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-in-self-gr" })
}

resource "aws_vpc_security_group_ingress_rule" "db_ssh_from_bastion" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
  referenced_security_group_id = aws_security_group.bastion.id
  description                  = "SSH from sg-bastion"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-in-bastion-ssh" })
}

resource "aws_vpc_security_group_ingress_rule" "db_x_from_bastion" {
  count = var.enable_mysql_x_protocol ? 1 : 0

  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_x_port
  to_port                      = var.mysql_x_port
  referenced_security_group_id = aws_security_group.bastion.id
  description                  = "MySQL X Protocol from sg-bastion"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-in-bastion-x" })
}

resource "aws_vpc_security_group_ingress_rule" "db_x_self" {
  count = var.enable_mysql_x_protocol ? 1 : 0

  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_x_port
  to_port                      = var.mysql_x_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "MySQL X Protocol between cluster nodes"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-in-self-x" })
}

# GR은 양방향 개시. ingress self 만으로는 부족하고 egress self 가 필요하다.
resource "aws_vpc_security_group_egress_rule" "db_mysql_self" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_port
  to_port                      = var.mysql_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "MySQL client to peer nodes"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-out-self-mysql" })
}

resource "aws_vpc_security_group_egress_rule" "db_gr_self" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_gr_port
  to_port                      = var.mysql_gr_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "Group Replication to peer nodes"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-out-self-gr" })
}

resource "aws_vpc_security_group_egress_rule" "db_x_self" {
  count = var.enable_mysql_x_protocol ? 1 : 0

  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = var.mysql_x_port
  to_port                      = var.mysql_x_port
  referenced_security_group_id = aws_security_group.db.id
  description                  = "MySQL X Protocol to peer nodes"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-db-out-self-x" })
}
