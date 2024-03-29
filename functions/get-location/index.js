//
// Get location by id:
//
// /id/5
//
// Get locations within radius of a center as a GeoJSON collection:
//
// /radius?lat=40.77&lon=-73.97&r=0.8?format=geojson
//

const { getUserInfo, getUserInfoBatch } = require('/opt/nodejs/lib/interface/users')
const { check_isNumeric, check_isPositiveInteger } = require('/opt/nodejs/lib/validation')
const { md5 } = require('/opt/nodejs/lib/crypto')
const { ageComment } = require('/opt/nodejs/lib/time')
const { pgInit } = require('/opt/nodejs/lib/postgres')
const { error } = require('/opt/nodejs/lib/error')
const { done } = require('/opt/nodejs/lib/endpoint')

exports.handler = async function(event, context) {
  let state = {}, query

  switch (event.routeKey) {
    case "GET /id/{id}":
      let { id } = event.pathParameters

      if (check_isPositiveInteger(state, "id", id)) {
        query = async function(pg) {
          let [location] = await pg`
            SELECT
              id,
              created_at,
              created_by,
              lat,
              lon,
              description,
              level,
              images
            FROM world.locations
            WHERE
              id = ${id}
          `

          if (!location) {
            state.status = 404
            state.res = { message: "Not found" }
          } else {
            state.res = {
              location:
                await fetchAuthorDetails(
                  normalizeLocation(location)
                )
            }
          }
        }
      }

      break

    case "GET /radius":
      let { lat, lon, r, format } = event.queryStringParameters

      if (check_isNumeric(state, "lat", lat) &&
          check_isNumeric(state, "lon", lon) &&
          check_isNumeric(state, "r", r)) {
        query = async (pg) => {
          let locations = await pg`
            SELECT
              id,
              created_at,
              created_by,
              lat,
              lon,
              description,
              level,
              images
            FROM world.locations
            WHERE
              ST_DWithin(geo, ${pg.types.point({lat, lon})}, ${r})
          `

          for (let i = 0; i < locations.length; i++)
            normalizeLocation(locations[i])

          let authorIds = []

          // Create a list of unique author ids from the set of locations
          for (let i = 0; i < locations.length; i++) {
            let author = locations[i].created_by

            if (authorIds.indexOf(author) === -1)
              authorIds.push(author)
          }

          // Fetch user details for each unique location author (in a batch request)
          let authorsResults = await getUserInfoBatch(authorIds)

          if (Array.isArray(authorsResults)) {
            // Replace author reference with full user details
            for (let i = 0; i < locations.length; i++) {
              let loc = locations[i]

              // Returned results are not always in the same order as the request
              loc.created_by = authorsResults.find(
                (author) => author.id === loc.created_by
              )
            }
          } else {
            // Error fetching, make it clear that author information is missing
            for (let i = 0; i < locations.length; i++)
              locations[i].created_by = null
          }

          if (format === "geojson") {
            //
            // Support for GeoJSON feature collection format
            //
            let featureCollection = {
              type: "FeatureCollection",
              features: locations.map(locationAsGeoJSONFeature)
            }

            state.res = featureCollection
          } else {
            state.res = { locations }
          }
        }
      }
  }

  if (!state.status) {
    const pg = pgInit()

    try {
      await query(pg)
    } catch(e) {
      state.status = 500
      state.res = error("Failed to retrieve location(s)", e.message)
    } finally {
      pg.end()
    }
  }

  return done(state)
}

function normalizeLocation(location) {
  //
  // The database returns empty values as "NULL", which are here translated into the native null
  //
  if (location.created_by === "NULL")
    location.created_by = null

  // Add age comment alongside the creation timestamp
  location.created_at = {
    timestamp: location.created_at,
    comment: ageComment(location.created_at)
  }

  return location
}

async function fetchAuthorDetails(location) {
  if (location.created_by) {
    let result = await getUserInfo(location.created_by)

    if (!result.error) {
      location.created_by = {
        name: result.name,
        avatar: result.avatar
      }
    } else {
      location.created_by = "error"
    }
  }

  return location
}

//
// Transform into GeoJSON format
//
function locationAsGeoJSONFeature(location) {
  let {
    id, lat, lon, created_at, created_by, description, level, images
  } = location

  // Structure the data like a GeoJSON feature
  let feature = {
    id,
    properties: {
      created_at,
      created_by,
      description,
      level,
      images
    },
    geometry: {
      type: "Point",
      coordinates: [lon, lat]
    }
  }

  // Add a hash of the feature's properties for quick determination of its content
  feature.properties.hash = md5(JSON.stringify(feature))

  // Legit GeoJSON
  feature.type = "Feature"

  return feature
}
