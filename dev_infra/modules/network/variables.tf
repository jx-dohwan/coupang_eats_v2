# modules/network 입력
# 주소 숫자의 출처는 environments/dev/cidrs.tf 이다. 이 파일은 모양(타입)만 정한다.

variable "name_prefix" {
  description = "리소스 Name 태그 접두사"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR. 예: 10.0.0.0/16"
  type        = string
}

variable "azs" {
  description = "가용영역 맵. 키는 a/b/c, 값은 ap-northeast-2a 같은 AZ 이름"
  type        = map(string)
}

variable "public_subnet_cidrs" {
  description = "퍼블릭 서브넷 CIDR 맵 (키 a/b/c). 값은 cidrs.tf에서 옴"
  type        = map(string)
}

variable "private_app_subnet_cidrs" {
  description = "앱 프라이빗 서브넷 CIDR 맵 (키 a/b/c). 값은 cidrs.tf에서 옴"
  type        = map(string)
}

variable "private_db_subnet_cidrs" {
  description = "DB 서브넷 CIDR 맵 (키 a/b/c). 값은 cidrs.tf에서 옴"
  type        = map(string)
}

variable "tags" {
  description = "추가 공통 태그"
  type        = map(string)
  default     = {}
}
