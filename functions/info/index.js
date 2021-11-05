//
// Retrieve information
//

const dynamo = new (require('aws-sdk/clients/dynamodb').DocumentClient)()

const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { done } = require('/opt/nodejs/lib/endpoint')

const usersTable = process.env.USERS_TABLE

exports.handler = ensureSession( async (event, context) => {
  let state = {}

  async function doAsync(step) {
    if (!state.status) { await step() }
  }

  if (!event.session.who) {
    state.status = 200
    state.res = { message: "Not logged in" }
  } else {
    switch (event.resource) {
      case "/profile":
        await doAsync( async () => {
          try {
            let result = await dynamo.get({
              TableName: usersTable,
              Key: {
                'id': event.session.who.id
              }
            }).promise()

            let userRecord = result.Item

            state.res = {
              profile: {
                'name': userRecord.name,
                'avatar': userRecord.avatar,
                'member_since': userRecord.registered_at
              }
            }
          } catch(e) {
            state.status = 500
            state.res = { error: "User record lookup failed", reason: e.message }
          }
        } )
    }
  }

  state.status = state.status || 200

  return done(state)
} )
