//
// Common functionality for lambda endpoints
//

const { getAttributeAnyCase } = require('./misc')

function baseUrl(event) {
  return 'https://' + event.headers.Host + '/' + event.requestContext.stage
}

function getReferrer(event) {
  return getAttributeAnyCase(event.headers, 'referer')
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
  getReferrer,
  done
}
