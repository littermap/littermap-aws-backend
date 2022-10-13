//
// Log error to cloudwatch and return as an object
//
// { error: "Could not load litter pickup module", reason: "too many requests" }
//
function error(message, reason) {
  if (reason) {
    console.error(message)
    return { error: message }
  } else {
    console.error(message + ": " + reason)
    return { error: message }
  }
}

//
// Log error to cloudwatch and return as a string
//
function errorStr(message, reason) {
  if (reason)
    message += ': ' + reason

  console.error(message)

  return message
}

module.exports = {
  error,
  errorStr
}
