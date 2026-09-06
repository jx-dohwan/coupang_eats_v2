# =============================================================================
# IAM — DB EC2가 S3 백업 버킷에 Put/List (Gateway Endpoint로 통신)
# =============================================================================

resource "aws_iam_role" "db" {
  name = "${var.name_prefix}-db-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "db_backup_s3" {
  name = "${var.name_prefix}-db-backup-s3"
  role = aws_iam_role.db.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.db_backup.arn,
          "${aws_s3_bucket.db_backup.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "db" {
  name = "${var.name_prefix}-db-profile"
  role = aws_iam_role.db.name
}
