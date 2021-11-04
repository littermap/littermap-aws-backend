//
// String parameter validation for vetting external inputs
//

function check(state, name, kind, condition) {
  if (!condition()) {
    //
    // Set the error condition
    //
    state.status = 422
    state.res = { error: `'${name}' is expected to be ${kind}`}

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
    () => /^-?\d+\.?\d*$/.test(val)
  )
}

function check_isPositiveInteger(state, name, val) {
  return check(
    state, name, 'an integer',
    () => /^\d+$/.test(val)
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
    },
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
