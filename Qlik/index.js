const io = require("socket.io-client")
const request = require("request")
const config = require("./config")

console.log("Welcome to the Qritter Wars Client")

// This is the api key passed to the Qritter Wars REST API in the Authorization header
// for authentication
// format: base64 encoded value of <apiId>:<apiSecret>
const apiKey = new Buffer(`${config.apiId}:${config.apiSecret}`).toString('base64')

const socketArguments = `apiId=${config.apiId}&apiSecret=${config.apiSecret}`

let playerId
let socket = io.connect(`http://${config.host}:${config.socketPort}`, { query: socketArguments})

socket.on('connect', function(data) {
  console.log('connected')
})

socket.on('invalid', (error) => {
  console.log('error', error)
})

socket.on('success', (data) => {
  playerId = data.id
})

socket.on('start game', (game) => {

  getGame(game.id)
  .then((gameData) => {
    if(gameData.current === playerId) {
      console.log("our turn")
    }
  })
})

let performMove = () => {

  // this is where we would put our logic for deciding which move to make
  // here we are just attacking all the time. We should probably be more
  // creative than this. If we don't heal our Qritter will most likely be
  // defeated in no time.

  let body = {action: "attack"}
  let options = createOptions("moves", "POST", body)

  request.post(options, (error, res, body) => {
    if (error || res.statusCode !== 200) {
      console.log("Error Performing Move", error || res.body)
    } else {
      console.log(`attack performed successfully`)
    }
  })
}

let getGame = (gameId) => {
  return new Promise((resolve, reject) => {

    // we want to perform a GET request to the games/:id API
    // to retrieve information about the given game
    let options = createOptions(`games/${gameId}`, "GET")

    request.get(options, (error, res, body) => {
      if (error || res.statusCode !== 200) {
        console.error("Error Getting Game", error || res.body)
        reject(error)
      } else {
        resolve(JSON.parse(body))
      }
    })
  })
}

let createOptions = (endpoint, method, body) => {
  // we need to return all options that the request module expects
  // for an http request. 'uri' is the location of the request, 'method'
  // is what http method we want to use (most likely GET or POST). headers
  // are the http headers we want attached to our request
  let options = {
    uri: `http://${config.host}:${config.apiPort}/${endpoint}`,
    method: method.toUpperCase(),
    headers: {
      "Authorization": `Basic ${apiKey}`,
      "Content-Type": "application/json"
    }
  }

  if (body != null) {
    // if a body has been specified we want to add it to the http request
    options.body = JSON.stringify(body)
  }

  return options
}
