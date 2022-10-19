//
// Add a location to the global database
//
// Expects POST data in the form:
//
// {
//   "lat": 28.6,
//   "lon": -80.6,
//   "description": "Broken glass everywhere",
//   "level": 64,
//   "images" [
//     "f1d73d68af0bc0aa4d9576c5",
//     "e5e40b90f78cd4959d1808db"
//   ]
// }
//
// Returns the id of the newly created location.
//

const s3 = new (require('aws-sdk/clients/s3'))()

const { dynamo } = require('/opt/nodejs/lib/dynamo')
const h3 = require("h3-js")
const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { check_isArray, check_isHex } = require('/opt/nodejs/lib/validation')
const { logEvent } = require('/opt/nodejs/lib/interface/eventlog')
const { error, errorStr } = require('/opt/nodejs/lib/error')
const { done } = require('/opt/nodejs/lib/endpoint')


const mediaBucket = process.env.MEDIA_BUCKET
const locationsTable = process.env.LOCATIONS_TABLE
const allowAnonymousSubmit = process.env.ALLOW_ANONYMOUS_SUBMIT

exports.handler = ensureSession( async (event, context) => {
  let state = {}

  let lat, lon, description, level, images

  try {
    ({ lat, lon, description, level, images } = JSON.parse(event.body))
  } catch(e) {
    state.status = 422
    state.res = error("Post data must be valid JSON")
  }

  if (!state.status) {
    //
    // Input validation before committing data to the database
    //
    if (typeof lat !== 'number' || typeof lon !== 'number' ) {
      state.status = 422
      state.res = error("{lat, lon} must be numbers")
    } else if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      state.status = 422
      state.res = error("{lat, lon} must be realistic")
    } else if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 100) {
      state.status = 422
      state.res = error("'level' is expected to be an integer in the range [1..100]")
    } else {
      // Image keys are random 12-byte hex values
      check_isArray(state, 'images', images, "24 digit hex", check_isHex(24))
    }
  }

  //
  // TODO: Consider raising an alert if location doesn't appear to be realistic
  //

  let author

  if (!state.status) {
    if (event.session.who)
      author = event.session.who.id
    else {
      if (allowAnonymousSubmit)
        author = 'NULL'
      else {
        state.status = 403
        state.res = error("Please sign in to submit a location")
      }
    }
  }

  if (!state.status) {
    let h3index = h3.latLngToCell(lat,lon, 6)
    try {
      await dynamo.put({
        TableName: locationsTable,
        Item: {
          pk: h3index,
          sk: Math.random().toString(),
          details: {
            created_by: author,
            lat,
            lon,
            description,
            level,
            images,
          }
        },
      })
    } catch(e) {
      state.status = 500
      state.res = errorStr(`Failed to write to dynamoDB`, e.message)
    }
  }
/*

    const pg = pgInit()

    //
    // TODO: Consider checking if exact same location item already exists (to guard against duplicate submissions)
    //

    try {
      let [result] = await pg`
        INSERT INTO world.locations(
          created_by,
          lat,
          lon,
          geo,
          description,
          level,
          images
        )
        VALUES(
          ${author},
          ${lat},
          ${lon},
          ${pg.types.point({lat, lon})},
          ${description},
          ${level},
          ${pg.array(images)}::text[]
        )
        RETURNING
          id
      `

      state.res = { id: result.id }
    } catch(e) {
      state.status = 500
      state.res = error("Failed to store location in the main database", e.message)
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
*/

  if (!state.status) {
    //
    // Mark images as verified in the S3 store, so that they don't get automatically
    // deleted in accordance with the automatic deletion rule
    //
    let errors = []

    // Perform all requests simultaneously, but wait for all of them to finish
    await Promise.all(
      images.map(
        async (imageId) => {
          try {
            await s3.putObjectTagging( {
              Bucket: mediaBucket,
              Key: 'media/' + imageId,
              Tagging: {
                TagSet: [
                  {
                    Key: "verified",
                    Value: "true"
                  }
                ]
              }
            } ).promise()
          } catch(e) {
            errors.push(errorStr(`Failed to mark image ${imageId} as verified`, e.message))
          }
        }
      )
    )

    if (errors.length !== 0) {
      //
      // TODO: Consider taking action when images weren't tagged as verified
      //

      state.res.media_errors = errors
    }
  }

  return done(state, 201)
} )
