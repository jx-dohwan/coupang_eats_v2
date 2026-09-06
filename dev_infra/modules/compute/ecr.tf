# =============================================================================
# ECR — Nginx, Nest 이미지 저장소
# =============================================================================

resource "aws_ecr_repository" "nginx" {
  name                 = "${var.name_prefix}/nginx"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecr-nginx" })
}

resource "aws_ecr_repository" "nest" {
  name                 = "${var.name_prefix}/nest"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecr-nest" })
}

resource "aws_ecr_lifecycle_policy" "nginx" {
  repository = aws_ecr_repository.nginx.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "nest" {
  repository = aws_ecr_repository.nest.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}
