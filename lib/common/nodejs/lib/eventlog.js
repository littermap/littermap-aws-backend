//
// Event logging via a dedicated lambda function
//
// Any function that logs events must be given permission to invoke the event logging function
//

const lambda = new (require('aws-sdk/clients/lambda'))()

async function logEvent({ event_type, message }) {
  let response = await lambda.invokeAsync({
    FunctionName: 'log-event',
    InvokeArgs: JSON.stringify({
      body: {
        event_type,
        message
      }
    })
  }).promise()

  if (response.Status !== 202)
    console.log("Possibly failed to invoke function to log an event: " + message)
}

module.exports = {
  logEvent
}
