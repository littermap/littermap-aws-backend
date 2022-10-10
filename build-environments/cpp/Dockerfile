#
# Reference:
#  - https://phoenixnap.com/kb/docker-image-size
#  - https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html
#

FROM alpine:3.16.2

ENV AWS_SDK_VERSION="1.9.362"
ENV AWS_SDK_COMPONENTS="s3"
ENV VIPS_VERSION="8.13.0"

LABEL \
  aws-sdk="${AWS_SDK_VERSION} ${AWS_SDK_COMPONENTS}" \
  lambda-runtime="latest" \
  vips="${VIPS_VERSION}"

#
# Install the AWS SDK and lambda runtime library into /opt/aws
#
# Alpine packages:
#
#  - `zip` is needed for the AWS Lambda Runtime packager to package the lambda together with its shared libraries
#    for deployment
#
#  - `libexecinfo-dev` is necessary for backtrace support, which is missing in the `musl` C library
#    that Alpine linux ships with (and the lambda will link against)
#
#    See: https://github.com/awslabs/aws-lambda-cpp/issues/124
#
#  - `openssl-libs-static` seems unnecessary, but currently the AWS SDK won't let the project build unless the
#    static objects are installed
#
#    See: https://github.com/aws/aws-sdk-cpp/issues/1910
#
# CMake parameters:
#
# - https://github.com/aws/aws-sdk-cpp/blob/main/Docs/CMake_Parameters.md

WORKDIR /tmp/work

RUN apk add --progress --no-cache cmake make g++ git bash zip curl-dev zlib-dev libexecinfo-dev openssl-libs-static

#
# Install the AWS C++ SDK
#

RUN \
  git clone --branch $AWS_SDK_VERSION --depth 1 --recurse-submodules https://github.com/aws/aws-sdk-cpp.git && \
  cd aws-sdk-cpp && \
  mkdir build && cd build && \
  cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_ONLY=$AWS_SDK_COMPONENTS \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_TESTING=OFF \
    -DCMAKE_INSTALL_PREFIX=/opt/aws && \
  make && make install && \
  cd ../../ && \
  rm -rf aws-sdk-cpp

#
# Install the AWS Lambda Runtime C++ library
#

RUN \
  git clone --depth 1 https://github.com/awslabs/aws-lambda-cpp.git && \
  cd aws-lambda-cpp && \
  mkdir build && cd build && \
  cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/opt/aws && \
  make && make install && \
  cd ../../ && \
  rm -rf aws-lambda-cpp

#
# Install libvips and its required and carefully selected optional dependencies
#

RUN apk add --progress --no-cache glib-dev expat-dev libspng-dev libwebp-dev jpeg-dev

# NOTE: After 8.13.0, libvips is moving its build system entirely from autogen to meson
#
RUN \
  wget https://github.com/libvips/libvips/releases/download/v$VIPS_VERSION/vips-$VIPS_VERSION.tar.gz -O vips.tar.gz && \
  tar xvzf vips.tar.gz && rm -v vips.tar.gz && \
  cd vips-* && \
  ./configure \
    --with-jpeg \
    --without-rsvg \
    --without-openslide \
    --without-nsgif \
    --without-ppm \
    --without-analyze \
    --without-radiance \
    --without-pangocairo \
    --without-fontconfig \
    --without-libexif \
    && \
  make && make install && \
  cd ../ && \
  rm -rf vips-*
