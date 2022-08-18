#!/usr/bin/env bash

#
# This build script is intended to be run inside the prepared build environment inside the Docker container
#

package_name=scale-image-experimental
build_type=$1

if [ -z $build_type ]; then
  echo "Build type must be specified as an argument: Debug|Release"
  exit 1
fi

echo "Build type: $build_type"
echo

set -ex

cp -rfv /mnt/src/src/* .

# Prepare the makefile
cmake . \
  -DCMAKE_BUILD_TYPE=$build_type \
  -DCMAKE_INSTALL_PREFIX=/opt/aws

# Build the lambda
make

# Build the deployment package
make aws-lambda-package-$package_name

cp -v $package_name.zip /mnt/out
