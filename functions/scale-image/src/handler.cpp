//
// On-demand image resizing
//
// This lambda function retrieves an original image from the media store and writes a scaled down version back to it
//
// Usage:
//
//   ?key=<id>/<size>
//
// `size` is the height of the produced thumbnail image
//
// An invocation of this lambda will:
//
//   - Download the original image from /media/<id>
//   - If the image is not SVG:
//     - A thumbnail will be generated
//     - The thumbnail image will be uploaded with the key media/<id>/<size> and tagged as temporary so that the S3
//       bucket can be configured to automatically delete it after a certain time
//   - The thumbnail image will be served as a response, unless DEBUG_MODE is set in which case the reponse will be
//     debugging information instead
//
// Image formats supported: JPG, PNG, TIFF (these produce a JPG thumbnail) and SVG (stays SVG)
//
// Reference:
//
//   https://sdk.amazonaws.com/cpp/api/LATEST/namespace_aws.html
//   http://alientechlab.com/aws-sdk-cpp-part-1/
//   https://github.com/aws/aws-sdk-cpp/issues/64
//   https://www.libvips.org/2019/12/11/What's-new-in-8.9.html#true-streaming
//   https://github.com/libvips/libvips/issues/1423
//
//   AWS SDK -> Docs/Memory_Management.md
//   aws-cpp-sdk-s3/include/aws/s3/model/GetObjectResult.h
//   aws-cpp-sdk-transfer/source/transfer/TransferManager.cpp @357
//   aws-cpp-sdk-core/include/aws/core/utils/memory/stl/AWSStreamFwd.h
//   aws-cpp-sdk-core/include/aws/core/AmazonWebServiceRequest.h
//   libvips/resample/thumbnail.c
//
// Todo:
//
//  - Serve redirect to original for svg
//
// Known issues:
//
//  - Times out if object is not found in S3 bucket
//
//    See: https://github.com/aws/aws-sdk-cpp/issues/2089
//
// Future:
//
//  - PutObjectAsync()
//
//    https://github.com/awsdocs/aws-doc-sdk-examples/blob/main/cpp/example_code/s3/put_object_async.cpp#L110
//
//  - Aws::Utils::Stream::ConcurrentStreamBuf
//
//  - vips streaming: new_from_stream() and write_to_stream()
//
//    https://github.com/libvips/libvips/pull/1443/files
//

// AWS core
#include <aws/core/Aws.h>
#include <aws/core/utils/StringUtils.h>
#include <aws/core/platform/Environment.h>
#include <aws/core/utils/stream/PreallocatedStreamBuf.h>
#include <aws/core/utils/HashingUtils.h>

namespace Json = Aws::Utils::Json;

using Aws::Utils::StringUtils;

// AWS S3
#include <aws/s3/S3Client.h>
#include <aws/s3/model/GetObjectRequest.h>
#include <aws/s3/model/PutObjectRequest.h>

// AWS Lambda runtime
#include <aws/lambda-runtime/runtime.h>

using aws::lambda_runtime::invocation_request;
using aws::lambda_runtime::invocation_response;

// Vips image processing library
#include <vips/vips8>

#include "env.h"
#include "handler.h"

//
// Proper response to the API Gateway that invoked the Lambda
//

static
invocation_response gatewayResponse(
  int statusCode,
  const Aws::String& payload,
  const Aws::String& contentType = "application/json",
  bool isBinary = false
) {
  Json::JsonValue headers;
  headers.WithString("Content-Type", contentType);

  Json::JsonValue response;
  response.WithInteger("statusCode", statusCode);
  response.WithObject("headers", headers);
  response.WithString("body", payload);

  if (isBinary)
    response.WithBool("isBase64Encoded", true);

  return invocation_response::success(
    response.View().WriteReadable(), "application/json"
  );
}

//
// Response in case of server error (500)
//

static
invocation_response serverError(const Aws::String &message) {
  LOG("returning server error: " << message);

  return gatewayResponse(
    500, "{ \"error\": \"" + message + "\" }"
  );
}

