//
// This is handy for checking HTTP headers, because there is no enforcement of case
//
function getAttributeAnyCase(obj, key) {
  return obj[
    Object.keys(obj).find(x => x.toLowerCase() === key)
  ]
}

module.exports = {
  getAttributeAnyCase
}
