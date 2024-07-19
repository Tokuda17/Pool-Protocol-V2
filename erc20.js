const erc20ABI = require("./ABI/erc20.json");
const gas = require("./gasPoly.js");
const web = require("./web3.js");
const utils = require("./utils.js");
const unic = require("./unicache.js");
const maps = require("./maps.js");
const web3 = web.web3;
var BigNumber = require("big-number");

let contractMap = new Map();

const MAX_RETRIES = 3;

async function initMaps(tokenAddresses) {
  try {
    let ch = web3.chain;
    console.log("erc20.init()", tokenAddresses, tokenAddresses.length, ch);
    for (let i = 0; i < tokenAddresses.length; i++) {
      //console.log("getting "+tokenAddresses[i]);
      tokenAddresses[i] = tokenAddresses[i].toLowerCase();
      if (tokenAddresses[i] != "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
        console.log("i1");
        const c = await getContract(tokenAddresses[i]);
        console.log("i2");
        let sym = await symbol(c);
        console.log("i3");
        if (sym == "USDt") sym = "USDT";
        console.log("Adding " + sym + " to maps");
        maps.symbolMap.set(tokenAddresses[i], sym);
        maps.setSymbol(tokenAddresses[i], sym, ch);
        maps.addressMap.set(sym, tokenAddresses[i]);
        maps.setAddress(sym, tokenAddresses[i], ch);
        console.log("i4");
        const dec = await decimals(c);
        maps.decimalsMap.set(sym, parseInt(dec));
        maps.setDecimals(sym, parseInt(dec), ch);
        //console.log("Adding",sym,"to maps dec=",dec);
      } else {
        let native;
        if (ch == "avax") native = "AVAX";
        else if (ch == "eth") native = "ETH";
        else if (ch == "op") native = "ETH";
        else if (ch == "poly") native = "MATIC";
        else if (ch == "arb") native = "ETH";
        else throw new Error("Unknown native token in initMaps()");
        //console.log("Adding "+native+" to maps");
        maps.symbolMap.set(tokenAddresses[i], native);
        maps.setSymbol(tokenAddresses[i], native, ch);
        maps.addressMap.set(native, tokenAddresses[i]);
        maps.setAddress(native, tokenAddresses[i], ch);
        maps.decimalsMap.set(native, 18);
        maps.setDecimals(native, 18, ch);
      }
      console.log("i3");
    }
    console.log("exiting erc20.initMaps addressMap=", maps.addressMap);
  } catch (e) {
    console.log(e.message + " erc20.initMaps() failed");
    throw Error(e.message + " => erc20.initMaps() failed");
  }
}

//*********************************************************************
// erc20 contract and methods
//*********************************************************************
async function getContract(erc) {
  try {
    if (erc.toLowerCase() == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
      throw Error(
        "trying to get contract for native token => getContract failed"
      );
    }
    const cmap = contractMap.get(erc);
    if (cmap) {
      let c = contractMap.get(erc);
      return c;
    }
    const contract = await new web3.obj.eth.Contract(erc20ABI, erc);
    contractMap.set(erc, contract);
    return contract;
  } catch (e) {
    console.log(e.message + " getContract failed");
    throw Error(e.message + " => getContract failed");
  }
}

async function allowance(contract, walletAddress, targetAddress, retries = 0) {
  const allow = await contract.methods
    .allowance(walletAddress, targetAddress)
    .call()
    .catch(function (e) {
      if (retries < MAX_RETRIES) {
        if (utils.shouldRetry(e.message)) {
          retries++;
          //await utils.sleep(retries);
          return allowance(contract, walletAddress, targetAddress, retries);
        }
      }
      console.log(e.message);
      throw new Error(e.message + " => erc20.allowance failed");
    });
  console.log("allowance", allow);
  return allow;
}

