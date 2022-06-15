//
// This function is inteded to be invoked by services in order to log activities.
//
// It populates a DynamoDB table with timestamped items.
//
// The partition key is the beginning of the UTC day in epoch time without milliseconds.
// The range key (also known as a sort key) is constructed from the complete epoch timestamp plus
// a random integer (to enable the items to be sorted by their creation time yet also ensuring
// uniqueness).
//
// The timestamp is also recorded as a field (in UTC) for human convenience.
//

const { dynamo } = require('/opt/nodejs/lib/dynamo')
const { error } = require('/opt/nodejs/lib/error')

exports.handler = async function(event, context) {
  let status, res

  // example body:
  //
  // {
  //   "type": "account",
  //   "action": "created"
  //   "message": "New account created: 1234567890"
  // }

  let input

  if (typeof event.body === 'object') {
    input = event.body
  } else {
    try {
      input = JSON.parse(event.body)
    } catch(e) {
      status = 422
      res = error("Post data must be valid JSON")
    }
  }

  if (!status) {
    if (typeof input.message !== "string") {
      status = 422
      res = error('"message" is required')
    } else {
      let now = new Date(), today = new Date(now)

      today.setUTCHours(0,0,0,0)

      try {
        res = await dynamo.put({
          TableName: process.env.TABLE_NAME,
          Item: {
            'date_key': today.getTime().toString().slice(0, -3),
            'time_key': now.getTime().toString() + Math.random().toString().substring(2, 8),
            'timestamp': now.toUTCString(),
            'event': input
          }
        }).promise()
      } catch(e) {
        status = 500
        res = error(e.message)
      }
    }
  }

  return {
    statusCode: status || 200,
    body: JSON.stringify(res)
  }
}
