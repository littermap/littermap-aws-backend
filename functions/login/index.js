//
// Handles:
//
// - Login redirect
// - Logout
//

const dynamo = new (require('aws-sdk/clients/dynamodb').DocumentClient)()

const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { logEvent } = require('/opt/nodejs/lib/eventlog')
const { baseUrl, getReferrer, done } = require('/opt/nodejs/lib/endpoint')
const { urlBase } = require('/opt/nodejs/lib/net')
const { getAttributeAnyCase } = require('/opt/nodejs/lib/misc')
const { md5, base64 } = require('/opt/nodejs/lib/crypto')

const sessionsTable = process.env.SESSIONS_TABLE
const googleClientId = process.env.CLIENTID_GOOGLE

exports.handler = ensureSession( async (event, context) => {
  let state = {}, dest_url

  switch (event.resource) {
    case "/login/{service}":
      let { service } = event.pathParameters

      switch (service) {
        case "google":
          let origin = getReferrer(event)

          let stateToken = {
            secret: md5(event.session.id),
            origin
          }

          //
          // The API may be invoked directly (such as while testing during development), in which
          // case there won't be a referrer header in the request, so in that case use the host
          // information from the lambda invocation event object.
          //
          let redirect = origin ? urlBase(origin) + '/' + event.requestContext.stage : baseUrl(event)

          dest_url =
            'https://accounts.google.com/o/oauth2/v2/auth' +
            '?redirect_uri=' + redirect + '/auth/google' +
            '&client_id=' + googleClientId +
            '&state=' + base64(stateToken) +
            '&scope=profile%20email' +
            '&response_type=code' +
            '&prompt=consent'

          break

        default:
          state.status = 404
          state.res = { message: "Login method not supported: " + service }
      }

      //
      // Serve redirect to the third party sign-in page
      //
      if (!state.status) {
        state.status = 302 // "Found"
        state.headers = { Location: dest_url }
      }

      break

    case "/logout":
      //
      // Disassociate the user account from the current session
      //
      if (event.session.who) {
        try {
          await dynamo.update({
            TableName: sessionsTable,
            Key: {
              'id': event.session.id
            },
            UpdateExpression: 'REMOVE who'
          }).promise()

          await logEvent({
            type: "session",
            action: "logout",
            message: `User ${event.session.who.email} logged out`
          })

          delete event.session.who
        } catch(e) {
          state.status = 500
          state.res = { error: "Failed to log the user out from the current session", reason: e.message }
        }

        if (!state.status) {
          state.status = 200
          state.res = { message: "Current session has been logged out" }
        }
      } else {
        if (!state.status) {
          state.status = 200
          state.res = { message: "Current session is already logged out" }
        }
      }

    //
    // The API gateway should not be allowing any other patterns through until additional paths are configured to invoke this function
    //
  }

  return done(state)
} )
