//
// Access to the DynamoDB service
//

const dynamo = new (require('aws-sdk/clients/dynamodb').DocumentClient)()

module.exports = {
  dynamo
}
