const { request } = require('https')

function queryString(obj) {
  return Object.keys(obj).map(key => key + '=' + obj[key]).join('&')
}

async function httpsPost({ host, port, path, headers, body }) {
  return await https({ host, port, path, headers, method: 'POST', body })
}

async function httpsGet({ host, port, path, headers }) {
  return await https({ host, port, path, headers, method: 'GET' })
}

module.exports = {
  queryString,
  httpsPost,
  httpsGet
}

//
// Internal functions
//

https = async function (opts) {
  try {
    return await makeRequest(opts)
  } catch(e) {
    return { error: e.message }
  }
}

function makeRequest(opts) {
  return new Promise((resolve, reject) => {
    let req = request(opts, res => {
      if (res.statusCode < 200 || res.StatusCode > 299) {
        return reject(new Error('HTTP status code ' + res.statusCode))
      }

      const body = []
      res.on('data', (chunk) => body.push(chunk))
      res.on('end', () => { 
        res.body = Buffer.concat(body).toString()
        resolve(res)
      })
    })

    req.on('error', err => { reject(err) })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timed out'))
    })

    if (opts.body)
      req.write(opts.body)

    req.end()
  })
}
