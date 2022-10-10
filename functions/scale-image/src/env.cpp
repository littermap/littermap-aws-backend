#include <aws/core/platform/Environment.h>
#include <aws/core/utils/StringUtils.h>

using Aws::Utils::StringUtils;

#include "env.h"

bool isEnvBoolSet(const char *name) {
  Aws::String val = Aws::Environment::GetEnv(name);

  if (val.empty())
    return false;

  val = StringUtils::ToLower(val.c_str());
 
  return val != "false" && val != "0";
}
