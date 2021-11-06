//
// Get a pre-signed upload link to submit a media file
//

const s3 = new (require('aws-sdk/clients/s3'))()

const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { done } = require('/opt/nodejs/lib/endpoint')
const { randomHex } = require('/opt/nodejs/lib/crypto')

const mediaBucket = process.env.MEDIA_BUCKET
const maxImageFileSize = process.env.MAX_UPLOAD_FILE_SIZE

const objectTags =
  '<Tagging><TagSet><Tag><Key>verified</Key><Value>false</Value></Tag></TagSet></Tagging>'

exports.handler = ensureSession( async (event, context) => {
  let state = {}

  if (!event.session.who) {
    state.status = 403
    state.res = { error: "Must be logged in to receive an upload link" }
  }

  if (!state.status) {
    let id = randomHex(12)

    try {
      //
      // Signed S3 upload URLs enable anyone to upload a file (within specified constraints)
      // to a specific S3 bucket within a certain time window
      //
      const data = s3.createPresignedPost({
        Bucket: mediaBucket,
        Fields: {
          id,
          key: 'media/' + id,
          acl: 'public-read',
          Tagging: objectTags
        },
        Conditions: [
          ["content-length-range", 0, maxImageFileSize],
          ["starts-with", "$key", "media/"],
          ["starts-with", "$content-type", "image/"],
          ['eq', '$Tagging', objectTags],
          { acl: "public-read" }
        ],
        Expires: 300 // (seconds, 3600 by default)
      })

      state.res = data
    } catch(e) {
      state.status = 500
      state.res = { error: "Could not generate a signed upload link to the S3 bucket: " + e.message }
    }
  }

  return done(state)
} )
