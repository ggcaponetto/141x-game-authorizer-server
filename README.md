# 141x-game-authorizer-server
This is a Cardano message signing app based on the [cardano-serialzation-lib](https://github.com/Emurgo/cardano-serialization-lib)
by Emurgo. This is the repository of [https://authorizer.141x.io](https://authorizer.141x.io) and is one of the gaming
utiliies for Cardano of the [https://info.141x.io](https://info.141x.io) platform. This server interacts with
 the [141x-game-authorizer](https://github.com/ggcaponetto/141x-game-authorizer).

This app is built with plain node.js and [blockfrost](https://blockfrost.io/).

````text
+-------------+
|             |           1.sends input                +-----------------------------+
| game client +--------------------------------------> |                             |
|             |                                        | 141x-game-authorizer-server |
+-------------+                                        |                             |
                                                       |        +--------------------+
+----------------------+                               |        |                    |
|                      |     2.asks for signature      |        |                    |
| 141x-game-authorizer | <-----------------------------+        |                    |
|                      |                               |        |   4.verifies       |
|                      |                               |        |    and updated     |
+------------------+---+                               |        |    game state      |
                   |                                   |        |                    |
                   +---------------------------------> |        |                    |
                           3.provides signature        |        |                    |
                                                       +--------+--------------------+
````
An example game client is [https://hoskyverse.141x.io](https://hoskyverse.141x.io)

## Getting started
1. ``git clone git@github.com:ggcaponetto/141x-game-authorizer.git``
1. ``npm i && npm start``
