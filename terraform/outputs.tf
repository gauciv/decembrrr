output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "s3_bucket_name" {
  description = "S3 bucket for frontend assets"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_url" {
  description = "Full frontend URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}
