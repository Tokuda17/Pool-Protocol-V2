const erc20ABI = require("./ABI/erc20.json");
const gas = require("./gasPoly.js");
const ethers = require("ethers");
const web = require("./web3.js");
const utils = require("./utils.js");
const unic = require("./unicache.js");
const maps = require("./maps.js");
const web3 = web.web3;
var BigNumber = require("big-number");

let contractMaps = new Map();

const MAX_RETRIES = 3;

function getContractMap(ch) {
  let c = contractMaps.get(ch);
  if (c) return c;
  else {
    contractMaps.set(ch, new Map());
    return contractMaps.get(ch);
  }
}

function getContractFromMaps(ch, erc) {
  let cm = getContractMap(ch);
  let c = cm.get(erc);
  if (!c) return false;
  return c;
}

function setContractInMaps(ch, erc, c) {
  let cm = getContractMap(ch);
  cm.set(erc, c);
}

//*********************************************************************
// erc20 contract and methods
//*********************************************************************
async function getContract(erc, ch) {
  try {
    if (erc.toLowerCase() == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
      throw Error(
        "trying to get contract for native token => getContract failed"
      );
    }
    c = getContractFromMaps(ch, erc);
    if (c) return c;
    provider = web.getEthersProvider(ch);
    //console.log("provider=",provider);
    let signer = web.getEthersWallet(ch);
    //console.log("signer=",signer);
    const contract = new ethers.Contract(erc, erc20ABI, signer);
    //console.log("contract=",contract);
    setContractInMaps(ch, erc, contract);
    return contract;
  } catch (e) {
    console.log(e.message + " getContract failed");
    throw Error(e.message + " => getContract failed");
  }
}

async function allowance(contract, walletAddress, targetAddress, retries = 0) {
  //  console.log("allowance",contract,walletAddress,targetAddress);
  try {
    const allow = await contract.allowance(walletAddress, targetAddress);
    console.log("allowance contract=", contract);
    return allow.toString();
  } catch (e) {
    if (retries < MAX_RETRIES) {
      if (utils.shouldRetry(e.message)) {
        retries++;
        await utils.sleep(retries);
        return allowance(contract, walletAddress, targetAddress, retries);
      }
    }
    console.log(e.message);
    throw new Error(e.message + " => erc20e.allowance failed");
  }
}

async function decimals(contract, retries = 0) {
  console.log("calling decimals", contract.address, web3.chain);
  try {
    let o = unic.readTagId("erc20.decimals", contract.address);
    if (o) {
      return o["decimals"];
    }
    const decimals = await contract.decimals();
    o = { decimals: decimals };
    console.log("erc20.decimals", contract.address, o);
    unic.writeTagId("erc20.decimals", contract.address, o);
    return parseInt(decimals);
  } catch (e) {
    if (retries < MAX_RETRIES) {
      if (utils.shouldRetry(e.message)) {
        retries++;
        await utils.sleep(retries);
        return decimals(contract, retries);
      }
    }
    console.log(e.message);
    throw new Error(e.message + " => erc20e.decimals failed");
  }
}

async function balanceOf(ercContract, walletAddress, retries = 0) {
  try {
    const balance = await ercContract.balanceOf(walletAddress);
    return balance.toString();
  } catch (e) {
    if (retries < MAX_RETRIES) {
      if (utils.shouldRetry(e.message)) {
        retries++;
        await utils.sleep(retries);
        return balanceOf(ercContract, walletAddress, retries);
      }
    }
    console.log(e.message);
    throw new Error(e.message + " => erc20e.balanceOf() failed");
  }
}

async function symbol(contract, retries = 0) {
  try {
    let o = unic.readTagId("erc20.symbol", contract.address);
    if (o && false) {
      return o["symbol"];
    }
    const symbol = await contract.symbol();
    o = { symbol: symbol };
    unic.writeTagId("erc20.symbol", contract.address, o);
    return symbol;
  } catch (e) {
    if (retries < MAX_RETRIES) {
      if (utils.shouldRetry(e.message)) {
        retries++;
        await utils.sleep(retries);
        return symbol(contract, retries);
      }
    }
    console.log(e.message);
    throw new Error(e.message + " => erc20e.symbol() failed");
  }
}

module.exports = Object.assign({
  getContract,
  decimals,
  balanceOf,
  symbol,
  allowance,
});
