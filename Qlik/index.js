const io = require("socket.io-client")
const request = require("request")
const config = require("./config")
var counter = 0

console.log("Welcome to the Qritter Wars Client")

// This is the api key passed to the Qritter Wars REST API in the Authorization header
// for authentication
// format: base64 encoded value of <apiId>:<apiSecret>
const apiKey = new Buffer(`${config.apiId}:${config.apiSecret}`).toString('base64')

const socketArguments = `apiId=${config.apiId}&apiSecret=${config.apiSecret}`

let playerId
let otherPlayerId
let socket = io.connect(`http://${config.host}:${config.socketPort}`, { query: socketArguments})

socket.on('connect', function(data) {
  console.log('connected')
})

socket.on('invalid', (error) => {
  console.log('error', error)
})

socket.on('success', (data) => {
  playerId = data.id
  console.log('Got player id: ' + playerId);
})

socket.on('start game', (game) => {
  counter = 0
  otherPlayerId = game.player1 === playerId ? game.player2 : game.player1
  getGame(game.id)
  .then((gameData) => {
    if(gameData.current === playerId) {
      console.log("our turn")
    }
  })
})

socket.on('game over', (game) => {
  console.log("Game Over")
  getGameStats(game.game.id, playerId)
})

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

socket.on('move played', (move) => {
  // someone has played a move in our game
  // if the move just played wasn't by us, it is now
  // our turn to play.

  getMove(move.id)
      .then((move) => {
        if (move.player != playerId) {
          performMove()
        }
      })
    .catch((error) => {
      console.log("Error retrieving Move on 'move played'", error)
  })
})

let getMove = (moveId) => {
  return new Promise((resolve, reject) => {
    let options = createOptions(`moves/${moveId}`, "GET")

    request.get(options, (error, res, body) => {
      if (error) {
        console.error("Error Getting Move", error)
        reject(error)
      } else {
        resolve(JSON.parse(body))
      }
    })
  })
}

let performMove = () => {
  var playerHealth
  getHealth(playerId).then((health) => {
    playerHealth = health
    return getHealth(otherPlayerId).then((otherHealth) => {
      doAMove(playerHealth > otherHealth || playerHealth > 80 ? "attack" : "heal")
    }).catch((err) => {
      doAMove((counter + 1 )% 3 === 0 ? "attack" : "heal")
    })
  })

  // this is where we would put our logic for deciding which move to make
  // here we are just attacking all the time. We should probably be more
  // creative than this. If we don't heal our Qritter will most likely be
  // defeated in no time.
}

let doAMove = (move) => {
  let body = {action: move}
  let options = createOptions("moves", "POST", body)

  request.post(options, (error, res, body) => {
    if (error || res.statusCode !== 200) {
      console.log("Error Performing Move", error || res.body)
    } else {
      console.log(`attack performed successfully`)
    }
  })
}

let getHealth = (id) => {
  return new Promise((resolve, reject) => {
    let options = createOptions(`players/${id}`, "GET")

    request.get(options, (error, res, body) => {
      if (error || res.statusCode !== 200) {
        console.error("Error Getting Game", error || res.body)
        reject(error)
      } else {
        var player = JSON.parse(body)
        resolve(player.health)
      }
    })
  })
}


// let getHealth = () => {
//   return new Promise((resolve, reject) => {
//
//     // we want to perform a GET request to the games/:id API
//     // to retrieve information about the given game
//     let options = createOptions(`players/active`, "GET")
//
//     request.get(options, (error, res, body) => {
//       if (error || res.statusCode !== 200) {
//         console.error("Error Getting Game", error || res.body)
//         reject(error)
//       } else {
//         var obj = JSON.parse(body)
//         var players = obj.filter(item => item._id === playerId || item._id === otherPlayerId)
//         if (players.length < 1) {
//           console.log('players.length < 1');
//           resolve({playerHealth: 100, otherPlayerHealth: 0})
//         } else {
//           var playerHealth = players.filter(item => item._id === playerId)[0]
//           var otherPlayerHealth = players.filter(item => item._id === otherPlayerId)[0]
//           console.log('player health: ' + playerHealth.health);
//           console.log('other player health: ' + otherPlayerHealth.health);
//
//           resolve({playerHealth: playerHealth.health, otherPlayerHealth: otherPlayerHealth.health})
//         }
//       }
//     })
//   })
// }

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

let getGameStats = (gameId, playerId) => {
  getGame(gameId)
      .then((game) => {
        if (game.winner === playerId) {
          console.log("You Won!!!")
        } else {
          console.log("You Lost :(")
        }
        return getGameMoves(gameId)
      })
      .then((moves) => {
        console.log("Total Moves:", moves.length)
        console.log("Me")
        console.log("==")
        printStatistics(moves.filter((move) => move.player === playerId))

        console.log("Opponent")
        console.log("========")
        printStatistics(moves.filter((move) => move.player !== playerId))
      })
      .catch((error) => {
        console.log("Issue Retrieving Game Stats", error)
      })
}

let printStatistics = (moves) => {
  let attacks = moves.filter((move) => move.action === "attack").map((move) => {
    return {value: move.value, result: move.result}
  })
  let attackValue = attacks.reduce((total, move) => total + move.value, 0)
  let heals = moves.filter((move) => move.action === "heal").map((move) => move.value)
  let healValue = heals.reduce((total, value) => total + value, 0)
  console.log("Attacks:", attacks.length)
  console.log("Total Attack Value:", attackValue)
  console.log("Total Attack Avg:", parseInt(attackValue / attacks.length))
  console.log("Total Hits", attacks.filter((move) => move.result === "hit").length)
  console.log("Total Critical Hits", attacks.filter((move) => move.result === "critical").length)
  console.log("Total Misses", attacks.filter((move) => move.result === "miss").length)
  console.log("Heals:", heals.length)
  console.log("Total Heal Value:", healValue)
  console.log("Total Heal Avg:", parseInt(healValue / heals.length))
}

let getGameMoves = (gameId) => {
  return new Promise((resolve, reject) => {
    let options = createOptions(`games/${gameId}/moves`, "GET")

    request.get(options, (error, res, body) => {
      if (error || res.statusCode !== 200) {
        console.error("Error Getting Game Moves", error || res.body)
        reject(error)
      } else {
        resolve(JSON.parse(body))
      }
    })
  })
}
