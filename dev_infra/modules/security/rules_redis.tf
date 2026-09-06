# sg-redis
# In : 6379 ← sg-app  /  22 ← sg-bastion
# Out: 없음. Stateful 이라 앱 응답은 자동. 인터넷 패치는 1차에서 안 염

resource "aws_vpc_security_group_ingress_rule" "redis_from_app" {
  security_group_id            = aws_security_group.redis.id
  ip_protocol                  = "tcp"
  from_port                    = var.redis_port
  to_port                      = var.redis_port
  referenced_security_group_id = aws_security_group.app.id
  description                  = "Redis from sg-app only"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-redis-in-app" })
}

resource "aws_vpc_security_group_ingress_rule" "redis_ssh_from_bastion" {
  security_group_id            = aws_security_group.redis.id
  ip_protocol                  = "tcp"
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
  referenced_security_group_id = aws_security_group.bastion.id
  description                  = "SSH from sg-bastion"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-redis-in-bastion-ssh" })
}
