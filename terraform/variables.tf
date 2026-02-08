variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "decembrr"
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service role key (for Lambda)"
  type        = string
  sensitive   = true
}

variable "daily_amount" {
  description = "Daily deduction amount in PHP"
  type        = string
  default     = "10"
}
