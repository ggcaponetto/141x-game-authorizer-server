const CardanoWasmModule = require("@emurgo/cardano-serialization-lib-nodejs");
const BIP39 = require("bip39");
const loglevel =  require('loglevel');
const axios =  require('axios');

const ll = loglevel.getLogger('main');
if (process.env.NODE_ENV === 'production') {
  ll.setLevel(ll.levels.ERROR);
} else {
  ll.setLevel(ll.levels.DEBUG);
}

const CardanoWasm = CardanoWasmModule;

function Verifier(){
  this.CardanoWasm = CardanoWasm;
  this.BIP39 = BIP39;
  this.getAddressPrefix = function (network){
    if(network === "mainnet"){
      return "addr";
    } else if(network === "testnet") {
      return "addr_test";
    } else {
      throw new Error("unknown network");
    }
  }
  this.verify = function (network, message, verificationResponseMessage, originatorAddress){
    let parsedSigned = JSON.parse(verificationResponseMessage);
    let payload = parsedSigned.payload;
    let headers = parsedSigned.headers;
    let publicKeys = headers["public-keys"];

    let signatureIsVerified = false;
    let addressCanBeDerivedFromPublicKeys = false;
    if(
      publicKeys.key_pub_bech32 !== undefined
      && publicKeys.stake_key_public_bech32 !== undefined
    ){
      let key_pub = this.CardanoWasm.Bip32PublicKey.from_bech32(publicKeys.key_pub_bech32);
      let stake_key_pub = this.CardanoWasm.Bip32PublicKey.from_bech32(publicKeys.stake_key_public_bech32);

      let signatureObject = this.CardanoWasm.Ed25519Signature.from_hex(payload);
      signatureIsVerified = key_pub.to_raw_key().verify(message, signatureObject);

      let reconstructedBaseAddress = this.CardanoWasm.BaseAddress.new(
        this.CardanoWasm.NetworkInfo[`${network}`]().network_id(),
        this.CardanoWasm.StakeCredential.from_keyhash(key_pub.to_raw_key().hash()),
        this.CardanoWasm.StakeCredential.from_keyhash(stake_key_pub.to_raw_key().hash()),
      ).to_address();
      let reconstructedBaseAddress_bech32 = reconstructedBaseAddress.to_bech32(this.getAddressPrefix(network));
      addressCanBeDerivedFromPublicKeys = reconstructedBaseAddress_bech32 === originatorAddress;
    } else {
      throw new Error("could not verify the message signature. ensure that the public keys include the key_pub_bech32 and stake_key_public_raw_hash keys.");
    }
    // ll.debug(`the message ${message} has a valid signature ${payload} from address ${originatorAddress}: ${signatureIsVerified}`);
    // ll.debug(`the address ${originatorAddress} can be reconstructed from the public keys in the header: ${addressCanBeDerivedFromPublicKeys}`);
    return signatureIsVerified && addressCanBeDerivedFromPublicKeys;
  }
  this.getAccountData = async function (network, address){
    let res = await axios({
      method: 'get',
      url: `https://cardano-${network}.blockfrost.io/api/v0/addresses/${address}`,
      headers: {
        "project_id": `${process.env[`BLOCKFROST_API_KEY_${`${network}`.toUpperCase()}`]}`
      }
    });
    return res;
  }
}

module.exports = {
  Verifier
}
