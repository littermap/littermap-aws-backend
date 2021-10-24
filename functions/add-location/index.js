//
// Add a location to the global database
//
// Expects POST data in the form:
//
// {
//   "lat": 28.6,
//   "lon": -80.6,
//   "description": "Broken glass everywhere",
//   "level": 74
// }
//
// Returns the id of the newly created location.
//

const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { logEvent } = require('/opt/nodejs/lib/eventlog')
const { done } = require('/opt/nodejs/lib/endpoint')
const { pgInit } = require('/opt/nodejs/lib/postgres')

const allowAnonymousSubmit = process.env.ALLOW_ANONYMOUS_SUBMIT

exports.handler = ensureSession( async (event, context) => {
  let state = {}

  let lat, lon, description, level

  try {
    ({ lat, lon, description, level } = JSON.parse(event.body))
  } catch(e) {
    state.status = 422
    state.res = { error: "Post data must be valid JSON" }
  }

  if (!state.status) {
    if (typeof lat !== 'number' || typeof lon !== 'number' ) {
      state.status = 422
      state.res = { error: "{lat, lon} must be numbers" }
    } else if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      state.status = 422
      state.res = { error: "{lat, lon} must be realistic" }
    } else if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 100) {
      state.status = 422
      state.res = { error: "'level' is expected to be an integer in the range [1..100]" }
    }
  }

  let author

  if (!state.status) {
    if (event.session.who)
      author = event.session.who.id
    else {
      if (allowAnonymousSubmit)
        author = 'NULL'
      else {
        state.status = 403
        state.res = { error: "Please sign in to submit a location" }
      }
    }
  }

  if (!state.status) {
    const pg = pgInit()

    try {
      let [result] = await pg`
        INSERT INTO world.locations(
          created_by,
          lat,
          lon,
          geo,
          description,
          level
        )
        VALUES(
          ${author},
          ${lat},
          ${lon},
          ${pg.types.point({lat, lon})},
          ${description},
          ${level}
        )
        RETURNING
          id
      `

      state.res = { id: result.id }
    } catch(e) {
      state.status = 500
      state.res = { error: "Failed to store location in the main database", reason: e.message }
    } finally {
      pg.end()

      let who = event.session.who ? `User ${event.session.who.email}` : 'Somebody'

      if (state.res.id) {
        await logEvent({
          type: "location",
          action: "added",
          location_id: state.res.id,
          message: `${who} added a location with id ${state.res.id} and coordinates ${lat},${lon}`
        })
      } else {
        await logEvent({
          type: "location",
          action: "error",
          message: `${who} tried to add a location with coordinates ${lat},${lon}`
        })
      }
    }
  }

  state.status = state.status || 201 // "New resource created"

  return done(state)
} )
