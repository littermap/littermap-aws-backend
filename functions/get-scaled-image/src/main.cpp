//
// On-the-fly image resizing
//
// When a request to the media bucket is a miss, it will redirect here with URL query:
//
//   ?object=<key>
//
// If the key is in the form:
//
//   /media/<id>/<size>
//
// this lambda function will retrieve the original image from the media bucket and serve a scaled version of it.
//
// This could also be extended to write the scaled version to the media bucket so that the bucket will serve
// it directly on a subsequent retrieval request.
//

//
// ... WORK IN PROGRESS ...
//

// Reference:
//
//   aws-cpp-sdk-s3/include/aws/s3/model/GetObjectResult.h
//   libvips/resample/thumbnail.c
//
//   https://github.com/libvips/libvips/issues/1423

// AWS SDK
#include <aws/core/Aws.h>
#include <aws/core/utils/StringUtils.h>
#include <aws/core/client/ClientConfiguration.h>
#include <aws/core/platform/Environment.h>
#include <aws/core/auth/AWSCredentialsProvider.h>
#include <aws/s3/S3Client.h>
#include <aws/s3/model/GetObjectRequest.h>
#include <aws/core/utils/HashingUtils.h>

// Vips image processing
#include <vips/vips8>

// AWS Lambda runtime
#include <aws/lambda-runtime/runtime.h>

using namespace std;
using namespace aws::lambda_runtime;

// Shared resource allocation tag
char const ALLOC_TAG[] = "LAMBDA_ALLOC";

const int MIN_THUMB_SIZE = 20;
const int MAX_THUMB_SIZE = 2560;

static invocation_response
gatewayResponse(
  int statusCode,
  Aws::String const& payload,
  Aws::String const& contentType = "application/json"
) {
  Aws::Utils::Json::JsonValue headers;
  headers.WithString("Content-Type", contentType);

  Aws::Utils::Json::JsonValue response;
  response.WithInteger("statusCode", statusCode);
  response.WithObject("headers", headers);
  response.WithString("body", payload);

  return invocation_response::success(
    response.View().WriteReadable(), "application/json"
  );
}

