const crypto = require('crypto')

function md5(input) {
  return crypto.createHash('md5').update(input).digest("hex")
}

module.exports = {
  md5
}
