let turf = require('@turf/turf');

function LandUtil(){
  function isBuyable(landToBuy, parsedGameState) {
    let isBuyable = true;
    if(parsedGameState){
      // update all player items
      if(
        parsedGameState
        && parsedGameState.playerItems
      ) {
        Object.keys(parsedGameState.playerItems).forEach(address => {
          parsedGameState.playerItems[address].land.forEach((land) => {
            land.features.forEach((feature) => {
              landToBuy.features.forEach((featureToBuy) => {
                if(turf.booleanIntersects(featureToBuy, feature)){
                  isBuyable = false;
                }
              })
            });
          })
        })
      }
    }
    return isBuyable;
  }
  return {
    isBuyable
  }
}

module.exports = {
  LandUtil
}
