const GameServer = require("../../src/index").GameServer
const fs = require("fs");
const path = require("path");
const chai = require("chai");

describe('GameServer', function() {
  describe('save and load the game-state into a file', function() {
    it('should save and load', async function() {
      let gs = new GameServer();
      let mockGameState = {some: "state", rnd: Math.random()};
      gs.setGameState(mockGameState);
      await gs.saveGameState(path.resolve(`${__dirname}/tmp/test-game-state.json`));
      let restored = await gs.loadGameState(path.resolve(`${__dirname}/tmp/test-game-state.json`));
      chai.expect(JSON.stringify(mockGameState)).to.equal(JSON.stringify(restored));
      chai.expect(JSON.stringify(mockGameState)).to.equal(JSON.stringify(gs.getGameState()));
    });
  });
});
