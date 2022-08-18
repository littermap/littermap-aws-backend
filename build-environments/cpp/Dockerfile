#
# Reference:
#  - https://phoenixnap.com/kb/docker-image-size
#  - https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html
#

FROM alpine:3.16.2

ENV AWS_SDK_VERSION=1.9.234
ENV AWS_SDK_COMPONENTS="s3"
ENV VIPS_VERSION=8.13.0

LABEL aws-sdk="${AWS_SDK_VERSION} ${AWS_SDK_COMPONENTS}" vips="${VIPS_VERSION}"

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
# CMake parameters:
#
# - https://github.com/aws/aws-sdk-cpp/blob/main/Docs/CMake_Parameters.md

WORKDIR /tmp/work

RUN apk add --progress --no-cache cmake make g++ git bash zip curl-dev zlib-dev libexecinfo-dev

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
    -DCUSTOM_MEMORY_MANAGEMENT=OFF \
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
# Install libvips and its required and hand-picked optional dependencies
#

RUN apk add --progress --no-cache glib-dev expat-dev libpng-dev libwebp-dev

RUN \
  wget https://github.com/libvips/libvips/releases/download/v$VIPS_VERSION/vips-$VIPS_VERSION.tar.gz -O vips.tar.gz && \
  tar xvzf vips.tar.gz && rm -v vips.tar.gz && \
  cd vips-* && \
  ./configure \
    --without-rsvg \
    --without-openslide \
    --without-nsgit \
    --without-ppm \
    --without-analyze \
    --without-radiance \
    --without-pangocairo \
    --without-fontconfig \
    --without-libexif && \
  make && make install && \
  cd ../ && \
  rm -rf vips-*
