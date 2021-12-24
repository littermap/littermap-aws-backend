//
// Checks if a valid session is currently being used, otherwise creates a new unauthenticated session
//
// Intended to be used as middleware that wraps the main handler function
//

const { dynamo } = require('../dynamo')

const { getCookie, done } = require('../endpoint')
const { randomHex } = require('../crypto')

//
// Don't forget to pass these environment variables to any function that uses sessions, and to
// apply a permissions policy to it that gives it read and write access to the sessions table
//
const sessionsTable = process.env.SESSIONS_TABLE
const sessionLifespan = process.env.SESSION_LIFETIME_IN_DAYS * (24 * 3600 * 1000)

function ensureSession(wrappedHandler) {
  return async (event, context) => {
    let status, res, sessionRecord, newSession = false

    async function doAsync(step) {
      if (!status) { await step() }
    }

    let oldSessionId = getCookie(event, 'session')

    //
    // If session ID looks like it could be valid, look it up in the sessions table
    //
    if (oldSessionId && /^[0-9a-f]{24}$/.test(oldSessionId)) {
      await doAsync( async () => {
        try {
          let result = await dynamo.get({
            TableName: sessionsTable,
            Key: {
              'id': oldSessionId
            }
          }).promise()

          sessionRecord = result.Item

          //
          // The database is configured to automatically delete expired session records from the table
          //
          if (!sessionRecord || sessionHasExpired(sessionRecord))
            sessionRecord = null
        } catch(e) {
          status = 500
          res = { error: "Session record lookup failed", reason: e.message }
        }
      } )
    }

    await doAsync( async () => {
      let now = new Date()

      // Expiration must be in unix epoch format (in seconds) for automatic TTL to take effect in the database
      let expires_epoch = (now.getTime() + sessionLifespan)
      let expires_value = Math.round(expires_epoch / 1000)

      //
      // If valid session exists update the expiration time, otherwise create a new session
      //
      if (sessionRecord) {
        try {
          await dynamo.update({
            TableName: sessionsTable,
            Key: {
              'id': sessionRecord.id
            },
            UpdateExpression: 'SET expires_at = :expires_at',
            ExpressionAttributeValues: {
              ':expires_at': expires_value
            }
          }).promise()
        } catch(e) {
          status = 500
          res = { error: "Failed to update current session", reason: e.message }
        }
      } else {
        //
        // Generate new random session id
        //
        let newSessionId = randomHex(12)

        sessionRecord = {
          'id': newSessionId,
          'created_at': now.toUTCString(),
          'expires_at': expires_value
        }

        try {
          await dynamo.put({
            TableName: sessionsTable,
            Item: sessionRecord
          }).promise()

          newSession = true
        } catch(e) {
          status = 500
          res = { error: "Failed to create new session", reason: e.message }
        }
      }
    } )

    if (!status) {
      event.session = sessionRecord

      //
      // Invoke the inner handler with session information provided
      //
      let result = await wrappedHandler(event, context)

      if (newSession) {
        //
        // Set cookie header
        //
        // Flags:
        //  - HttpOnly - the browser will not let page-level scripts manipulate this cookie
        //  - Secure - cookie only sent when HTTPS is in use
        //  - SameSite=None - allow cookie sessions when back-end is not served from the same domain as the front-end
        //
        result.headers = result.headers || {}
        result.headers['set-cookie'] =
          `session=${sessionRecord.id}; expires=${(new Date(sessionRecord.expires_at * 1000)).toUTCString()};` +
          ' path=/; HttpOnly; Secure; SameSite=None'
      }

      return result
    } else {
      return done({ status, res})
    }
  }
}

module.exports = {
  ensureSession
}

function sessionHasExpired(sessionRecord) {
  // Expiration time is stored without milliseconds, so add them back
  return (new Date()).getTime() > sessionRecord.expires_at * 1000
}
