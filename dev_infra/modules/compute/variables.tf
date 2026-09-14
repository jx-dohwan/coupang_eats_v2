# =============================================================================
# modules/compute — 입력 변수
# =============================================================================

variable "name_prefix" {
  description = "리소스 이름 접두사 (예: coupang-eats-dev)"
  type        = string
}

variable "aws_region" {
  description = "AWS 리전"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "퍼블릭 서브넷 ID 맵 (a/b/c)"
  type        = map(string)
}

variable "private_app_subnet_ids" {
  description = "프라이빗 앱 서브넷 ID 맵 (a/b/c)"
  type        = map(string)
}

variable "alb_security_group_id" {
  description = "sg-alb ID"
  type        = string
}

variable "app_security_group_id" {
  description = "sg-app ID"
  type        = string
}

variable "bastion_security_group_id" {
  description = "sg-bastion ID"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM 인증서 ARN (ALB HTTPS 리스너)"
  type        = string
  default     = ""
}

variable "enable_https" {
  description = "HTTPS 리스너 활성화 여부 (true면 443+301, false면 80 forward만)"
  type        = bool
  default     = true
}

variable "zone_id" {
  description = "Route 53 호스팅 영역 ID"
  type        = string
}

variable "domain_name" {
  description = "루트 도메인 (예: hdg1234.cloud)"
  type        = string
}

variable "ssh_key_name" {
  description = "EC2 키 페어 이름"
  type        = string
}

variable "bastion_instance_type" {
  description = "Bastion 인스턴스 타입"
  type        = string
  default     = "t3.micro"
}

variable "app_instance_type" {
  description = "앱 EC2 인스턴스 타입"
  type        = string
  default     = "t3.small"
}

variable "asg_min" {
  description = "ASG 최소 인스턴스"
  type        = number
  default     = 1
}

variable "asg_max" {
  description = "ASG 최대 인스턴스"
  type        = number
  default     = 3
}

variable "asg_desired" {
  description = "ASG 희망 인스턴스"
  type        = number
  default     = 2
}

variable "tags" {
  description = "공통 태그"
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch Logs 보관 일수"
  type        = number
  default     = 7
}

variable "enable_monitoring" {
  description = "CloudWatch 로그/알람/대시보드 생성"
  type        = bool
  default     = true
}

variable "nat_gateway_id" {
  description = "NAT Gateway ID — ASG가 NAT 준비 전에 기동되지 않도록 의존성에 사용"
  type        = string
}

variable "enable_waf" {
  description = "ALB에 WAFv2 Web ACL 연결 (기본 관리형 룰 + 레이트리밋)"
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "WAF IP당 5분 요청 상한 (rate-based rule)"
  type        = number
  default     = 2000
}
