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
  return {
    statusCode: status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      ...headers
    },
    body: res ? JSON.stringify(res) : ''
  }
}

module.exports = {
  baseUrl,
  basePath,
  done
}
