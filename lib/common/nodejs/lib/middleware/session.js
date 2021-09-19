//
// Checks if a valid session is currently being used, otherwise creates a new (logged out) session
//
// Intended to be used as middleware that wraps the main handler function
//

const crypto = require('crypto')

const dynamo = new (require('aws-sdk/clients/dynamodb').DocumentClient)()

const sessionsTable = process.env.SESSIONS_TABLE
const sessionLifespan = process.env.SESSION_LIFETIME_IN_DAYS * (24 * 3600 * 1000)

function ensureSession(wrappedHandler) {
  return async (event, context) => {
    let status, res, sessionRecord, newSession = false

    function doSync(step) {
      if (!status) { step() }
    }

    async function doAsync(step) {
      if (!status) { await step() }
    }

    let oldSessionId = getCookies(event).session

    //
    // If session ID looks possibly valid, look it up in the sessions table
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
          // Expired sessions will automatically be removed from the table by the database service
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

      // Expiration must be unix epoch form (in seconds) for automatic TTL to take effect in the database
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
        let newSessionId = crypto.randomBytes(12).toString('hex')

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

      let result = await wrappedHandler(event, context)

      if (newSession) {
        //
        // Set cookie header
        //
        // The 'HttpOnly' flag means the browser will not let page-level scripts manipulate this cookie
        //
        result.headers = result.headers || {}
        result.headers['Set-Cookie'] =
          `session=${sessionRecord.id}; expires=${(new Date(sessionRecord.expires_at * 1000)).toUTCString()};` +
          ' path=/; HttpOnly; Secure; SameSite=Lax'
      }

      return result
    } else {
      return {
        statusCode: status,
        body: JSON.stringify(res)
      }
    }
  }
}

module.exports = {
  ensureSession
}

function getCookies(event) {
  return parseCookieString(
    getAttributeAnyCase(event.headers, 'cookie')
  )
}

function getAttributeAnyCase(obj, key) {
  return obj[
    Object.keys(obj).find(x => x.toLowerCase() === key)
  ]
}

function parseCookieString(str) {
  let cookies = {}

  str && str.split(';').forEach( (item) => {
    let parts = item.split('=')
    let key = parts.shift().trim()

    if (key !== '')
      cookies[key] = decodeURI(parts.join('='))
  } )

  return cookies
}

function sessionHasExpired(sessionRecord) {
  // Expiration time is stored without milliseconds, so add them back
  return (new Date()).getTime() > sessionRecord.expires_at * 1000
}
