//
// This function is intended to be invoked by the browser after being redirected from the third-party sign-in dialog
//
// - Receives authorization code (signifying permission by user) from third-party authentication dialog
// - Exchanges authorization code for third-party access token (limited access key to personal data) by combining it with the application's private secret key
// - Using the access token retrieves the user's profile from the third-party provider
// - Locates the user in the local database or creates a new user account if they don't exist
// - Associates this user with the current browser session (this represents logging in)
//

const dynamo = new (require('aws-sdk/clients/dynamodb').DocumentClient)()

const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { logEvent } = require('/opt/nodejs/lib/eventlog')
const { basePath, done } = require('/opt/nodejs/lib/endpoint')
const v = require('/opt/nodejs/lib/validation')
const { httpsGet, httpsPost, queryString } = require('/opt/nodejs/lib/net')
const { md5, debase64 } = require('/opt/nodejs/lib/crypto')

const sessionsTable = process.env.SESSIONS_TABLE
const usersTable = process.env.USERS_TABLE

exports.handler = ensureSession( async (event, context) => {
  let state = {}

  function doSync(step) {
    if (!state.status) { step() }
  }

  async function doAsync(step) {
    if (!state.status) { await step() }
  }

  let userinfo, origin

  switch (event.resource) {
    case "/auth/{service}":
      let { service } = event.pathParameters

      switch (service) {
        case "google":
          //
          // This follows recommendations in:
          //   https://developers.google.com/identity/protocols/oauth2/openid-connect
          //
          // OpenID discovery reference:
          //   https://accounts.google.com/.well-known/openid-configuration
          //

          let { state: original_state, code: auth_code, scope, authuser, prompt } = event.queryStringParameters

          doSync( () => {
            let secret

            try {
              original_state = debase64(original_state)
              origin = original_state.origin
              secret = original_state.secret
            } catch(e) {
              // Can't decode, definitely not valid
            }

            //
            // Guard against request forgery by confirming that the returned state token has originated with the current session
            //
            if (secret !== md5(event.session.id)) {
              state.status = 422
              state.res = { error: "This sign-in authorization did not properly originate with the current session" }
            }
          } )

          v.check_isAlphaNumeric(state, auth_code, "code")

          let response_data

          await doAsync( async () => {
            //
            // The current URL needs to be included with the next API call and it has to be the same as the one used to
            // invoke this function, otherwise Google will refuse to issue an access token
            //
            let redirect_uri = basePath(event)

            //
            // Use the authorization code in combination with the client secret given to this application by Google to
            // obtain the access key to the user's profile information
            //
            let data = queryString({
              code: auth_code,
              client_id: process.env.CLIENTID_GOOGLE,
              client_secret: process.env.CLIENTSECRET_GOOGLE,
              scope: 'profile email',
              redirect_uri,
              grant_type: 'authorization_code'
            })

            try {
              let response = await httpsPost(
                {
                  host: 'oauth2.googleapis.com',
                  path: '/token',
                  headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                  },
                  body: data
                }
              )

              response_data = JSON.parse(response.body)

              if (response.statusCode !== 200) {
                state.status = 422
                state.res = { error: "Google service refused to issue an access key (something went wrong)" }
              }

            } catch(e) {
              state.status = 500
              state.res = { error: "Failed to query Google auth API endpoint to obtain access key", reason: e.message }
            }
          } )

          await doAsync( async () => {
            try {
              let { access_token, expires_in } = response_data // Not using: token_type, scope, id_token

              //
              // Request user profile information from Google API
              //
              let response = await httpsGet({
                host: 'www.googleapis.com',
                path: '/oauth2/v2/userinfo',
                headers: {
                  'Authorization': 'Bearer ' + access_token
                }
              })

              response_data = response.body

              if (response.statusCode !== 200) {
                state.status = 422
                state.res = { error: "Google API did not return user profile; HTTP code: " + res.statusCode }
              }
            } catch(e) {
              state.status = 500
              state.res = { error: "Failed to query Google API to get user profile", reason: e.message }
            }
          } )

          doSync( () => {
            try {
              let { id, email, name, given_name, locale, picture } = JSON.parse(response_data) // Not used: verified_email

              let avatar

              try {
                avatar = 'g:' + picture.match( /googleusercontent.com\/(.+?)=/ )[1] // See: https://developers.google.com/people/image-sizing
              } catch(e) {
                avatar = ''
              }

              userinfo = {
                id: 'g:' + id,
                name,
                given_name,
                email,
                locale,
                avatar
              }

            } catch(e) {
              state.status = 422
              state.res = { error: "User profile not received from Google API" }
            }
          } )

          break

        default:
          state.status = 422
          state.res = { error: "Unsupported auth service: " + service }
      }

      // end switch: method endpoint
  }

  let userRecord

  //
  // Check if user already exists
  //
  await doAsync( async () => {
    try {
      let result = await dynamo.get({
        TableName: usersTable,
        Key: {
          'id': userinfo.id
        }
      }).promise()

      userRecord = result.Item
    } catch(e) {
      state.status = 500
      state.res = { error: "User record lookup failed", reason: e.message }
    }
  } )

  if (!userRecord) {
    //
    // If user doesn't exist, add user to the database
    //
    await doAsync( async () => {
      let now = new Date()

      try {
        await dynamo.put({
          TableName: usersTable,
          Item: {
            'id': userinfo.id,
            'registered_at': now.toUTCString(),
            'name': userinfo.name,
            'email': userinfo.email,
            'avatar': userinfo.avatar
          }
        }).promise()

        await logEvent({
          type: "account",
          action: "created",
          used_id: userinfo.id,
          message: `Account created: ${userinfo.email}`
        })
      } catch(e) {
        state.status = 500
        state.res = { error: "Failed to create new user", reason: e.message }
      }
    } )
  } else {
    //
    // If the user exists, update their information
    //
    await doAsync( async () => {
      try {
        await dynamo.update({
          TableName: usersTable,
          Key: {
            'id': userinfo.id
          },
          UpdateExpression: 'SET #name=:name,email=:email,avatar=:avatar', // "name" is a reserved word
          ExpressionAttributeNames: {
            '#name': 'name'
          },
          ExpressionAttributeValues: {
            ':name': userinfo.name,
            ':email': userinfo.email,
            ':avatar': userinfo.avatar
          }
        }).promise()
      } catch(e) {
        state.status = 500
        state.res = { error: "Failed to update user information", reason: e.message }
      }
    } )
  }

  //
  // Associate current session with user
  //
  await doAsync( async () => {
    //
    // Cache the user's email in the session store for quick access without retrieving it from the users table
    //
    event.session.who = {
      id: userinfo.id,
      email: userinfo.email
    }

    try {
      let result = await dynamo.update({
        TableName: sessionsTable,
        Key: {
          'id': event.session.id
        },
        UpdateExpression: 'SET who=:user', // "user" is a reserved word
        ExpressionAttributeValues: {
          ':user': event.session.who
        }
      }).promise()

      await logEvent({
        type: "session",
        action: "login",
        used_id: userinfo.id,
        message: `User ${userinfo.email} logged in`
      })
    } catch(e) {
      state.status = 500
      state.res = { error: "Failed to associate user with current session", reason: e.message }
    }
  } )

  if (!state.status) {
    if (origin) {
      state.status = 302
      state.headers = {
        'Location': origin
      }
    } else
      state.status = 200

    state.res = {
      profile: {
        name: userinfo.name,
        avatar: userinfo.avatar
      }
    }
  }

  return done(state)
} )
