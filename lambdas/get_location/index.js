const postgres = require('postgres')

exports.handler = async function(event, context) {
  let status = 200, res
  let id = event.pathParameters.id

  if (Number.isInteger(id)) {
    status = 422
    res = { error: '"id" is expected to be an integer' }
  } else {
    const pg = postgres()

    try {
      let [location] = await pg`SELECT id,created_at,lat,lon FROM world.locations WHERE id = ${id};`

      if (!location) {
        status = 404
        res = { message: "Not found" }
      } else
        res = { location }
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
