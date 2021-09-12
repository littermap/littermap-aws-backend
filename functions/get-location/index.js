//
// Get location by id:
//
// /id/5
//
// Get locations within radius of a center:
//
// /radius?lat=40.77&lon=-73.97&r=0.8
//

const postgres = require('postgres')

exports.handler = async function(event, context) {
  let s = { status: 200 }
  let query

  switch (event.resource) {
    case "/id/{id}":
      let id = event.pathParameters.id

      if (check_isPositiveInteger(s, "id", id)) {
        query = async function(pg) {
          let [location] = await pg`SELECT id,created_at,lat,lon FROM world.locations WHERE id = ${id};`

          if (!location) {
            s.status = 404
            s.res = { message: "Not found" }
          } else {
            s.res = { location }
          }
        }
      }

      break

    case "/radius":
      let { lat, lon, r } = event.queryStringParameters

      if (check_isNumeric(s, "lat", lat) &&
          check_isNumeric(s, "lon", lon) &&
          check_isNumeric(s, "r", r)) {
        query = async (pg) => {
          let locations = await pg.unsafe(`SELECT id,created_at,lat,lon FROM world.locations WHERE ST_DWithin(geo, ST_GeomFromText('POINT(${lat} ${lon})', 4326), ${r});`)
          s.res = { locations }
        }
      }
  }

  if (s.status === 200) {
    const pg = postgres()

    try {
      await query(pg)
    } catch(error) {
      s.status = 500
      s.res = { error }
    } finally {
      pg.end()
    }
  }

  return done(s)
}

function check(s, cond, message) {
  if (!cond()) {
    s.status = 422
    s.res = { error: message }
    return false
  }

  return true
}

function check_isNumeric(s, name, val) {
  return check(s, () => /^-?\d+\.?\d*$/.test(val), `${name} is expected to be numeric`)
}

function check_isPositiveInteger(s, name, val) {
  return check(s, () => /^\d+$/.test(val), `${name} is expected to be an integer`)
}

function done(s) {
  return {
    statusCode: s.status,
    body: JSON.stringify(s.res)
  }
}
