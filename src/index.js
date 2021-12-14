const fs = require("fs");
const path = require("path");

require('dotenv').config()
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const {Verifier} = require("./components/verifier/verifier.js");

const loglevel =  require('loglevel');
const ll = loglevel.getLogger('main');
if (process.env.NODE_ENV === 'production') {
  ll.setLevel(ll.levels.DEBUG);
} else {
  ll.setLevel(ll.levels.DEBUG);
}


const app = express();
const httpServer = createServer(app);

const options = {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3005',
      'http://localhost:5000',
      'http://localhost:5001',
      'http://localhost:5002',
      'http://localhost:5003',
      'http://localhost:5005',
      'https://authorizer.141x.io',
      'https://authorizer.141x-testnet.io',
      'https://meta.141x.io',
      'https://meta.141x-testnet.io',
    ],
    credentials: true,
    path: '/socket.io',
  },
  allowRequest: (req, callback) => {
    const isOriginValid = true;
    callback(null, isOriginValid);
  },
};
const io = new Server(httpServer, options);

function GameServer(){
  this.sockets = {};
  this.gameClients = {};
  this.authClients = {};
  this.gameState = {
    playerItems: {

    },
    playerPositions: {

    }
  }
  this.addressData = {};
  this.add = function (socket){
    this.sockets[socket.id] = socket;
  }
  this.addGameClient= function (socket){
    this.gameClients[socket.id] = socket;
  }
  this.addAuthClient= function (socket){
    this.authClients[socket.id] = socket;
  }
  this.remove = function (socket){
    delete this.sockets[socket.id];
  }
  this.removeGameClient= function (socket){
    delete this.gameClients[socket.id];
  }
  this.removeAuthClient= function (socket){
    delete this.authClients[socket.id];
  }
  this.getSockets = function (){
    return this.sockets;
  }
  this.getGameClientSockets = function (){
    return this.gameClients;
  }
  this.getAuthClientSockets = function (){
    return this.authClients;
  }
  this.setGameState = function (newGameState){
    this.gameState = newGameState;
  }
  this.getGameState = function (){
    return this.gameState;
  }
  this.setAddressData = function (socket, addressData){
    this.addressData[socket.id] = addressData;
  }
  this.getAddressData = function (socket){
    return this.addressData[socket.id];
  }
  this.removeAddressData = function (socket){
    delete this.addressData[socket.id];
  }
  this.broadcastGameState = function (eventName){
    const gameState = {
      ...this.gameState,
      timestamp: performance.now(),
      players: {
        online: Object.keys(this.gameClients).length,
        addressData: this.addressData
      }
    }
    Object.keys(this.gameClients).forEach((gameClientSocket) => {
      this.gameClients[gameClientSocket].emit(eventName, gameState, async (response) => {
        // ll.debug(`socket: ${eventName}`, response);
      });
    })
  }

  this.saveGameState = async function (filePath){
    let stringifiedGameState = JSON.stringify(this.gameState);
    let savedGameState = await new Promise((res, rej) => {
      fs.writeFile(filePath, stringifiedGameState, (err, data) => {
        if (err) rej(err);
        try {
          res(stringifiedGameState)
        }catch (e){
          ll.error(`could not save the game state to the file ${filePath}`, stringifiedGameState)
          ll.error(e)
        }
      });
    })
    return savedGameState;
  }

  this.loadGameState = async function (filePath){
    this.gameState = await new Promise((res, rej) => {
      fs.readFile(filePath, (err, data) => {
        if(err) rej(err);
        if (err) throw err;
        try {
          let gameState = JSON.parse(data);
          res(gameState)
        }catch (e){
          ll.error(`coulde not parse the game state from the file ${filePath}`, data)
          ll.error(e)
        }
      });
    })
    return this.gameState;
  }

  this.startAutosave = function (intervalMilliseconds, filePath, options = {
    historized: false
  }){
    this.autosaveHandle = setInterval(async () => {
      if(options.historized){
        await this.saveGameState(filePath.replace(".json", `-${Date.now()}.json`))
      }
      await this.saveGameState(filePath.replace(".json", `-latest.json`))
    }, intervalMilliseconds)
  }
  this.stopAutosave = function (){
    clearInterval(this.autosaveHandle);
  }
}

const server = new GameServer();
server.loadGameState( path.resolve(`${__dirname}/../mounted/saves/game-state-latest.json`));
server.startAutosave(5000, path.resolve(`${__dirname}/../mounted/saves/game-state.json`), { historized: false });

const verifier = new Verifier();
const printServerState = () => {
  let allSockets = Object.keys(server.getSockets());
  let allGameClientSockets = Object.keys(server.getGameClientSockets());
  let allAuthClientSockets = Object.keys(server.getAuthClientSockets());
  let gameState = server.getGameState();
  ll.debug(`${allSockets.length} clients are connected`, {
    allSockets,
    allGameClientSockets,
    allAuthClientSockets,
    gameState
  });
}

