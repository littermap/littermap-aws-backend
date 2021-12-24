//
// Time related functions
//

function ageComment(when) {
  let days = (Date.now() - new Date(when)) / (3600*24*1000) | 0

  if (days === 0)
    return "today"
  else if (days === 1)
    return "yesterday"
  else
    return days + " days ago"
}

module.exports = {
  ageComment
}
