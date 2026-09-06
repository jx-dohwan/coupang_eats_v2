# =============================================================================
# Bastion — 경비실 (퍼블릭 서브넷 a, SSH 점프용)
# =============================================================================

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "bastion" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.bastion_instance_type
  subnet_id                   = var.public_subnet_ids["a"]
  vpc_security_group_ids      = [var.bastion_security_group_id]
  key_name                    = var.ssh_key_name
  associate_public_ip_address = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-bastion"
  })
}
