//
// What kind of comment would we make on that age
//
// For a fun time: https://youtu.be/d5ojjW2gHOg
//
function ageComment(when) {
  let mins = (Date.now() - new Date(when)) / (60 * 1000)
  let hours = mins / 60
  let days = (hours / 24) | 0

  if (mins < 2)
    return "just moments ago"
  else if (mins < 15)
    return "a few minutes ago"
  else if (hours < 1)
    return "less than an hour ago"
  else if (hours < 1.3)
    return "about an hour ago"
  else if (hours < 6)
    return "a few hours ago"
  else {
    switch (days) {
      case 0:
        return "today"

      case 1:
        return "yesterday"

      default:
        return days + " days ago"
    }
  }
}

module.exports = {
  ageComment
}
