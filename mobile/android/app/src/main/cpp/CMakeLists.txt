cmake_minimum_required(VERSION 3.22.1)
project("idr_core_jni")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(IDR_CORE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../../core")

include_directories(
  "${IDR_CORE_DIR}/include"
  "${IDR_CORE_DIR}/src"
)

add_library(idr_core_jni SHARED
  idr_jni.cpp
  "${IDR_CORE_DIR}/src/engine/engine.cpp"
  "${IDR_CORE_DIR}/src/capi/idr_capi.cpp"
)

target_compile_definitions(idr_core_jni PRIVATE IDR_STATIC)

find_library(log-lib log)

target_link_libraries(idr_core_jni
  ${log-lib}
)
