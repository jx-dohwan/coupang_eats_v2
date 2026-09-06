# =============================================================================
# S3 — DB 백업 창고 (cron 덤프 목적지)
# DB 서브넷은 NAT 없음 → S3 Gateway Endpoint 경로로만 업로드
# =============================================================================

resource "aws_s3_bucket" "db_backup" {
  bucket = "${var.name_prefix}-mysql-backup-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-mysql-backup"
  })
}

resource "aws_s3_bucket_versioning" "db_backup" {
  bucket = aws_s3_bucket.db_backup.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "db_backup" {
  bucket = aws_s3_bucket.db_backup.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "db_backup" {
  bucket                  = aws_s3_bucket.db_backup.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "db_backup" {
  bucket = aws_s3_bucket.db_backup.id

  rule {
    id     = "expire-old-backups"
    status = "Enabled"

    filter {
      prefix = "${local.backup_prefix}/"
    }

    expiration {
      days = var.backup_retention_days
    }
  }
}
