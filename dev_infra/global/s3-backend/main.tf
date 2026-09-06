
# 테라폼 초기 환경 설정 및 백엔드 원격 저장소 위치를 정의
terraform {
  backend "s3" {
    bucket         = "coupang-eats-v2-dev-infra-tfstate-20260817"
    key            = "global/s3/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "coupang-eats-tfstate-locks"
    encrypt        = true
  }
}

# AWS 공급자 설정: 테라폼이 아래 리소스들을 AWS에 생성할 수 있도록 연결
provider "aws" {
  region = "ap-northeast-2" # 인프라를 구성할 기본 리전을 '서울'로 지정함
}

# =========================================================================
# 1. Terraform State 저장을 위한 S3 버킷 생성 및 보안 설정
# =========================================================================

# 실제 상태 파일(.tfstate)을 저장할 메인 저장 공간(S3 버킷)을 생성
resource "aws_s3_bucket" "terraform_state" {
  bucket = "coupang-eats-v2-dev-infra-tfstate-20260817" # 전역적으로 고유해야 하는 S3 버킷의 고유 이름
}


# S3 버킷 버저닝(상태 파일 복구용) 설정
# 실수로 상태 파일이 지워지거나 덮어씌워졌을 때 과거 기록으로 복구할 수 있게 만듦 
resource "aws_s3_bucket_versioning" "terraform_state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id # 위에서 생성한 S3 버킷의 ID(이름)를 지정하여 연결
  versioning_configuration {
    status = "Enabled" # 버저닝(추적 및 히스토리 관리) 기능을 활성화
  }
}

# S3 버킷 서버 측 암호화 설정 (보안 강화)
# 파일이 S3에 저장되는 순간 AWS 내부에서 자동으로 암호화되도록 설정
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_crypto" {
  bucket = aws_s3_bucket.terraform_state.id # 암호화를 적용할 S3 버킷을 지정
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # 가장 대중적으로 안전한 대칭키 암호화 알고리즘인 AES256 방식을 사용
    }
  }
}

# S3 버킷 퍼블릭 엑세스 전면 차단 (인프라 기밀 유출 방지)
# 인프라 상태 정보가 인터넷에 노출되면 해킹 위험이 크므로 외부 접근을 완전히 봉쇄한다.
resource "aws_s3_bucket_public_access_block" "name" {
  bucket                  = aws_s3_bucket.terraform_state.id # 보안을 강화할 S3 버킷을 지정
  block_public_acls       = true                             # 퍼블릭 ACL(Access Control List)을 통해 파일이 외부에 공유되는 것을 방지
  block_public_policy     = true                             # 퍼블릭 버킷 정책을 통해 버킷 자체가 외부에 공개되는 것을 방지
  ignore_public_acls      = true                             # 기존에 설정되어 있던 퍼블릭 ACL이 있더라도 무시하고 차단
  restrict_public_buckets = true                             # 퍼블릭 정책이 있는 버킷에 대한 외부 사용자의 접근을 엄격히 제한
}

# =========================================================================
# 2. 상태 잠금(State Locking)을 위한 DynamoDB 테이블 생성
# =========================================================================

# 두 명 이상의 개발자가 동시에 'terraform apply'를 실행하여 상태 파일이 깨지는 것을 막는 잠금 장치
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "coupang-eats-tfstate-locks" # 테라폼 백엔드 설정에서 지정한 DynamoDB 테이블 이름과 정확히 일치시킴
  billing_mode = "PAY_PER_REQUEST"            # 고정 비용 없이 요청한 만큼만 돈을 내는 온디맨드 요금제(비용 최적화)를 선택)
  hash_key     = "LockID"                     # 테라폼이 상태를 잠글 때 탐색 기준으로 삼을 메인 키(기본키) 이름

  # 위의 hash_key롤 지정한 LockID 속성의 데이터 타입을 정의
  attribute {
    name = "LockID" # 속성의 이름은 대소문자를 구분하여 정확히 해야한다.
    type = "S"      # 데이터 타입을 문자열 타입으로 지정
  }
}
