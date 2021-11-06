//
// Administrative function that runs a database query
//
// Meant to be invoked manually or from another administrative component
//

const postgres = require('postgres')

exports.handler = async function(event, context) {
  let status, res

  let user = event.user || 'admin'
  let pass = process.env['DB_' + user.toUpperCase() + '_PASSWORD']
  let query = event.query

  if (user === 'admin')
    user = process.env.DB_ADMIN

  if (!query) {
    status = 400
    res = { error: "bad query" }
  } else {
    const pg = postgres({ user, pass })

    try {
      res = await pg.unsafe(query)
    } catch(e) {
      status = 500
      res = { error: "Database error", reason: e.message }
    } finally {
      pg.end()
    }
  }

  return {
    statusCode: status || 200,
    body: JSON.stringify(res)
  }
}
