# S3 bucket for frontend static assets
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAI"
      Effect    = "Allow"
      Principal = { AWS = aws_cloudfront_origin_access_identity.oai.iam_arn }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
    }]
  })
}

data "aws_caller_identity" "current" {}
