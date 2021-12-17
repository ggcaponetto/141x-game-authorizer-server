const LandUtil = require("../../src/components/land-verification/land-verification").LandUtil
const gameState = require("./mock/test-game-state.json");
const fs = require("fs");
const path = require("path");
const chai = require("chai");

describe('LandUtil', function() {
  it('recognize not buyable land', async function() {
    let landUtil = new LandUtil();
    let mockLandToBuy = {
      "playerItems": {
        "somePlayer": {
          "address": "somePlayer",
          "land": [
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "id": "e705e2f78e44d72d8b02ebbed774f840",
                  "type": "Feature",
                  "properties": {},
                  "geometry": {
                    "coordinates": [
                      [
                        [
                          -73.99032004211467,
                          40.72335835569223
                        ],
                        [
                          -73.99107357415535,
                          40.723572312940405
                        ],
                        [
                          -73.9928464752328,
                          40.72005216123213
                        ],
                        [
                          -73.99017899487195,
                          40.719196738652045
                        ],
                        [
                          -73.98897216398625,
                          40.72158520971212
                        ],
                        [
                          -73.98845673068666,
                          40.72278014577515
                        ],
                        [
                          -73.9887688029968,
                          40.72284416806636
                        ],
                        [
                          -73.9892652342177,
                          40.721687124898665
                        ],
                        [
                          -73.98987630220034,
                          40.720396008127324
                        ],
                        [
                          -73.99038992189121,
                          40.71948187906736
                        ],
                        [
                          -73.99045980680594,
                          40.719415312810014
                        ],
                        [
                          -73.99207653141451,
                          40.71989432426278
                        ],
                        [
                          -73.99111547950135,
                          40.721649976084876
                        ],
                        [
                          -73.99032004211467,
                          40.72335835569223
                        ]
                      ]
                    ],
                    "type": "Polygon"
                  }
                }
              ]
            },
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "id": "6ad4f468c6e3fd4c5b0d0edc4308c1ed",
                  "type": "Feature",
                  "properties": {},
                  "geometry": {
                    "coordinates": [
                      [
                        [
                          -73.98725908086325,
                          40.72302454945006
                        ],
                        [
                          -73.98820833709497,
                          40.722011315008956
                        ],
                        [
                          -73.9875268402517,
                          40.72125901328073
                        ],
                        [
                          -73.98734147975314,
                          40.722310940165016
                        ],
                        [
                          -73.98725908086325,
                          40.72302454945006
                        ]
                      ]
                    ],
                    "type": "Polygon"
                  }
                }
              ]
            }
          ]
        }
      }
    }.playerItems.somePlayer.land[0]
    let mockGameState = gameState;
    let isBuyable = landUtil.isBuyable(mockLandToBuy, mockGameState);
    chai.expect(isBuyable).to.equal(false);
  });
  it('recognize buyable land', async function() {
    let landUtil = new LandUtil();
    let mockLandToBuy = {
      "playerItems": {
        "somePlayer": {
          "address": "somePlayer",
          "land": [
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "properties": {},
                  "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                      [
                        [
                          -1874.0112018585205,
                          40.71005225842896
                        ],
                        [
                          -1874.0157508850098,
                          40.70712443235431
                        ],
                        [
                          -1874.0109443664549,
                          40.704586878965245
                        ],
                        [
                          -1874.006996154785,
                          40.70692923937242
                        ],
                        [
                          -1874.0112018585205,
                          40.71005225842896
                        ]
                      ]
                    ]
                  }
                }
              ]
            }
          ]
        }
      }
    }.playerItems.somePlayer.land[0]
    let mockGameState = gameState;
    let isBuyable = landUtil.isBuyable(mockLandToBuy, mockGameState);
    chai.expect(isBuyable).to.equal(true);
  });
});
