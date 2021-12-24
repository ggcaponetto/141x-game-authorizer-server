let turf = require('@turf/turf');

function Routine(){
  this.verifyLandOwnership = function (landUtil, gameAsset, gameState, onInsufficientFundsDetected){
    if(gameState){
      // update all player items
      if(gameState?.playerItems) {
        Object.keys(gameState.playerItems).forEach(address => {
          let totalLand = landUtil.getTotalLandExtension(address, gameState);
          let totalUsedResources = landUtil.areaToAsset(gameAsset, totalLand)

          let ownedResource = gameState.playerResources?.addressData[address]?.amount.find(amount => amount.unit === totalUsedResources.unit);
          if(ownedResource){
            let ownedResourceQuantitiy = parseFloat(ownedResource.quantity);
            if(totalUsedResources.quantity > ownedResourceQuantitiy){
              // drop the player items, the user moves his funds and doesn't have enough.
              onInsufficientFundsDetected({
                totalUsedResources, ownedResource, address
              })
            }
          }
        })
      }
    }
  }
}

function LandUtil(){
  function isBuyable(landToBuy, gameState) {
    let isBuyable = true;
    if(gameState){
      // update all player items
      if(gameState?.playerItems) {
        Object.keys(gameState.playerItems).forEach(address => {
          gameState.playerItems[address].land.forEach((land) => {
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
  function getTotalLandExtension(address, gameState){
    let totalSquareMeters = 0;
    (gameState.playerItems[address]?.land || []).forEach(landFeatureCollection => {
      totalSquareMeters = totalSquareMeters + getTotalLandExtensionOfFeatureCollection(landFeatureCollection);
    })
    return totalSquareMeters;
  }
  function getTotalLandExtensionOfFeatureCollection(landFeatureCollection){
    let area = turf.area(landFeatureCollection);
    return area;
  }
  function areaToAsset(gameAsset, area){
    return {
      quantity: gameAsset.ratio * area,
      unit: gameAsset.unit,
      type: gameAsset.type
    };
  }
  return {
    isBuyable,
    getTotalLandExtension,
    areaToAsset,
    getTotalLandExtensionOfFeatureCollection
  }
}

module.exports = {
  LandUtil,
  Routine
}
