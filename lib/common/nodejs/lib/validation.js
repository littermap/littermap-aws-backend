//
// Parameter validation for vetting external inputs
//

function check(state, cond, message) {
  if (!cond()) {
    // If status isn't set already, set it to reflect what has just been encountered
    if (!state.status) {
      state.status = 422
      state.res = { error: message }
    }

    return false
  }

  return true
}

function check_isAlphaNumeric(state, name, val) {
  return check(state, () => /^[0-9a-zA-Z]*$/.test(val), `${name} is expected to be alphanumeric`)
}

function check_isNumeric(state, name, val) {
  return check(state, () => /^-?\d+\.?\d*$/.test(val), `${name} is expected to be numeric`)
}

function check_isPositiveInteger(state, name, val) {
  return check(state, () => /^\d+$/.test(val), `${name} is expected to be an integer`)
}

module.exports = {
  check,
  check_isAlphaNumeric,
  check_isNumeric,
  check_isPositiveInteger
}
