cmake_minimum_required(VERSION 3.5)
set(CMAKE_CXX_STANDARD 11)
project(scale-image-experimental LANGUAGES CXX) # <-- package name specified here

find_package(aws-lambda-runtime)
find_package(AWSSDK COMPONENTS s3)
find_package(PkgConfig REQUIRED)
pkg_check_modules(vips REQUIRED IMPORTED_TARGET vips-cpp)

add_executable(${PROJECT_NAME} "main.cpp")

target_link_libraries(
  ${PROJECT_NAME} PRIVATE
  AWS::aws-lambda-runtime ${AWSSDK_LINK_LIBRARIES} "execinfo" PkgConfig::vips
)

target_compile_options(
  ${PROJECT_NAME} PRIVATE
  "-Wall"
  "-Wextra"
  "-Wconversion"
  "-Wshadow"
  "-Wno-sign-conversion"
)

target_compile_features(${PROJECT_NAME} PRIVATE "cxx_std_11")

aws_lambda_package_target(${PROJECT_NAME})
