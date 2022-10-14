//
// String parameter validation for vetting external inputs
//

const { error } = require('./error')

function check(state, name, kind, test) {
  if (!test()) {
    //
    // Set the error condition
    //
    state.status = 422
    state.res = error(`'${name}' is expected to be ${kind}`)

    return false
  }

  return true
}

function check_isAlphaNumeric(state, name, val) {
  return check(
    state, name, 'alphanumeric',
    () => /^[0-9a-zA-Z]*$/.test(val)
  )
}

function check_isNumeric(state, name, val) {
  return check(
    state, name, 'numeric',
    // Possible minus, then digits, optionally followed by a dot and possibly more digits
    () => /^-?\d+\.?\d*$/.test(val)
  )
}

function check_isPositiveInteger(state, name, val) {
  return check(
    state, name, 'a positive integer',
    // All digits and not all zeros
    () => /^\d+$/.test(val) && !/^0+/.test(val)
  )
}

function check_isHex(digits) {
  return (state, name, val) =>
    check(
      state, name, `a ${digits} digit hex value`,
      () => val.length === digits && /^[\da-f]+$/.test(val)
    )
}

function check_isArray(state, name, val, kind, checkFn) {
  return check(
    state, name, `an array of ${kind} values`,
    () => {
      if (!Array.isArray(val))
        return false

      for (let i = 0; i < val.length; i++)
        if (!checkFn(state, name, val[i]))
          return false

      return true
    }
  )
}

module.exports = {
  check,
  check_isAlphaNumeric,
  check_isNumeric,
  check_isPositiveInteger,
  check_isHex,
  check_isArray
}
