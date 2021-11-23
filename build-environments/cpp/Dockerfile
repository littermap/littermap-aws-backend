#
# See:
#  - https://phoenixnap.com/kb/docker-image-size
#  - https://ownyourbits.com/2017/06/20/c-build-environment-in-a-docker-container/
#  - https://aws.amazon.com/blogs/opensource/demystifying-entrypoint-cmd-docker/
#  - https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html
#  - https://docs.aws.amazon.com/sdk-for-cpp/v1/developer-guide/cmake-params.html
#

FROM alpine:3.14.3

#
# Install the AWS SDK and lambda runtime library into /opt/aws (pull directly from github)
#

WORKDIR /download

#
# Packages:
#
#  - zip is needed for the packager to package the lambda with its libraries after it's built
#
#  - libexecinfo is necessary for backtrace support, which is missing in the `musl` C library
#    that Alpine linux ships with (and the lambda will link against)
#
#      See: https://github.com/awslabs/aws-lambda-cpp/issues/124
#
RUN apk add --progress --no-cache cmake make g++ git bash zip curl-dev zlib-dev libexecinfo-dev

RUN \
  git clone --depth 1 --recurse-submodules https://github.com/aws/aws-sdk-cpp.git && \
  cd aws-sdk-cpp && \
  mkdir build && \
  cd build && \
  cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_ONLY="s3" \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_TESTING=OFF \
    -DCUSTOM_MEMORY_MANAGEMENT=OFF \
    -DENABLE_UNITY_BUILD=ON \
    -DCMAKE_INSTALL_PREFIX=/opt/aws && \
  make && make install && \
  cd ../../ && \
  rm -rf aws-sdk-cpp

RUN \
  git clone --depth 1 https://github.com/awslabs/aws-lambda-cpp.git && \
  cd aws-lambda-cpp && \
  mkdir build && \
  cd build && \
  cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/aws && \
  make && make install && \
  cd ../../ && \
  rm -rf aws-lambda-cpp

#
# Install libvips and its required and hand-picked optional dependencies
#

RUN apk add --progress --no-cache glib-dev expat-dev libpng-dev librsvg-dev libwebp-dev

RUN \
  wget https://github.com/libvips/libvips/releases/download/v8.12.0/vips-8.12.0.tar.gz -O vips.tar.gz && \
  tar xvzf vips.tar.gz && rm -v vips.tar.gz && \
  cd vips-* && \
  ./configure && make && make install

RUN rm -rf /download

#
# Ready for building the lambda function and packaging for release
#

WORKDIR /opt/aws/lambda
