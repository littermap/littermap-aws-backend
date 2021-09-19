//
// Common functionality for lambda endpoints
//

function baseUrl(event) {
  return 'https://' + event.headers.Host + '/' + event.requestContext.stage
}

function basePath(event) {
  return baseUrl(event) + event.path
}

// Format the response in the way the API gateway is designed to receive it
function done({ status, headers, res }) {
  let ret = {
    statusCode: status,
    body: res ? JSON.stringify(res) : ''
  }

  if (headers)
    ret.headers = headers

  return ret
}

module.exports = {
  baseUrl,
  basePath,
  done
}
