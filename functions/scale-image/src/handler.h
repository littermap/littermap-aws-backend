#pragma once

#include <aws/lambda-runtime/runtime.h>

// Size constraints
const int MIN_SCALED_SIZE = 20;
const int MAX_SCALED_SIZE = 2560;

// Set the incoming buffer size here
#define IN_BUFFER_SIZE 25 * 1024 * 1024 // 25 MB

// Enable the ability to turn debug mode on
#define CAN_DEBUG

//
// Log information to the CloudWatch console
//
#define LOG(x) std::cerr << ":: " << x << std::endl

//
// If CAN_DEBUG is set at compile time and the DEBUG_OUTPUT environment variable is
// turned on at runtime, the lambda will return debugging information instead of an image
//
#ifdef CAN_DEBUG

#define BEGIN_DEBUG_INFO Json::JsonValue _debugInfo

// Add value to debug output
#define DEBUG_VAL(type, name, val) _debugInfo.With##type(name, val)

#define RETURN_DEBUG_INFO_IF_ENABLED \
  if (isEnvBoolSet("DEBUG_OUTPUT")) { \
    return gatewayResponse( \
      222, _debugInfo.View().WriteReadable() \
    ); \
  }

#else

#define BEGIN_DEBUG_INFO
#define DEBUG_VAL(type, name, val)
#define RETURN_DEBUG_INFO_IF_ENABLED

#endif // CAN_DEBUG

// Log value to CloudWatch console and also add it to the debug output (if enabled)
#define LOG_DEBUG_VAL(type, name, val) { \
  LOG(name << ": " << val); \
  DEBUG_VAL(type, name, val); \
}

aws::lambda_runtime::invocation_response handler(
  aws::lambda_runtime::invocation_request const &req,
  Aws::S3::S3Client const &s3
);
