//
// https://github.com/porsager/postgres#getting-started
//

const postgres = require('postgres')

const GEOMETRY_TYPE_OID = process.env.DB_GEOMETRY_TYPE_OID

function pgInit() {
  return postgres({
    types: {
      //
      // Custom type that maps to a PostGIS point
      //
      point: {
        //
        // This must be the 'oid' (object id) of the PostGIS 'geometry' type record in the 'pg_type' table,
        // an entry which is created when the PostGIS extension is initialized
        //
        to: GEOMETRY_TYPE_OID,
        serialize: ({ lat, lon }) => `SRID=4326;POINT(${lat} ${lon})`
      }
    }
  })
}

module.exports = {
  pgInit
}