//
// Response in case of bad input (422)
//

static
invocation_response badInputError(const Aws::String &message) {
  LOG("returning bad input error: " << message);

  return gatewayResponse(
    422, "{ \"error\": \"" + message + "\" }"
  );
}

//
// Custom logic entry point for each Lambda invocation
//

invocation_response handler(
  const invocation_request &req,
  const Aws::S3::S3Client &s3
) {
  BEGIN_DEBUG_INFO;

  LOG_DEBUG_VAL(String, "build", BUILD);

  // The media bucket handle should be provided as an environment variable
  Aws::String bucketName(Aws::Environment::GetEnv("MEDIA_BUCKET"));

  // Parse request payload
  Json::JsonValue requestJson(req.payload);

  // Check if parse was successful
  if (!requestJson.WasParseSuccessful()) {
    // When properly invoked (e.g., via the API gateway), this should never be the case
    return serverError(
      "Failed to parse request JSON: " + requestJson.GetErrorMessage()
    );
  }

  // Unpack request data and get query parameters
  Json::JsonView requestData = requestJson.View();
  Json::JsonView queryData = requestData.GetObject("queryStringParameters");

  // Object may not have been specified, in which case the operation will not proceed
  if (!queryData.ValueExists("key")) {
    return badInputError("'key' not specified");
  }

  // Get S3 key of the object that is to be scaled
  Aws::String objectKey = queryData.GetString("key");

  LOG_DEBUG_VAL(String, "s3_bucket", bucketName);
  LOG_DEBUG_VAL(String, "key", objectKey);

  // Parse the object key
  Aws::Vector<Aws::String> parts = StringUtils::Split(objectKey, '/');

  LOG_DEBUG_VAL(Integer, "key_parts", (int)parts.size());

  if (parts.size() < 2) {
    return badInputError("`key` should be `<object-id>/<scaled-size>`");
  }

  Aws::String objectId(parts[0]);
  int thumbSize = atoi(parts[1].c_str());

  if (thumbSize < MIN_SCALED_SIZE || thumbSize > MAX_SCALED_SIZE) {
    return badInputError(
      Aws::String("Requested scaled image size must be in the range ")
        + std::to_string(MIN_SCALED_SIZE)
        + Aws::String(" to ")
        + std::to_string(MAX_SCALED_SIZE)
    );
  }

  LOG_DEBUG_VAL(String, "object_id", objectId);
  LOG_DEBUG_VAL(Integer, "requested_size", thumbSize);

  LOG("creating buffer to store the original image: " << IN_BUFFER_SIZE << " bytes");

  // Reserve memory for the incoming image data
  Aws::UniqueArrayPtr<unsigned char> inData = Aws::MakeUniqueArray<unsigned char>(IN_BUFFER_SIZE, "in_data");

  if (inData == nullptr) {
    LOG_DEBUG_VAL(Int64, "not_enough_memory_to_allocate", IN_BUFFER_SIZE);
    RETURN_DEBUG_INFO_IF_ENABLED;

    return serverError("Insufficient available memory to allocate incoming data buffer for original image");
  }

  // Create a stream buffer object that will fill the preallocated memory
  Aws::Utils::Stream::PreallocatedStreamBuf inStreamBuffer(inData.get(), IN_BUFFER_SIZE);

  // Define a get request for the original object in the S3 media store
  Aws::S3::Model::GetObjectRequest getRequest;
  getRequest.WithBucket(bucketName).SetKey("media/" + objectId);

  LOG("setting stream factory for get request");

  // Set the get request to create a custom stream that writes to the preallocated buffer
  getRequest.SetResponseStreamFactory(
    [&inStreamBuffer]() -> Aws::IOStream* {
      return Aws::New<Aws::IOStream>("in_stream", &inStreamBuffer);
    }
  );

  LOG("getting object from S3: " << getRequest.GetKey());

  // Perform the get request
  Aws::S3::Model::GetObjectOutcome outcome = s3.GetObject(getRequest);

// <-- BUG: never gets here if object not found in S3 bucket (if custom stream factory is set)
//
// See: https://github.com/aws/aws-sdk-cpp/issues/2089

  LOG("checking result of get operation");

  // Check the outcome of making the get request
  if (!outcome.IsSuccess()) {
    Aws::String error = outcome.GetError().GetMessage();

    LOG("get request error: " << error);

    return serverError("Failed to retrieve object from media store: " + error);
  }

  // Get the result returned from the get request
  Aws::S3::Model::GetObjectResult result = outcome.GetResultWithOwnership();

  const Aws::String& contentType = result.GetContentType();
  long long contentSize = result.GetContentLength();

  LOG_DEBUG_VAL(Int64, "received_content_size", contentSize);
  LOG_DEBUG_VAL(String, "content_type", contentType);

  bool isSvg = false;

  // Check if the image is svg (which can just pass through)
  if (contentType == "image/svg+xml") {
    LOG_DEBUG_VAL(Bool, "is_svg", true);

    isSvg = true;
  } else if (contentType == "image/png") {
    LOG_DEBUG_VAL(Bool, "is_png", true);
  } else if (contentType == "image/jpeg") {
    LOG_DEBUG_VAL(Bool, "is_jpg", true);
  }

  LOG_DEBUG_VAL(String, "input_data_address", "0x" + StringUtils::ToHexString(reinterpret_cast<uintptr_t>(inData.get())));

  unsigned char *outData; // Not used if isSvg = true because the input data is passed through unmodified
  size_t outDataSize;

  if (isSvg) {
    outDataSize = contentSize;
  } else {
    LOG("resetting vips error log");

    // Clear the vips error in case the previous invocation of the lambda wrote any messages
    vips_error_clear();

    VipsImage *scaledImage = nullptr;

    LOG("calling: vips_thumbnail_buffer()");

    //
    // vips_thumbnail_buffer()
    //
    // Docs:
    //   https://www.libvips.org/API/current/libvips-resample.html#vips-thumbnail-source
    //
    // Implementation:
    //   https://github.com/libvips/libvips/blob/d27dfbe55d9ea571ce5bf3fd4948d3804e3ebacc/libvips/resample/thumbnail.c#L1486
    //
    // Setting up an image processing pipeline (C API):
    //   https://github.com/libvips/libvips/discussions/2670#discussioncomment-2195675
    //
    // check for reference counting errors with:
    //   VIPS_LEAK=1
    //
    // To scale to height instead of width:
    //   https://github.com/libvips/libvips/issues/709
    //
    int failed = vips_thumbnail_buffer(
      (void *)inData.get(),
      contentSize,
      &scaledImage,
      VIPS_MAX_COORD, // width: pass absurd value so it scales to height instead
      "height", thumbSize,
      (void *)0 // vararg termination
    );

    if (failed) {
      LOG("vips error occurred");
      LOG(vips_error_buffer());

      if (scaledImage)
        g_object_unref(scaledImage);

      DEBUG_VAL(String, "vips_thumbnail_buffer()_failed", vips_error_buffer());
      RETURN_DEBUG_INFO_IF_ENABLED;

      return serverError("Failed to set up image scaling pipeline");
    }

    LOG("calling: vips_image_write_to_buffer()");

    //
    // vips_image_write_to_buffer()
    //
    // Doc:
    //   https://www.libvips.org/API/current/VipsImage.html#vips-image-write-to-buffer
    //
    // "Currently only TIFF, JPEG and PNG formats are supported."
    //
    // Example:
    //   https://github.com/libvips/libvips/issues/1962#issuecomment-758704430
    //
    failed = vips_image_write_to_buffer(scaledImage, ".jpg", (void **)&outData, &outDataSize, (void *)0);

    LOG_DEBUG_VAL(Int64, "out_data_size", outDataSize);
    LOG_DEBUG_VAL(String, "output_data_address", "0x" + StringUtils::ToHexString(reinterpret_cast<uintptr_t>(outData)));

    if (failed) {
      LOG("vips error occurred");
      LOG(vips_error_buffer());

      g_object_unref(scaledImage);

      DEBUG_VAL(String, "vips_image_write_to_buffer()_failed", vips_error_buffer());
      RETURN_DEBUG_INFO_IF_ENABLED;

      return serverError("Image resizing error: failed to generate scaled image");
    }

    LOG("vips object cleanup");

    g_object_unref(scaledImage);
  }

  // Create a stream buffer object to stream the output data to S3
  Aws::Utils::Stream::PreallocatedStreamBuf outStreamBuf(
    isSvg ? inData.get() : outData,
    outDataSize
  );

  //
  // Construct a request to put the thumbnailed image into the S3 media store
  //
  // PutObjectRequest reference: 
  //   https://sdk.amazonaws.com/cpp/api/LATEST/class_aws_1_1_s3_1_1_model_1_1_put_object_request.html
  //
  // ObjectCannedACL values:
  //   https://sdk.amazonaws.com/cpp/api/LATEST/aws-cpp-sdk-s3_2include_2aws_2s3_2model_2_object_canned_a_c_l_8h_source.html
  //
  // SetTagging:
  //   https://sdk.amazonaws.com/cpp/api/LATEST/class_aws_1_1_s3_1_1_model_1_1_put_object_request.html#a48f378766dfb0cfbd81606de35f8cd77
  //
  Aws::S3::Model::PutObjectRequest putRequest;
  putRequest.WithBucket(bucketName)
    .WithKey("media/" + objectId + '/' + std::to_string(thumbSize))
    .WithACL(Aws::S3::Model::ObjectCannedACL::public_read)
    .WithCacheControl("max-age=64800")
    .SetTagging("temp");

  // All thumbnails are generated in JPEG format
  putRequest.SetContentType(isSvg ? "image/svg+xml" : "image/jpeg");

  // Create an outgoing stream object with a shared pointer
  std::shared_ptr<Aws::IOStream> outStream =
    Aws::MakeShared<Aws::IOStream>(
      "outstream",
      &outStreamBuf
    );

  putRequest.SetBody(outStream);
  putRequest.SetContentLength(outDataSize);

  LOG("putting object into S3: " << putRequest.GetKey());

  Aws::S3::Model::PutObjectOutcome putOutcome = s3.PutObject(putRequest);

  LOG("checking result of put operation");

  // Check the outcome of making the put request
  if (!putOutcome.IsSuccess()) {
    std::string error = putOutcome.GetError().GetMessage();

    LOG("S3 put error: " << error);

    if (!isSvg) {
      LOG("freeing scaled image memory");
      g_free(outData);
    }

    return serverError(
      "Failed to place output object in media store: " + error
    );
  }

  //
  // The strategy at this point could be either to redirect to S3 with a request to retrieve the newly written
  // file or to just return the image directly right here.
  //
  // Data must be returned to the API gateway in base64 format in order for the API call to return binary data.
  //
  // See: https://docs.aws.amazon.com/apigateway/latest/developerguide/lambda-proxy-binary-media.html
  //

  if (!isSvg) {
    // FIXME: This involves unnecessary copying of memory
    Aws::Utils::ByteBuffer outDataCopy(outData, outDataSize);

    Aws::String base64Data = Aws::Utils::HashingUtils::Base64Encode(outDataCopy);

    DEBUG_VAL(String, "scaled_image", base64Data);

    LOG("freeing scaled image memory");
    g_free(outData);

    DEBUG_VAL(Bool, "done", true);
    RETURN_DEBUG_INFO_IF_ENABLED;

    return gatewayResponse(200, base64Data, "image/jpeg", true);
  } else {
    // Aws::String returnData = Aws::New<Aws::String>("return_data", reinterpret_cast<const char*>(inData.get()));
    Aws::String returnData(reinterpret_cast<const char*>(inData.get()), contentSize);

    DEBUG_VAL(String, "svg_image_original_as_is", returnData);
    DEBUG_VAL(Bool, "done", true);
    RETURN_DEBUG_INFO_IF_ENABLED;

    return gatewayResponse(200, returnData, "image/svg+xml");
  }
}