async function decimals(contract, retries = 0) {
  console.log("calling decimals", contract._address, web3.chain);
  let o = unic.readTagId("erc20.decimals", contract._address);
  if (o) {
    return o["decimals"];
  }
  const decimals = await contract.methods
    .decimals()
    .call()
    .catch(function (e) {
      if (retries < MAX_RETRIES) {
        if (utils.shouldRetry(e.message)) {
          retries++;
          //await utils.sleep(retries);
          return decimals(contract, retries);
        }
      }
      console.log(e.message);
      throw new Error(e.message + " => erc20.decimals failed");
    });
  o = { decimals: decimals };
  console.log("erc20.decimals", contract._address, o);
  unic.writeTagId("erc20.decimals", contract._address, o);
  return decimals;
}

async function balanceOf(ercContract, walletAddress, retries = 0) {
  const balance = await ercContract.methods
    .balanceOf(walletAddress)
    .call()
    .catch(function (e) {
      if (retries < MAX_RETRIES) {
        if (utils.shouldRetry(e.message)) {
          retries++;
          //await utils.sleep(retries);
          return balanceOf(ercContract, walletAddress, retries);
        }
      }
      console.log(e.message);
      throw new Error(e.message + " => erc20.balanceOf failed");
    });
  return balance;
}

async function symbol(contract, retries = 0) {
  //  console.log("c=",contract);
  let o = unic.readTagId("erc20.symbol", contract._address);
  //  console.log("s2");
  if (o) {
    //    console.log("s3");
    return o["symbol"];
  }
  //  console.log("s4");
  const symbol = await contract.methods
    .symbol()
    .call()
    .catch(function (e) {
      if (retries < MAX_RETRIES) {
        if (utils.shouldRetry(e.message)) {
          retries++;
          //await utils.sleep(retries);
          console.log("s5");
          return symbol(contract, retries);
        }
      }
      console.log("s6");
      console.log(e.message);
      throw new Error(e.message + " => erc20.symbol() failed");
    });
  o = { symbol: symbol };
  console.log("erc20.symbol", contract._address, o);
  unic.writeTagId("erc20.symbol", contract._address, o);
  return symbol;
}

// xxx this was an approve method for Alpha that is not called appropriately
async function approve(
  tokenContract,
  walletAddress,
  approveAddress,
  amount,
  retries = 0
) {
  const allow = await allowance(tokenContract, walletAddress, approveAddress);
  if (BigNumber(allow).lt(amount)) {
    let params;
    params = {
      from: walletAddress,
      gas: "800000",
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    };
    if (web3.chain == "poly") {
      params = {
        from: walletAddress,
        gas: "400000",
        maxPriorityFeePerGas: await gas.getGas(),
        nonce: await web3.obj.eth.getTransactionCount(walletAddress),
      };
    }
    const tx = await tokenContract.methods
      .approve(
        approveAddress,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      )
      .send(params)
      .catch(function (e) {
        if (retries < MAX_RETRIES) {
          if (utils.shouldRetry(e.message)) {
            retries++;
            //await utils.sleep(retries);
            return approve(
              tokenContract,
              walletAddress,
              approveAddress,
              amount,
              retries
            );
          }
        }
        console.log(e.message);
        throw new Error(e.message + " => erc20.approve failed");
      });

    if (tx.status) console.log(tx.status + " Approved");
  } else {
    console.log("approved via allowance");
  }
}

async function transfer(contract, walletAddress, targetAddress, amt) {
  let params;
  params = {
    from: walletAddress,
    gas: "80000",
    nonce: await web3.obj.eth.getTransactionCount(walletAddress),
  };
  if (web3.chain == "poly") {
    params = {
      from: walletAddress,
      gas: "80000",
      maxPriorityFeePerGas: await gas.getGas(),
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    };
  }
  console.log("transfer", walletAddress, targetAddress, amt);
  await contract.methods
    .transfer(targetAddress, amt)
    .send(params)
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => erc20.transfer failed");
    });
}
module.exports = Object.assign({
  getContract,
  decimals,
  balanceOf,
  symbol,
  approve,
  allowance,
  initMaps,
  transfer,
});
