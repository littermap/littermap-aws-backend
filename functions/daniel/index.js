
const s3 = new (require('aws-sdk/clients/s3'))()
const { done } = require('/opt/nodejs/lib/endpoint')

const mediaBucket = process.env.MEDIA_BUCKET

exports.handler = async (event, context, callback) => {
    // get the authentication key from the request headers
    const authKey = event.headers.authentication;

    // check if the authKey matches the expected key
    if(authKey !== 'MCEtUbuGM4e9tfMz'){
        // if not send a 403 response
        callback(null, {
            statusCode: 403,
            body: 'Unauthorized'
        });
        return;
    }

    // get the data from the request body
    const { lat, lng } = JSON.parse(event.body);
    const data = { lat, lng };

    try {
            await s3.putObject( {
              Bucket: mediaBucket,
              Key: 'media/daniel.json',
              Body: JSON.stringify(data)
            } ).promise()
          } catch(e) {}
    return done(201)
};
