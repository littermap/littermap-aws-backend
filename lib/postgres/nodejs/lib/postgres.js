//
// https://github.com/porsager/postgres#getting-started
//

const postgres = require('postgres')

const GEOMETRY_TYPE_OID = process.env.DB_GEOMETRY_TYPE_OID

function pgInit() {
  return postgres({
    types: {
      point: {
        to: GEOMETRY_TYPE_OID,
        serialize: ({ lat, lon }) => `SRID=4326;POINT(${lat} ${lon})`
      }
    }
  })
}

module.exports = {
  pgInit
}
