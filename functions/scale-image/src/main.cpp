// AWS SDK
#include <aws/core/Aws.h>
#include <aws/core/platform/Environment.h>
#include <aws/core/client/ClientConfiguration.h>
#include <aws/core/auth/AWSCredentialsProvider.h>
#include <aws/core/utils/logging/ConsoleLogSystem.h>
#include <aws/s3/S3Client.h>

// AWS Lambda runtime
#include <aws/lambda-runtime/runtime.h>

// Vips image processing library
#include <vips/vips8>

#include "handler.h"

//
// Main entry point on Lambda instantiation (cold start)
//

int main() {
  std::cout << ":: cold starting image scaling lambda\n";

  Aws::SDKOptions options;

  //
  // Set logging level
  //
  // Levels: 0ff | Fatal | Error | Warn | Info | Debug | Trace
  //
  // See: aws-cpp-sdk-core/include/aws/core/utils/logging/LogLevel.h
  //
  // Also see this discussion: https://github.com/aws/aws-sdk-cpp/discussions/2031#discussioncomment-3479094
  //
  Aws::Utils::Logging::LogLevel logLevel = Aws::Utils::Logging::LogLevel::Off;

  //
  // Change to the console logger to see the log messages in the CloudWatch console
  //
  options.loggingOptions.logger_create_fn = [&logLevel] {
    return Aws::MakeShared<Aws::Utils::Logging::ConsoleLogSystem>("console_logger", logLevel); 
  };

  //
  // This is the master setting for the log level
  //
  // (but due to a bug in AWS SDK 1.9.339 it currently works just as a toggle switch)
  //
  options.loggingOptions.logLevel = logLevel;

  Aws::InitAPI(options);

  //
  // Initialize the AWS S3 client
  //
  Aws::Client::ClientConfiguration config;
  config.region = Aws::Environment::GetEnv("AWS_REGION");
  config.caFile = "/etc/pki/tls/certs/ca-bundle.crt";

  Aws::S3::S3Client s3(
    Aws::MakeShared<Aws::Auth::EnvironmentAWSCredentialsProvider>("creds"),
    config
  );

  if (VIPS_INIT("")) {
    std::cerr << ":: failed to initialize vips (cold start)\n";

    return 1;
  }

  std::cout << ":: running handler\n";

  aws::lambda_runtime::run_handler(
    [&s3](aws::lambda_runtime::invocation_request const &req) {
      return handler(req, s3);
    }
  );

  vips_shutdown();

  Aws::ShutdownAPI(options);

  return 0;
}
