//
// Returns geolocation identified by cloudfront
//

const { done } = require('/opt/nodejs/lib/endpoint')

exports.handler = async (event, context) => {
  return done({
    res: {
      lat: parseFloat(event.headers['cloudfront-viewer-latitude']),
      lon: parseFloat(event.headers['cloudfront-viewer-longitude'])
    }
  })
}
