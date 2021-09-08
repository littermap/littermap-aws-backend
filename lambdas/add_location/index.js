const postgres = require('postgres')

exports.handler = async function(event, context) {
  let { lat, lon } = JSON.parse(event.body)
  let status = 200, res

  if (typeof lat !== 'number' || typeof lon !== 'number' ) {
    status = 422
    res = { error: "{lat, lon} must be numbers" }
  } else {
    const pg = postgres()

    try {
      let [result] = await pg.unsafe(`INSERT INTO world.locations(lat,lon,geo) VALUES(${lat},${lon},ST_GeomFromText('POINT(${lat} ${lon})', 4326)) RETURNING id;`)
      res = { id: result.id }
    } catch(error) {
      status = 500
      res = { error }
    } finally {
      pg.end()
    }
  }

  return {
    statusCode: status,
    body: JSON.stringify(res)
  }
}
