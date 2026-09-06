# =============================================================================
# modules/dns — 입력 변수
# =============================================================================

variable "domain_name" {
  description = "루트 도메인 (예: hdg1234.cloud)"
  type        = string
}

variable "tags" {
  description = "공통 태그"
  type        = map(string)
  default     = {}
}