//
// Custom logic entry point for each Lambda invocation
//
static invocation_response
handler(
  invocation_request const& req,
  Aws::S3::S3Client const& s3
) {
  // The media bucket handle should be provided as an environment variable once deployed
  Aws::String bucketName(Aws::Environment::GetEnv("MEDIA_BUCKET"));

  Aws::Utils::Json::JsonValue requestJson(req.payload);

  // When invoked via the gateway, this should never be the case
  if (!requestJson.WasParseSuccessful()) {
    return invocation_response::failure(
      "Failed to parse request JSON", "InvalidJSON"
    );
  }

  // Unpack request data and get query parameters
  auto requestData = requestJson.View();
  auto queryData = requestData.GetObject("queryStringParameters");

  // Object may not have been specified, in which case the operation will not proceed
  if (!queryData.ValueExists("object")) {
    return gatewayResponse(
      422, "{ \"error\": \"'object' not specified\" }"
    );
  }

  // Get S3 key of the object that is to be resized
  auto objectKey = queryData.GetString("object");

Aws::Utils::Json::JsonValue debugInfo;
debugInfo.WithString("bucket", bucketName);
debugInfo.WithString("object", objectKey);

  // Parse the object key
  auto parts = Aws::Utils::StringUtils::Split(objectKey, '/');

debugInfo.WithInteger("query_parts", (int)parts.size());

// int i = 0;
// for (auto &part : parts) {
//   debugInfo.WithString("item" + to_string(i++), part);
// }

  if (parts.size() < 3 || parts[0] != "media") {
    return gatewayResponse(
      422, "{ \"error\": \"Bad query format\" }"
    );
  }

  Aws::String objectId(parts[1]);
  int thumbSize = atoi(parts[2].c_str());

  if (thumbSize < MIN_THUMB_SIZE || thumbSize > MAX_THUMB_SIZE) {
    return gatewayResponse(
      422, "{ \"error\": \"Requested thumbnail size is outside the allowed range\" }"
    );
  }

debugInfo.WithString("object_id", objectId);
debugInfo.WithInteger("requested_size", thumbSize);

  // Request object from S3 backend
  Aws::S3::Model::GetObjectRequest s3GetObjectRequest;
  s3GetObjectRequest.WithBucket(bucketName).WithKey("media/" + objectId);
  auto outcome = s3.GetObject(s3GetObjectRequest);

  // Check the outcome of making the request
  if (!outcome.IsSuccess()) {
    std::string error = outcome.GetError().GetMessage();

    return gatewayResponse(
      500, "{ \"error\": \"Failed to retrieve object from media store: " + error + "\" }"
    );
  }

  auto& result = outcome.GetResult();

  // std::basic_iostream<char> aka Aws::IOStream
  // auto& dataStream = result.GetBody();
  auto& contentType = result.GetContentType();
  auto contentSize = result.GetContentLength();

  auto& dataStream = outcome.GetResultWithOwnership().GetBody();

debugInfo.WithString("received_content_size", to_string(contentSize));
debugInfo.WithString("content_type", contentType);
debugInfo.WithString("content_disposition", result.GetContentDisposition());
debugInfo.WithString("content_encoding", result.GetContentEncoding());

  // Check if the image is svg (which can just pass through)
  if (contentType == "image/svg+xml") {
debugInfo.WithString("is_svg", "true");
debugInfo.WithString("info", "svg content should just pass through");

    // ... serve it unmodified
    return gatewayResponse(
      500, debugInfo.View().WriteReadable()
    );
  }

  if (contentType == "image/png") {
debugInfo.WithString("is_png", "true");
  }
  if (contentType == "image/jpeg") {
debugInfo.WithString("is_jpg", "true");
  }

  if (VIPS_INIT(NULL)) {
    return gatewayResponse(
      500, "{ \"error\": \"Image resizing engine did not initialize\" }"
    );
  }

  // ... image processing (under construction)

  std::stringstream stringStream;
  stringStream << dataStream.rdbuf();
  // char *buf = const_cast<char *>(stringStream.str().c_str());

debugInfo.WithString("data", stringStream.str());

  Aws::Vector<unsigned char> bits;
  bits.reserve(dataStream.tellp());
  dataStream.seekg(0, dataStream.beg);

  char streamBuffer[1024 * 4];
  while (dataStream.good()) {
    dataStream.read(streamBuffer, sizeof(streamBuffer));
    auto bytesRead = dataStream.gcount();

    if (bytesRead > 0) {
      bits.insert(bits.end(), (unsigned char*)streamBuffer, (unsigned char*)streamBuffer + bytesRead);
    }
  }
  Aws::Utils::ByteBuffer bb(bits.data(), bits.size());
  auto base64Encoded = Aws::Utils::HashingUtils::Base64Encode(bb);

debugInfo.WithString("data_base64", base64Encoded);

return gatewayResponse(
  222, debugInfo.View().WriteReadable()
);

  // Get the input data stream buffer
  // auto& dataStreamBuffer = dataStream.rdbuf();
  char *buf = const_cast<char *>(stringStream.str().c_str());

  VipsImage *thumb;

  int res = vips_thumbnail_buffer(
    buf,
    contentSize,
    &thumb,
    thumbSize, // width
    "height", thumbSize,
    "access", VIPS_ACCESS_SEQUENTIAL,
    (void *)0 // vararg terminator
  );

  if (res) {
    // ... free the image?

    return gatewayResponse(
      500, "{ \"error\": \"Image resizing error\" }"
    );
  }

  size_t outSize;

  char *out = (char *)vips_image_write_to_memory(
    thumb,
    &outSize
  );

debugInfo.WithInteger("out_size", (int)outSize);
debugInfo.WithString("out", out);

  // ...

  g_free(out);
  g_object_unref(thumb);

  vips_shutdown();

return gatewayResponse(
  500, debugInfo.View().WriteReadable()
);

  // ... serve the image content

  return gatewayResponse(
    202, "{ \"message\": \"mission accomplished\" }"
  );
}

//
// Main entry point on Lambda instantiation
//
int
main() {
  Aws::SDKOptions options;
  Aws::InitAPI(options);

  // Initialize the AWS S3 client
  Aws::Client::ClientConfiguration config;
  config.region = Aws::Environment::GetEnv("AWS_REGION");
  config.caFile = "/etc/pki/tls/certs/ca-bundle.crt";
  auto credentialsProvider = Aws::MakeShared<Aws::Auth::EnvironmentAWSCredentialsProvider>(ALLOC_TAG);
  Aws::S3::S3Client s3(credentialsProvider, config);

  // Create a handler with S3 client provided
  auto wrappedHandler = [&s3](invocation_request const& req) {
      return handler(req, s3);
  };

  run_handler(wrappedHandler);

  Aws::ShutdownAPI(options);

  return 0;
}
