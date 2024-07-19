const Web3 = require("web3");
const ethers = require("ethers");
require("dotenv").config();
const chain = require("./chain.js");
const gas = require("./gasPoly.js");

const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL;
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL;
const OPTIMISM_RPC_URL = process.env.OPTIMISM_RPC_URL;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL;

const web3avax = new Web3(AVALANCHE_RPC_URL);
const web3eth = new Web3(ETHEREUM_RPC_URL);
const web3op = new Web3(OPTIMISM_RPC_URL);
const web3poly = new Web3(POLYGON_RPC_URL);
const web3arb = new Web3(ARBITRUM_RPC_URL);

const providerOp = new ethers.providers.JsonRpcProvider(
  "https://opt-mainnet.g.alchemy.com/v2/rHtq3eFE7jm_xUmUNJOOOg4LR9wngukb"
);
const providerPoly = new ethers.providers.JsonRpcProvider(
  "https://polygon-mainnet.g.alchemy.com/v2/AmllS7MVSHEnkL8dxIWD0QiDQhMWe5Ry"
);
const providerArb = new ethers.providers.JsonRpcProvider(
  "https://arb-mainnet.g.alchemy.com/v2/-aIjTJiAjkaQVE7aJio0ew42h0b39iZf"
);
const providerEth = new ethers.providers.JsonRpcProvider(
  "https://eth-mainnet.g.alchemy.com/v2/0cbue9UUJ2iTntNKop8bnJTujqtNAwbS"
);

let web3 = {
  chain: "avax",
  chainid: 43114,
  maxPriorityFeePerGas: false,
  obj: web3avax,
  url: AVALANCHE_RPC_URL,
  ethers: {
    op: { provider: providerOp, wallet: false },
    poly: { provider: providerPoly, wallet: false },
    arb: { provider: providerArb, wallet: false },
    eth: { provider: providerEth, wallet: false },
  },
  fusion: {
    op: false,
    poly: false,
    arb: false,
    eth: false,
  },
};

function getFusion(ch) {
  let f = web3.fusion[ch];
  if (!f) throw new Error("getFusion(" + ch + ") failed");
  return f;
}

function getEthersAlchemy(ch = false) {
  if (!ch) ch = web3.chain;
  //console.log("web3=",web3);
  let w = web3.ethers[ch].alchemy;
  if (w) return w;
  throw new Error("Could not find alchemy in web3.getEthersAlchemy()");
}

function getEthersWallet(ch = false) {
  if (!ch) ch = web3.chain;
  let e = web3.ethers[ch];
  if (!e || !e.wallet)
    throw new Error("Unknown chain " + ch + " in web3.getEthersWallet()");
  return e.wallet;
}

function getEthersProvider(ch = false) {
  if (!ch) ch = web3.chain;
  let e = web3.ethers[ch];
  if (!e || !e.provider)
    throw new Error("Unknown chain " + ch + " in web3.getEthers()");
  return e.provider;
}

async function init(ch) {
  console.log("web3.init", ch);
  if (ch == "avax") {
    //console.log("setting URL=",AVALANCHE_RPC_URL);
    web3.chain = "avax";
    web3.obj = web3avax;
    web3.url = AVALANCHE_RPC_URL;
  } else if (ch == "op") {
    //console.log("setting URL=",OPTIMISM_RPC_URL);
    web3.chain = "op";
    web3.obj = web3op;
    web3.url = OPTIMISM_RPC_URL;
  } else if (ch == "eth") {
    //console.log("setting URL=",ETHEREUM_RPC_URL);
    web3.chain = "eth";
    web3.obj = web3eth;
    web3.url = ETHEREUM_RPC_URL;
  } else if (ch == "poly") {
    //console.log("setting URL=",POLYGON_RPC_URL);
    web3.chain = "poly";
    web3.obj = web3poly;
    web3.url = POLYGON_RPC_URL;
    web3.maxPriorityFeePerGas = await gas.getGas();
  } else if (ch == "arb") {
    //console.log("setting URL=",ARBITRUM_RPC_URL);
    web3.chain = "arb";
    web3.obj = web3arb;
    web3.url = ARBITRUM_RPC_URL;
  } else throw Error("chain not defined in web3.js web3.init()");
  chain.init(web3.chain);
  //console.log("web3.init() WETH_ADDRESS",chain.getAddress("WETH"));
  web3.chainid = chain.chainId();
}

/*
async function getTime() {
  const blockNumber = await web3.obj.eth.getBlockNumber();
  const block = await web3.obj.eth.getBlock(blockNumber);
  const time = await block.timestamp;
  return time;
}
*/

module.exports = Object.assign({
  web3,
  getFusion,
  init,
  getEthersProvider,
  getEthersWallet,
  getEthersAlchemy,
});
