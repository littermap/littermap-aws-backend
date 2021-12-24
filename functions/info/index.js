//
// Retrieve information
//
// Currently just the logged in user's profile information
//

const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { getUserInfo } = require('/opt/nodejs/lib/interface/users')
const { done } = require('/opt/nodejs/lib/endpoint')

exports.handler = ensureSession( async (event, context) => {
  let state = {}

  if (!event.session.who) {
    state.status = 200
    state.res = { message: "Not logged in" }
  } else {
    switch (event.routeKey) {
      // Retrieve the logged in user's profile information
      case "GET /profile":
        let result = await getUserInfo(event.session.who.id)

        if (!result.error) {
          state.res = {
            profile: {
              'name': result.name,
              'avatar': result.avatar,
              'member_since': result.created_at
            }
          }
        } else {
          state.status = 500
          state.res = result
        }
    }
  }

  return done(state)
} )
