# =============================================================================
# ports.tf  ← 보안 그룹이 여는 포트·Bastion 허용 IP는 오직 이 파일에만 적는다
#
# CIDR(서브넷 주소)은 cidrs.tf
# 단지 이름·리전은 settings.tf
#
# MySQL 클라이언트 13306 을 쓰면 GR 자동계산(×10+1)이 133061 이 되어
# TCP 포트 상한 65535 을 넘는다. GR 은 13361 로 수동 지정한다.
# =============================================================================

locals {
  mysql_port    = 13306
  mysql_gr_port = 13361 # 자동 13306×10+1=133061 금지
  mysql_x_port  = 33060 # X Protocol 공식 기본. 클러스터 관리(Shell)

  enable_mysql_x_protocol = true

  mysql_router_rw_port = 6446
  mysql_router_ro_port = 6447

  redis_port = 6379

  http_port  = 80
  https_port = 443
  ssh_port   = 22
  dns_port   = 53
  ntp_port   = 123

  # 운영자 공인 IP/32. 비우면 인터넷 → Bastion 22 규칙이 없다.
  # 예: "203.0.113.10/32"
  bastion_ssh_cidrs = ["222.238.48.113/32"]
}
