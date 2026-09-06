# =============================================================================
# Launch Template + Auto Scaling Group
# =============================================================================

resource "aws_launch_template" "app" {
  name_prefix   = "${var.name_prefix}-app-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.app_instance_type
  key_name      = var.ssh_key_name

  vpc_security_group_ids = [var.app_security_group_id]

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  user_data = base64encode(templatefile("${path.module}/userdata/app.sh", {
    region           = var.aws_region
    ecr_registry     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    nginx_image      = "${aws_ecr_repository.nginx.repository_url}:latest"
    nest_image       = "${aws_ecr_repository.nest.repository_url}:latest"
    log_group_nginx  = var.enable_monitoring ? aws_cloudwatch_log_group.app_nginx[0].name : ""
    log_group_nest   = var.enable_monitoring ? aws_cloudwatch_log_group.app_nest[0].name : ""
    enable_awslogs   = var.enable_monitoring
  }))

  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, {
      Name = "${var.name_prefix}-app"
    })
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "app" {
  name                      = "${var.name_prefix}-asg-app"
  min_size                  = var.asg_min
  max_size                  = var.asg_max
  desired_capacity          = var.asg_desired
  vpc_zone_identifier       = values(var.private_app_subnet_ids)
  target_group_arns         = [aws_lb_target_group.app.arn]
  health_check_type         = "ELB"
  health_check_grace_period = 180

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.name_prefix}-app"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = var.tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}
