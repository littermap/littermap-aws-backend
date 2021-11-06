//
// Get location by id:
//
// /id/5
//
// Get locations within radius of a center as a GeoJSON collection:
//
// /radius?lat=40.77&lon=-73.97&r=0.8?format=geojson
//

const { done } = require('/opt/nodejs/lib/endpoint')
const { check_isNumeric, check_isPositiveInteger } = require('/opt/nodejs/lib/validation')
const { md5 } = require('/opt/nodejs/lib/crypto')
const { pgInit } = require('/opt/nodejs/lib/postgres')

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
            state.res = { location: normalizeLocation(location) }
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

          locations = locations.map(normalizeLocation)

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
      state.res = { error: "Failed to query locations database", reason: e.message }
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
