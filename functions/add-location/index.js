const postgres = require('postgres')
const lambda = new (require('aws-sdk/clients/lambda'))()

exports.handler = async function(event, context) {
  let status = 200, res

  let lat, lon

  try {
    ({ lat, lon } = JSON.parse(event.body))
  } catch(e) {
    status = 422
    res = { error: "Post data must be valid JSON" }
  }

  if (status === 200) {
    if (typeof lat !== 'number' || typeof lon !== 'number' ) {
      status = 422
      res = { error: "{lat, lon} must be numbers" }
    } else if(Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      status = 422
      res = { error: "{lat, lon} must be realistic" }
    } else {
      const pg = postgres()

      try {
        let [result] = await pg.unsafe(`INSERT INTO world.locations(lat,lon,geo) VALUES(${lat},${lon},ST_GeomFromText('POINT(${lat} ${lon})', 4326)) RETURNING id;`)
        res = { id: result.id }
      } catch(e) {
        status = 500
        res = { error: e.message }
      } finally {
        pg.end()

        let response = await lambda.invokeAsync({
          FunctionName: 'log-event',
          InvokeArgs: JSON.stringify({
            body: {
              event_type: "message",
              message: "Somebody added a location with id " + res.id + " and coordinates " + lat + ", " + lon
            }
          })
        }).promise()

        if (response.Status !== 202)
          res = { ...res, warning: "Could not invoke function to log this event" }
      }
    }
  }

  return {
    statusCode: status,
    body: JSON.stringify(res)
  }
}
