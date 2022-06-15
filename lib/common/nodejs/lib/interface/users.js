//
// Interface to the users table
//

const { dynamo } = require('../dynamo')
const { error } = require('../error')

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
    return error(`User info lookup failed for user id ${userId}`, e.message)
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
    return error("Batch user info lookup failed", e.message)
  }
}

module.exports = {
  getUserInfo,
  getUserInfoBatch
}
