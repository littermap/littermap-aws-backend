
const s3 = new (require('aws-sdk/clients/s3'))()

const { done } = require('/opt/nodejs/lib/endpoint')
const { logEvent } = require('/opt/nodejs/lib/interface/eventlog')
const { error, errorStr } = require('/opt/nodejs/lib/error')

const mediaBucket = process.env.MEDIA_BUCKET

exports.handler = async (event, context) => {
    let state = {}
    // get the authentication key from the request headers
    const authKey = event.headers.authentication;

// check if the authKey matches the expected key
    try{
        (authKey !== 'MCEtUbuGM4e9tfMz')
    } catch(e) {
      // if not send a 403 response
      state.status = 403
      state.res = error("Unauthorized")
    }

// get the data from the request body
const { lat, lng } = JSON.parse(event.body);
const data = { lat, lng };

    if (!state.status) {
        try {
            async(){
                s3.putObject( {
                    Bucket: mediaBucket,
                    Key: 'media/daniel.json',
                    Body: JSON.stringify(data)
                } )
            }
        } catch(e) {
          // if not send a 422 response
          state.status = 422
          state.res = error("failed save to bucket")
        }
    }
    return done(state, 201)
};
