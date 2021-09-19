//
// Add location to the global database
//
// Expects POST data in the form:
//
// {
//   "lat": 28.6,
//   "lon": -80.6
// }
//
// Returns the id of the newly created location.
//

const postgres = require('postgres')

const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { logEvent } = require('/opt/nodejs/lib/eventlog')

exports.handler = ensureSession( async (event, context) => {
  let status, res

  let lat, lon

  try {
    ({ lat, lon } = JSON.parse(event.body))
  } catch(e) {
    status = 422
    res = { error: "Post data must be valid JSON" }
  }

  if (!status) {
    if (typeof lat !== 'number' || typeof lon !== 'number' ) {
      status = 422
      res = { error: "{lat, lon} must be numbers" }
    } else if(Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      status = 422
      res = { error: "{lat, lon} must be realistic" }
    } else {
      // Logged in user or "anonymous" contributor
      let author = event.session.who ? "'" + event.session.who.id + "'" : 'NULL'

      const pg = postgres()

      try {
        let [result] = await pg.unsafe(
          'INSERT INTO world.locations(lat,lon,geo,created_by) ' +
          'VALUES(' +
            lat + ',' +
            lon + ',' +
            `ST_GeomFromText('POINT(${lat} ${lon})', 4326),` +
            author + ') ' +
          'RETURNING id;'
        )
        res = { id: result.id }
      } catch(e) {
        status = 500
        res = { error: "Failed to store location in the main database", reason: e.message }
      } finally {
        pg.end()

        let who = event.session.who ? `User ${event.session.who.email}` : 'Somebody'

        if (res.id) {
          await logEvent({
            type: "location",
            action: "added",
            location_id: res.id,
            message: `${who} added a location with id ${res.id} and coordinates ${lat},${lon}`
          })
        } else {
          await logEvent({
            type: "location",
            action: "error",
            message: `${who} tried to add a location  coordinates ${lat},${lon}`
          })
        }
      }
    }
  }

  status = status || 201 // "New resource created"

  return {
    statusCode: status,
    body: JSON.stringify(res)
  }
} )
