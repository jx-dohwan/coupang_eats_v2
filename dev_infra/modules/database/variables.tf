# =============================================================================
# modules/database — 입력 변수
# =============================================================================

variable "name_prefix" {
  description = "리소스 이름 접두사 (예: coupang-eats-dev)"
  type        = string
}

variable "aws_region" {
  description = "AWS 리전"
  type        = string
}

variable "private_db_subnet_ids" {
  description = "프라이빗 DB 서브넷 ID 맵 (a/b/c)"
  type        = map(string)
}

variable "db_security_group_id" {
  description = "sg-db ID"
  type        = string
}

variable "ssh_key_name" {
  description = "EC2 키 페어 이름"
  type        = string
}

variable "db_instance_type" {
  description = "DB EC2 인스턴스 타입"
  type        = string
  default     = "t3.small"
}

variable "db_data_volume_size" {
  description = "노드당 데이터 EBS 크기 (GiB)"
  type        = number
  default     = 20
}

variable "db_data_volume_type" {
  description = "데이터 EBS 타입"
  type        = string
  default     = "gp3"
}

variable "mysql_port" {
  description = "MySQL 클라이언트 포트 (창구)"
  type        = number
  default     = 13306
}

variable "mysql_gr_port" {
  description = "Group Replication 포트 (무전기)"
  type        = number
  default     = 13361
}

variable "backup_retention_days" {
  description = "S3 백업 객체 보존 일수 (이후 만료)"
  type        = number
  default     = 7
}

variable "tags" {
  description = "공통 태그"
  type        = map(string)
  default     = {}
}

variable "enable_monitoring" {
  description = "CloudWatch DB 알람 생성"
  type        = bool
  default     = true
}
