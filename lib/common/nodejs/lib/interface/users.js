//
// Interface to the users table
//

const { dynamo } = require('../dynamo')

const usersTable = process.env.USERS_TABLE

async function getUserInfo(userId) {
  try {
    let result = await dynamo.get({
      TableName: usersTable,
      Key: {
        'id': userId
      }
    }).promise()

    return result.Item
  } catch(e) {
    return { error: "User record lookup failed", reason: e.message }
  }
}

async function getUserInfoBatch(userIds) {
  try {
    let result = await dynamo.batchGet({
      TableName: usersTable,
      Key: {
        'id': userId
      }
    }).promise()

    return result.Item
  } catch(e) {
    return { error: "User record lookup failed", reason: e.message }
  }
}

module.exports = {
  getUserInfo,
  getUserInfoBatch
}