function Main(){
  this.run = function (server, verifier){
    io.on("connection", (socket) => {
      ll.debug("socket: connection", socket.id);
      server.add(socket);
      printServerState();
      socket.on("set-client-type", (data) => {
        ll.debug("socket: set-client-type", {
          data,
          socketId: socket.id
        });
        if(data.payload === "auth-client"){
          server.addAuthClient(socket);
        } else if(data.payload === "game-client"){
          server.addGameClient(socket);
          server.broadcastGameState("game-state");
        }
        printServerState();
      })
      socket.on("disconnect", () => {
        ll.debug("socket: disconnect", socket.id);
        server.remove(socket);
        server.removeAuthClient(socket);
        server.removeGameClient(socket);
        server.removeAddressData(socket);
        // remove all player positions
        let tempGameState = server.getGameState();
        server.setGameState(tempGameState);

        printServerState();
      })
      socket.on("player-id", (data, callback) => {
        // ll.debug("socket: player-id", data);
        let authSockets = server.getAuthClientSockets();
        Object.keys(authSockets).forEach((authSocketId) => {
          authSockets[authSocketId].emit("auth-req", data, async (response) => {
            // ll.debug("socket: auth-res", response);
            // verify the data
            let network = process.env.NETWORK;
            let message = response.data;
            let signingResponse = response.signed;
            let originatorAddress = data.headers.address;
            let verifies = verifier.verify(network, message, signingResponse, originatorAddress)
            /*ll.debug(`socket: auth-res verifies: ${verifies}`, {
              network, message, signingResponse, originatorAddress
            });*/
            if(verifies){
              // verify the account status and give a response to the game client
              let addressDataResponse = await verifier.getAccountData(network, data.headers.address)
              let addressData = addressDataResponse ? addressDataResponse.data : null;
              server.setAddressData(socket, addressData);
              callback({
                verifies,
                addressData,
                gameGameState: server.getGameState()
              })
              server.broadcastGameState("game-state");
            }
          });
        })
      });
      socket.on("player-action", (playerActionData, callback) => {
        ll.debug("socket: player-action", playerActionData);
        let authSockets = server.getAuthClientSockets();
        Object.keys(authSockets).forEach((authSocketId) => {
          authSockets[authSocketId].emit("auth-req", playerActionData, async (response) => {
            // ll.debug("socket: auth-res", response);
            // verify the data
            let network = process.env.NETWORK;
            let message = response.data;
            let signingResponse = response.signed;
            let originatorAddress = playerActionData.headers.address;
            let verifies = verifier.verify(network, message, signingResponse, originatorAddress)
            ll.debug(`socket: auth-res verifies: ${verifies}`, {
              network, message, signingResponse, originatorAddress
            });
            if(verifies){
              // verify the account status and give a response to the game client
              let addressDataResponse = await verifier.getAccountData(network, playerActionData.headers.address)
              let addressData = addressDataResponse ? addressDataResponse.data : null;
              server.setAddressData(socket, addressData);

              if(
                playerActionData.payload.type === "move"
              ){
                // update the game state
                let tempGameState = server.getGameState();
                tempGameState.playerPositions[originatorAddress] = {
                  address: originatorAddress,
                  position: playerActionData.payload.payload
                }
                server.setGameState(tempGameState)
              } else if(
                playerActionData.payload.type === "buy-land"
              ){
                // update the game state
                let tempGameState = server.getGameState();
                const alreadyOwnsLand = (
                  tempGameState.playerItems[originatorAddress] && tempGameState.playerItems[originatorAddress].land && tempGameState.playerItems[originatorAddress].land.length > 0
                ) === true;
                ll.debug(`socket: buy-land - already owns land: ${alreadyOwnsLand.toString()}`, {
                  alreadyOwnsLand, tempGameState
                });
                tempGameState.playerItems[originatorAddress] = {
                  address: originatorAddress,
                  land: alreadyOwnsLand ? [
                    ...tempGameState.playerItems[originatorAddress].land,
                    playerActionData.payload.payload
                  ] : [
                    playerActionData.payload.payload
                  ]
                }
                server.setGameState(tempGameState)
              }
              printServerState();
              callback({
                verifies,
                addressData,
                gameGameState: server.getGameState()
              })
              server.broadcastGameState("game-state");
            }
          });
        })
      });
    });
  }
  this.startClientUpdates = function (server){
    this.handle = setInterval(function (){
      server.broadcastGameState("game-state");
    }, 1000);
  }
  this.stopClientUpdates = function (){
    clearInterval(this.handle);
  }
}

let main = new Main();
main.run(server, verifier);
main.startClientUpdates(server);

let port = process.env.PORT;
httpServer.listen(port);
ll.debug("websocket server is listening on port " + port +  ". on the " + process.env.NETWORK);

//catches uncaught exceptions
process.on('uncaughtException', (e) => {
  console.error("this should not have happened", e);
});

module.exports = {
  GameServer
}
