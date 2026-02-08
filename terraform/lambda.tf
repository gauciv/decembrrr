# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Package Lambda code
data "archive_file" "deduction_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/.build/deduction.zip"
}

# Lambda function
resource "aws_lambda_function" "daily_deduction" {
  function_name    = "${var.project_name}-daily-deduction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 300
  memory_size      = 256
  filename         = data.archive_file.deduction_zip.output_path
  source_code_hash = data.archive_file.deduction_zip.output_base64sha256

  environment {
    variables = {
      SUPABASE_URL              = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
    }
  }
}

# EventBridge rule: 23:59 PHT (15:59 UTC), Mon–Fri
resource "aws_cloudwatch_event_rule" "daily_deduction" {
  name                = "${var.project_name}-daily-deduction"
  description         = "Trigger daily fund deduction at 23:59 PHT on weekdays"
  schedule_expression = "cron(59 15 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_target" "deduction_target" {
  rule = aws_cloudwatch_event_rule.daily_deduction.name
  arn  = aws_lambda_function.daily_deduction.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.daily_deduction.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_deduction.arn
}
