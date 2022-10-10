#!/usr/bin/env bash

#
# This build script is intended to be run inside the prepared build environment inside the Docker container
#

package_name=scale-image
build_type=$1

if [ -z $build_type ]; then
  echo "Build type must be specified as an argument: Debug|Release"
  exit 1
fi

# Generate a random build ID
build_id=$(echo $RANDOM | md5sum | head -c 12)

echo "Build type: $build_type"
echo

# Turn on command echo and strict failure mode
set -ex

cp -rfv /mnt/src/src/* .

# Prepare the makefile
cmake . \
  -DCMAKE_BUILD_TYPE=$build_type \
  -DBUILD_ID=$build_id \
  -DCMAKE_PREFIX_PATH=/opt/aws

# Build the lambda
make

# Build the deployment package
make aws-lambda-package-$package_name

# Turn off command echo
{ set +x; } 2>/dev/null

echo
cp -v $package_name.zip /mnt/out

echo
echo "Build: $build_id ($build_type) [$(uname -m)]"
