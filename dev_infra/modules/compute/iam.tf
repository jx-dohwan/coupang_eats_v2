# =============================================================================
# IAM — 앱 EC2 Instance Profile (ECR pull + SSM 읽기)
# =============================================================================

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "app" {
  name = "${var.name_prefix}-app-role"

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

resource "aws_iam_role_policy" "app_ecr" {
  name = "${var.name_prefix}-app-ecr"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability"
        ]
        Resource = [
          aws_ecr_repository.nginx.arn,
          aws_ecr_repository.nest.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "app_ssm" {
  name = "${var.name_prefix}-app-ssm"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters"]
      Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.name_prefix}/*"
    }]
  })
}

# Docker awslogs 드라이버 → CloudWatch Logs 전송
resource "aws_iam_role_policy" "app_cloudwatch_logs" {
  name = "${var.name_prefix}-app-cw-logs"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/${var.name_prefix}/app/*",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/${var.name_prefix}/app/*:log-stream:*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.name_prefix}-app-profile"
  role = aws_iam_role.app.name
}
