let turf = require('@turf/turf');

function LandUtil(){
  function isBuyable(landToBuy, parsedGameState) {
    let isBuyable = true;
    if(parsedGameState){
      // update all player items
      if(parsedGameState?.gameState?.playerItems) {
        Object.keys(parsedGameState.gameState.playerItems).forEach(address => {
          parsedGameState.gameState.playerItems[address].land.forEach((land) => {
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
  function getTotalLandExtension(address, parsedGameState){
    let totalSquareMeters = 0;
    (parsedGameState?.playerItems[address]?.land || []).forEach(landFeatureCollection => {
      totalSquareMeters = totalSquareMeters + getTotalLandExtensionOfFeatureCollection(landFeatureCollection);
    })
    return totalSquareMeters;
  }
  function getTotalLandExtensionOfFeatureCollection(landFeatureCollection){
    let area = turf.area(landFeatureCollection);
    return area;
  }
  function areaToAssetQuantity(gameAsset, area){
    return gameAsset.ratio * area;
  }
  return {
    isBuyable,
    getTotalLandExtension,
    areaToAssetQuantity,
    getTotalLandExtensionOfFeatureCollection
  }
}

module.exports = {
  LandUtil
}
