//
// Common functionality for lambda endpoints
//

function getCookie(event, name) {
  if (event.cookies) {
    for (let i = 0; i < event.cookies.length; i++) {
      let item = event.cookies[i]
      let sep = item.indexOf('=')

      if (sep !== -1 && item.substr(0, sep) === name)
        return item.substr(sep + 1)
    }
  }

  return null
}

//
// Return information in the Lambda function response payload format
//
function done({ status, headers = {}, res }, defaultCode = 200) {
  return {
    statusCode: status || defaultCode,
    headers: {
      'Content-Type': 'application/json', // Overridable default
      ...headers
    },
    body: res ? JSON.stringify(res) : ""
  }
}

module.exports = {
  getCookie,
  done
}
