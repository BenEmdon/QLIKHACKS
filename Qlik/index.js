const io = require("socket.io-client")
const config = require("./config")

console.log("Welcome to the Qritter Wars Client")

const socketArguments = `apiId=${config.apiId}&apiSecret=${config.apiSecret}`

let playerId
let socket = io.connect(`http://${config.host}:${config.socketPort}`, { query: socketArguments})

socket.on('connect', function(data) {
  console.log('connected')
})

socket.on('invalid', (error) => {
  console.log('error', error)
})

socket.on('success', (id) => {
  playerId = data.id
  console.log(id);
})
