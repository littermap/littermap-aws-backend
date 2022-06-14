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
    })

    return result.Item
  } catch(e) {
    return error(`User info lookup failed for user id ${userId}`, e.message)
  }
}

//
// Fetch user details for a list of unique user ids
//
// If the list contains duplicates it will return an error
//
async function getUserInfoBatch(userIds) {
  try {
    //
    // getAll() is from dynamo-plus and is a simpler way to batchGet values from a single table
    //
    // https://github.com/Sleavely/dynamo-plus#methods-getall
    //
    let results = await dynamo.getAll({
      TableName: usersTable,
      Keys: userIds.map( id => ({ 'id': id }) )
    })

    return results
  } catch(e) {
    return error("Batch user info lookup failed", e.message)
  }
}

module.exports = {
  getUserInfo,
  getUserInfoBatch
}
