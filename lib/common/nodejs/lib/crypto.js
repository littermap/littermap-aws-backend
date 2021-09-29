const crypto = require('crypto')

function md5(input) {
  return crypto.createHash('md5').update(input).digest("hex")
}

function base64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
}

function debase64(b64) {
  return JSON.parse(Buffer.from(b64, 'base64').toString())
}

module.exports = {
  md5,
  base64,
  debase64
}
