# =============================================================================
# Terraform / Backend 설정
# - state는 S3 + DynamoDB Lock (global/s3-backend에서 만든 버킷·테이블 사용)
# - 이 환경(dev) state 키: environments/dev/network/terraform.tfstate
#   (폴더에 network+security 모듈이 같이 들어 있다. 키 이름은 최초 레이어 기준)
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  backend "s3" {
    bucket         = "coupang-eats-v2-dev-infra-tfstate-20260817"
    key            = "environments/dev/network/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "coupang-eats-tfstate-locks"
    encrypt        = true
  }
}
