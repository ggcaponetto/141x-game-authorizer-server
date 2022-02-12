const fs = require("fs");
const path = require("path");

require('dotenv').config()
let turf = require('@turf/turf');
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const {Verifier} = require("./components/verifier/verifier.js");
const {LandUtil, Routine} = require("./components/land-verification/land-verification.js");


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

const landUtil = new LandUtil();

function GameServer(){
  this.sockets = {};
  this.gameClients = {};
  this.authClients = {};
  this.authClientsPasswords = {};
  this.gameState = {
    assets: {
      land: {
        type: "land",
        unit: process.env.LAND_TOKEN_POLICYID,
        ratio: process.env.LAND_TOKEN_RATIO
      }
    },
    playerItems: {

    },
    playerPositions: {

    },
    playerResources: {
      addressData: {

      },
      lockedResources: {

      }
    },
    addressSocketMap: {

    }
  }

  this.computeLockedResources = function (gameState, landUtil){
    let lockedResources = {}
    Object.keys(gameState.playerItems).forEach(address => {
      lockedResources[address] = gameState.playerResources.lockedResources[address] === undefined ? {} : gameState.playerResources.lockedResources[address]
      let area = landUtil.getTotalLandExtension(address, gameState);
      lockedResources[address].land = {
        "unit": gameState.assets.land.unit,
        "quantity": area * gameState.assets.land.ratio
      };
    })
    return lockedResources;
  }
  this.hasEnoughFunds = function (address, assetQuantity, asset, lockedResources, playerAddressData){
    let alreadyLocked = (()=>{
      if(
        lockedResources[address]
        && lockedResources[address][asset.type]
        && lockedResources[address][asset.type].quantity
      ){
        return parseFloat(lockedResources[address][asset.type].quantity);
      } else {
        return 0;
      }
    })();
    let assetInWallet = playerAddressData.amount.find(addresDataElement => {
      return addresDataElement.unit === asset.unit
    });
    if(assetInWallet){
      let quantityInWallet = parseFloat(assetInWallet.quantity) || 0;
      let remaining = quantityInWallet - alreadyLocked - assetQuantity;
      return remaining >= 0;
    } else {
      return false;
    }
  }
  this.broadcastGameState = (eventName, data = this.gameState) => {
    Object.keys(this.gameClients).forEach((gameClientSocket) => {
      this.gameClients[gameClientSocket].emit(eventName, data, async (response) => {
        // ll.debug(`socket: ${eventName}`, response);
      });
    })
  }

  this.saveGameState = async function (filePath){
    let stringifiedGameState = JSON.stringify(this.gameState, null, 2);
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
          // override the asset properties that depend on env variables
          gameState.assets = {
            land: {
              type: "land",
              unit: process.env.LAND_TOKEN_POLICYID,
              ratio: process.env.LAND_TOKEN_RATIO
            }
          }
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
  this.validateGameClientRequest = function (data){
    if(!data?.headers?.address || !data?.payload){
      ll.error("Invalid game client request.", data);
      throw new Error(`Invalid game client request.`);
    }
    return true;
  }
  this.verifyGameClientRequest = function (verifier, data, onVerificationDone){
    ll.debug("socket: verifyGameClientRequest", {
      server, data
    });
    Object.keys(server.authClients).forEach((authSocketId) => {
      let isCorresppondantAuthClient = server.authClientsPasswords[authSocketId] === data.headers.password;
      let isPasswordSet = (
        data.headers.password
        && data.headers.password.trim() !== ""
        && server.authClientsPasswords[authSocketId]
        && server.authClientsPasswords[authSocketId].trim() !== ""
      )
      let isPasswordSecure = data.headers.password.trim().length >= 16;
      if(isCorresppondantAuthClient && isPasswordSet && isPasswordSecure){
        server.authClients[authSocketId].emit("auth-req", data, (response) => {
          // ll.debug("socket: auth-res", response);
          // verify the data
          server.validateGameClientRequest(data);
          let network = process.env.NETWORK;
          let message = response.data;
          let signingResponse = response.signed;
          let originatorAddress = data.headers.address;
          let verifies = verifier.verify(network, message, signingResponse, originatorAddress)
          ll.debug(`socket: auth-res verifies: ${verifies}`, {
            network, message, signingResponse, originatorAddress
          });
          onVerificationDone({
            verifies,
            originatorAddress,
            network,
            message,
            signingResponse,
            authSocketId
          });
        });
      }
    })
  }
  this.notifyGameClients = function (data){
    Object.keys(server.gameClients).forEach((gameClientSocketId) => {
      server.gameClients[gameClientSocketId].emit("game-server-notification", data, (response) => {
        ll.debug("socket: game-server-notification response", response);
      });
    })
  }
}

const server = new GameServer();
server.loadGameState( path.resolve(`${__dirname}/../mounted/saves/game-state-latest.json`));
server.startAutosave(5000, path.resolve(`${__dirname}/../mounted/saves/game-state.json`), { historized: false });

const verifier = new Verifier();
const routine = new Routine();
const printServerState = () => {
  let allSockets = Object.keys(server.sockets);
  let allGameClientSockets = Object.keys(server.gameClients);
  let allAuthClientSockets = Object.keys(server.authClients);
  ll.debug(`${allSockets.length} clients are connected`, {
    gameState: server.gameState,
    allSockets,
    allGameClientSockets,
    allAuthClientSockets,
    authClientsPasswords: server.authClientsPasswords
  });
}

function Main(){
  this.run = function (server, verifier){
    io.on("connection", (socket) => {
      ll.debug("socket: connection", socket.id);
      server.sockets[socket.id] = socket;
      printServerState();
      socket.on("disconnect", () => {
        ll.debug("socket: disconnect", socket.id);
        let address = Object.keys(server.gameState.addressSocketMap)
          .find(address => (
            server.gameState.addressSocketMap[address].authSocketId === socket.id
            || server.gameState.addressSocketMap[address].gameSocketId === socket.id
          ))
        delete server.gameState.playerResources.lockedResources[address];
        delete server.gameState.playerResources.addressData[address];

        delete server.sockets[socket.id];
        delete server.authClients[socket.id];
        delete server.authClientsPasswords[socket.id];
        delete server.gameClients[socket.id];
        delete server.gameState.addressSocketMap[address];

        server.broadcastGameState("game-state");
        printServerState();
      })
      function updateResources(data, callback){
        server.verifyGameClientRequest(verifier, data, ({
          verifies,
          originatorAddress,
          network,
          message,
          signingResponse,
          authSocketId
        }) => {
          ll.debug("socket: updateResources", {
            data, verifies, originatorAddress, network
          });
          if(verifies){
            // authenticated reqeusts
            const update = async () => {
              let addressDataResponse = await verifier.getAccountData(network, originatorAddress)
              let addressData = addressDataResponse?.data;
              server.gameState.playerResources.addressData[originatorAddress] = addressData;
              let tempLockedResources = server.computeLockedResources(server.gameState, landUtil)
              server.gameState.playerResources.lockedResources = tempLockedResources;
              server.broadcastGameState("game-state");
              printServerState();
            };
            update();
            // map the address to active sockets
            server.gameState.addressSocketMap[originatorAddress] = {
              authSocketId: authSocketId,
              gameSocketId: socket.id
            }
          }
        });
      }
      function updatePosition(data, callback){
        server.verifyGameClientRequest(verifier, data, ({
          verifies,
          originatorAddress,
          network,
          message,
          signingResponse,
          authSocketId
        }) => {
          ll.debug("socket: updatePosition", {
            data, verifies, originatorAddress, network
          });
          if(verifies){
            // authenticated reqeusts
            const update = async () => {
              if(
                data.payload.type === "move"
              ){
                // update the game state
                // allow the player to move only on public land, own land or holding access tokens

                let targetLand = null;
                let isOwnLand = false;

                Object.keys(server.gameState.playerItems).forEach(key => {
                  server.gameState.playerItems[key].land.forEach(land => {
                    let polygon = turf.polygon(land.features[0].geometry.coordinates);
                    if(turf.booleanIntersects(turf.point([data.payload.payload.lng, data.payload.payload.lat]), polygon)){
                      targetLand = land;
                      isOwnLand = originatorAddress === key
                    }
                  })
                });

                if(targetLand){
// the user want to go to this land
                  let accessPolicy = targetLand.features[0].properties["accessPolicy"];
                  if(accessPolicy === "public"){
                    server.gameState.playerPositions[originatorAddress] = {
                      address: originatorAddress,
                      position: data.payload.payload
                    }
                  }
                  else if(accessPolicy === "private") {
                    // not walkable
                    callback({
                      error: true,
                      message: "no-access-to-this-land",
                      data: {
                        verifies,
                        land: targetLand
                      }
                    })
                  } else {
                    // enter only holding FT or NFT's
                    let hasAccessTokens = false;
                    let requiredTokens = accessPolicy.split("\n").map(requiredToken => {
                      let parts = requiredToken.trim().split(":");
                      return {
                        unit: parts[0],
                        minQuantity: parseInt(parts[1])
                      }
                    });
                    requiredTokens.forEach(requiredToken => {
                      server.gameState.playerResources.addressData[originatorAddress].amount.forEach(amount => {
                        if(
                          amount.unit === requiredToken.unit
                          && parseInt(amount.quantity) >= requiredToken.minQuantity
                        ){
                          hasAccessTokens = true;
                        }
                      })
                    })
                    if(hasAccessTokens){
                      server.gameState.playerPositions[originatorAddress] = {
                        address: originatorAddress,
                        position: data.payload.payload
                      }
                    } else {
                      // not walkable
                      callback({
                        error: true,
                        message: "access-requires-one-of-tokens",
                        extraMessage: accessPolicy,
                        data: {
                          verifies,
                          requiredTokens
                        }
                      })
                    }
                  }
                } else {
                  server.gameState.playerPositions[originatorAddress] = {
                    address: originatorAddress,
                    position: data.payload.payload
                  }
                }
              } else if(
                data.payload.type === "buy-land"
              ){
                // update the game state
                // verify if the land is available
                ll.debug(`socket: buy-land - verifying if the land is buyable`, data);
                let isBuyable = landUtil.isBuyable(data.payload.payload, server.gameState)
                ll.debug(`socket: buy-land - the land is buyable: ${isBuyable.toString()}`, data.payload);

                // verify if the player has enought funds
                let tempLockedResources = server.computeLockedResources(server.gameState, landUtil)
                server.gameState.playerResources.lockedResources = tempLockedResources;

                let landAsset = server.gameState.assets.land;
                let landArea = landUtil.getTotalLandExtensionOfFeatureCollection(data.payload.payload);
                let assetQuantity = landUtil.areaToAsset(landAsset, landArea).quantity;
                let lockedResources = server.gameState.playerResources.lockedResources;
                let playerAddressData = server.gameState.playerResources.addressData[originatorAddress];
                let playerHasEnoughFunds = server.hasEnoughFunds(
                  originatorAddress,
                  assetQuantity,
                  landAsset,
                  lockedResources,
                  playerAddressData
                )
                ll.debug(`socket: buy-land - the player has enough funds: ${playerHasEnoughFunds.toString()}`, {
                  landAsset, landArea, addressData: this.addressData
                });

                if(isBuyable && playerHasEnoughFunds){
                  const alreadyOwnsLand = (
                    server.gameState.playerItems[originatorAddress] && server.gameState.playerItems[originatorAddress].land && server.gameState.playerItems[originatorAddress].land.length > 0
                  ) === true;
                  ll.debug(`socket: buy-land - already owns land: ${alreadyOwnsLand.toString()}`, {
                    alreadyOwnsLand
                  });
                  server.gameState.playerItems[originatorAddress] = {
                    address: originatorAddress,
                    land: alreadyOwnsLand ? [
                      ...server.gameState.playerItems[originatorAddress].land,
                      data.payload.payload
                    ] : [
                      data.payload.payload
                    ]
                  }
                } else {
                  printServerState();
                  callback({
                    error: true,
                    message: "not-enough-funds",
                    data: {
                      verifies,
                      landAsset,
                      landArea,
                      lockedResources,
                      playerAddressData
                    }
                  })
                }
              } else if(
                data.payload.type === "edit-land"
              ){
                // update the game state
                ll.debug(`socket: edit-land`);
                server.gameState.playerItems[originatorAddress].land = server.gameState.playerItems[originatorAddress].land.map(land => {
                  let savedFC = JSON.stringify(land);
                  let newFC = JSON.stringify(data.payload.payload.original);
                  if(savedFC === newFC){
                    return data.payload.payload.edited;
                  } else {
                    return land;
                  }
                })
                printServerState();
                callback({
                  verifies,
                  gameGameState: server.gameState
                })
                server.broadcastGameState("game-state");
              }  else if(
                data.payload.type === "release-land"
              ){
                // verify if the land is available
                let landUtil = new LandUtil();
                ll.debug(`socket: release-land`, {
                  data
                });
                if(
                  server.gameState.playerItems[originatorAddress]
                  && Array.isArray(server.gameState.playerItems[originatorAddress].land)
                ){
                  server.gameState.playerItems[originatorAddress].land = server.gameState.playerItems[originatorAddress].land.filter(landFeatureCollection => {
                    if(JSON.stringify(landFeatureCollection) === JSON.stringify(data.payload.payload)){
                      return false;
                    } else {
                      return true;
                    }
                  })
                }
              }
              let tempLockedResources = server.computeLockedResources(server.gameState, landUtil)
              server.gameState.playerResources.lockedResources = tempLockedResources;

              printServerState();
              callback({
                verifies,
                gameGameState: server.gameState
              })
              server.broadcastGameState("game-state");
            };
            update();
            // map the address to active sockets
            server.gameState.addressSocketMap[originatorAddress] = {
              authSocketId: authSocketId,
              gameSocketId: socket.id
            }
          }
        });
      }
      socket.on("set-client-type", (data, callback) => {
        ll.debug("socket: set-client-type", data);
        if(data.payload.type === "auth-client"){
          // unauthenticated reqeusts
          server.authClients[socket.id] = socket;
          server.authClientsPasswords[socket.id] = data.payload.password;
          // ping all clients so that they refresh all their addressData with an authenticated request.
          server.notifyGameClients({ message: "new auth client joined server" })
        } else if(data.payload === "game-client"){
          server.validateGameClientRequest(data);
          server.gameClients[socket.id] = socket;
          if(data?.headers?.address){
            updateResources(data, callback)
          }
        }
        printServerState();
      })
      socket.on("player-id", (data, callback) => {
        ll.debug("socket: player-id", data);
        updateResources(data, callback)
      });
      socket.on("player-action", (data, callback) => {
        ll.debug("socket: player-action", data);
        updateResources(data, callback);
        routine.verifyLandOwnership(landUtil, server.gameState.assets.land, server.gameState, ({
          totalUsedResources, ownedResource, address
        }) => {
          ll.info("socket: land dropped. the user has not enough funds", {
            totalUsedResources, ownedResource, address,
          });
          // drop all the users land
          delete server.gameState.playerItems[address];
          updateResources(data, callback);
        })
        updatePosition(data, callback);
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
// main.startClientUpdates(server);

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
