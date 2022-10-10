//
// Get a pre-signed upload link to submit a media file
//

const s3 = new (require('aws-sdk/clients/s3'))()

const { ensureSession } = require('/opt/nodejs/lib/middleware/session')
const { randomHex } = require('/opt/nodejs/lib/crypto')
const { error } = require('/opt/nodejs/lib/error')
const { done } = require('/opt/nodejs/lib/endpoint')

const mediaBucket = process.env.MEDIA_BUCKET
const maxImageFileSize = process.env.MAX_UPLOAD_FILE_SIZE

//
// Tag the newly uploaded file as verified=false, so it will be automatically deleted unless it becomes confirmed as a permanent upload
//
const objectTags =
  '<Tagging><TagSet><Tag><Key>verified</Key><Value>false</Value></Tag></TagSet></Tagging>'

exports.handler = ensureSession( async (event, context) => {
  let state = {}

  if (!event.session.who) {
    state.status = 403
    state.res = error("Must be logged in to receive an upload link")
  }

  if (!state.status) {
    let id = randomHex(12)

    try {
      //
      // Create a signed S3 upload URL that allows the upload of a specific file within
      // a specific time window
      //
      const data = s3.createPresignedPost({
        Bucket: mediaBucket,
        // Pre-filled fields handed to the client
        Fields: {
          id,
          key: 'media/' + id,
          acl: 'public-read',
          tagging: objectTags,
          'Cache-Control': 'max-age=86400'
        },
        // Validation conditions (these ensure that pre-filled fields weren't modified)
        Conditions: [
          ["content-length-range", 0, maxImageFileSize],
          ["starts-with", "$content-type", 'image/'],
          { key: 'media/' + id },
          { acl: 'public-read' },
          { tagging: objectTags },
          { "Cache-Control": 'max-age=86400' }
        ],
        Expires: 300 // (seconds, 3600 by default)
      })

      state.res = data
    } catch(e) {
      state.status = 500
      state.res = error("Could not generate an authorized upload link to the S3 bucket", e.message)
    }
  }

  return done(state)
} )
