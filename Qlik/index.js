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

socket.on('success', (player) => {
  playerId = player.id
  console.log('logged in')
})

socket.on('start game', (game) => {
  readlineInterface.write('game started ')
  // if the current player is us, we want to play
  getGame(game.id)
      .then((game) => {
        if (game.current === playerId) {
          performMove()
        }
      })
      .catch((error) => {
        console.log("Error retrieving game on 'start game'", error)
      })
})

socket.on('in game', (game) => {
  console.log('already in game')

  getGame(game.id)
      .then((game) => {
        if (game.current === playerId) {
          console.log('your turn')
        }
      })
      .catch((error) => {
        console.log("Error retrieving game on 'in game'", error)
      })
})

socket.on('move played', (move) => {
  // if the move just played wasn't by us, we want to
  // make a move
  getMove(move.id)
      .then((move) => {
        readlineInterface.write('.')
        if (move.player != playerId) {
          performMove()
        }
      })
      .catch((error) => {
        console.log("Error retrieving Move on 'move played'", error)
      })
})

socket.on('invalid', (error) => {
  console.log("Invalid Action", error)
})

socket.on('game over', (game) => {
  readlineInterface.write('\n')
  console.log("Game Over")
  getGameStats(game.game.id, playerId)
})

socket.on('connect', (data) => {
  console.log('connected')
})

let getGame = (gameId) => {
  return new Promise((resolve, reject) => {
    let options = createOptions(`games/${gameId}`, "GET")

    request.get(options, (error, res, body) => {
      if (error) {
        console.error("Error Getting Game", error)
        reject(error)
      } else {
        resolve(JSON.parse(body))
      }
    })
  })
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

  // this is where we would put our logic for deciding which move to make
  // here we are just doing the opposite of what we did last

  lastMove = lastMove === "attack" ? "heal" : "attack"
  var body = {action: lastMove}

  let options = createOptions("moves", "POST", JSON.stringify(body))

  request.post(options, (error, res, body) => {
    if (error || res.statusCode != 200) {
      readlineInterface.write('!')
    }
  })
}

let createOptions = (endpoint, method, body) => {
  let options = {
    uri: `http://${config.host}:${config.apiPort}/${endpoint}`,
    method: method.toUpperCase(),
    headers: {
      "Authorization": `Basic ${apiKey}`,
      "Content-Type": "application/json"
    }
  }

  if (body != null) {
    options.body = body
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
