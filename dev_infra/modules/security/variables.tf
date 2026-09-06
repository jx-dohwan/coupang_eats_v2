# modules/security 입력
# 포트 숫자의 출처는 environments/dev/ports.tf 이다. 이 파일은 모양(타입)만 정한다.

variable "name_prefix" {
  description = "리소스 Name 태그 접두사"
  type        = string
}

variable "vpc_id" {
  description = "보안 그룹을 붙일 VPC. network 모듈 vpc_id"
  type        = string
}

variable "mysql_port" {
  description = "MySQL 클라이언트 포트. 값은 ports.tf"
  type        = number
}

variable "mysql_gr_port" {
  description = "Group Replication 포트. 값은 ports.tf (자동 port×10+1 쓰지 말 것)"
  type        = number
}

variable "mysql_x_port" {
  description = "MySQL X Protocol 포트. 값은 ports.tf"
  type        = number
}

variable "enable_mysql_x_protocol" {
  description = "true면 Bastion·self → X Protocol 인바운드를 연다"
  type        = bool
}

variable "mysql_router_rw_port" {
  description = "MySQL Router Read-Write. 값은 ports.tf"
  type        = number
}

variable "mysql_router_ro_port" {
  description = "MySQL Router Read-Only. 값은 ports.tf"
  type        = number
}

variable "redis_port" {
  description = "Redis. 값은 ports.tf"
  type        = number
}

variable "http_port" {
  description = "HTTP. ALB·App Nginx. 값은 ports.tf"
  type        = number
}

variable "https_port" {
  description = "HTTPS. ALB 인바운드·App 외부 API. 값은 ports.tf"
  type        = number
}

variable "ssh_port" {
  description = "SSH. 값은 ports.tf"
  type        = number
}

variable "dns_port" {
  description = "DNS. 값은 ports.tf"
  type        = number
}

variable "ntp_port" {
  description = "NTP. 값은 ports.tf"
  type        = number
}

variable "bastion_ssh_cidrs" {
  description = "Bastion SSH 인바운드 허용 CIDR 목록. 값은 ports.tf. 빈 목록이면 인터넷→22 없음"
  type        = list(string)
}

variable "tags" {
  description = "추가 공통 태그"
  type        = map(string)
  default     = {}
}
