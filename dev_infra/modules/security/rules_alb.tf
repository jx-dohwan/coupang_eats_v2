# sg-alb
# In : 80, 443 ← 인터넷 (HTTPS는 ALB에서 종료, App은 80만)
# Out: 80 → sg-app 만 (ALB 우회 방지의 반대편: ALB도 앱만 두드린다)

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  ip_protocol       = "tcp"
  from_port         = var.http_port
  to_port           = var.http_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTP from internet (redirect to HTTPS)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-alb-in-http" })
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  ip_protocol       = "tcp"
  from_port         = var.https_port
  to_port           = var.https_port
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTPS from internet"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-alb-in-https" })
}

resource "aws_vpc_security_group_egress_rule" "alb_to_app_http" {
  security_group_id            = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = var.http_port
  to_port                      = var.http_port
  referenced_security_group_id = aws_security_group.app.id
  description                  = "Forward HTTP to sg-app (Nginx)"

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-sg-alb-out-app-http" })
}
