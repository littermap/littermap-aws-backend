const aws = require('aws-sdk')

exports.handler = async function(event, context) {
  let id = Math.random().toString().substring(2)

  const res = {
    statusCode: 200,
    body: `{ "greeting": "It works!", "id": ${id} }`
  }

  return res
}
