const op = require("./op.js");
const poly = require("./poly.js");
const avax = require("./avax.js");
const gas = require("./gasPoly.js");

let ch = false;

function chainId(chain = false) {
  if (chain) ch = chain;
  if (ch == "avax") id = 43114;
  else if (ch == "op") id = 10;
  else if (ch == "eth") id = 1;
  else if (ch == "poly") id = 137;
  else if (ch == "arb") id = 42161;
  else {
    throw new Error("chainId " + ch + " not found => chainId()");
  }
  return id;
}

function isEthEquivalent(sym) {
  //console.log ("isEthEquivalent");
  return ["ETH", "WETH", "WETH.E"].includes(sym.toUpperCase());
}

function isNative(sym, chain = false) {
  if (chain) ch = chain;
  if (ch == "op") return op.isNative(sym);
  else if (ch == "poly") return poly.isNative(sym);
  else if (ch == "avax") return avax.isNative(sym);
  else {
    throw new Error("Unknown chain in chain.isNative");
  }
}
function isNativeEquivalent(sym, chain = false) {
  sym = sym.toUpperCase();
  if (chain) ch = chain;
  if (ch == "op") return op.isNativeEquivalent(sym);
  else if (ch == "poly") return poly.isNativeEquivalent(sym);
  else if (ch == "avax") return avax.isNativeEquivalent(sym);
  else if (ch == "arb") return ["ETH", "WETH"].includes(sym);
  else {
    throw new Error("Unknown chain in chain.isNativeEquivalent");
  }
}

function isStablecoin(sym, chain = false) {
  //console.log("iss1");
  sym = sym.toUpperCase();
  //console.log("isStablecoin() sym=",sym,"chain=",chain);
  if (chain) ch = chain;
  if (ch == "op") {
    //console.log("iss2");
    return op.isStablecoin(sym);
  } else if (ch == "poly") {
    //console.log("iss3");
    return poly.isStablecoin(sym);
  } else if (ch == "avax") {
    //console.log("iss4");
    return avax.isStablecoin(sym);
  } else if (ch == "arb") {
    //console.log("iss5");
    return ["USDC"].includes(sym);
  } else {
    throw new Error("Unknown chain in chain.isStablecoin ch=" + ch);
  }
}

let ETH_ADDRESS;
let MATIC_ADDRESS;
let WETH_ADDRESS;
let USDC_ADDRESS;
let USDCe_ADDRESS;

function init(chain) {
  console.log("chain.init", chain);
  ch = chain;
  //console.log("ch",ch);
  if (ch == "op") {
    ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
    USDC_ADDRESS = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";
    //console.log("chain.init addresses: ",WETH_ADDRESS,USDC_ADDRESS);
  } else if (ch == "poly") {
    ETH_ADDRESS = false;
    MATIC_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
    USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
  } else if (ch == "avax") {
    ETH_ADDRESS = false;
    WETH_ADDRESS = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";
    USDC_ADDRESS = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
    USDCe_ADDRESS = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
  } else if (ch == "eth") {
    ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  } else if (ch == "arb") {
    ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    USDC_ADDRESS = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
  } else {
    throw new Error("Unknown chain in chain.defaultInit");
  }
  //console.log("chain.init WETH_ADDRESS=", WETH_ADDRESS);
}

function getAddress(sym) {
  sym = sym.toUpperCase();
  if (sym == "ETH") return ETH_ADDRESS;
  else if (sym == "WETH") return WETH_ADDRESS;
  else if (sym == "USDC") return USDC_ADDRESS;
  else if (sym == "USDC.E") return USDCe_ADDRESS;
  else if (sym == "MATIC") return MATIC_ADDRESS;
  else if (sym == "USDC.E") return USDCe_ADDRESS;
  else {
    throw new Error("chain.getAddress() unknown symbol " + sym);
  }
}

module.exports = Object.assign({
  init,
  getAddress,
  chainId,
  isNative,
  isNativeEquivalent,
  isEthEquivalent,
  isStablecoin,
});
