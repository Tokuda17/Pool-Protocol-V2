const axios = require("axios");
require("dotenv").config();
var BigNumber = require("big-number");
const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL;
const web = require("./web3.js");
const web3 = web.web3;
const aave = require("./aave.js");

async function oneInchApprove(tokenAddress, amount, walletAddress) {
  try {
    console.log("Approving...");
    const response = await axios.get(
      `https://api.1inch.io/v4.0/43114/approve/transaction?tokenAddress=${tokenAddress}&amount=${amount}`
    );
    //console.log(response);
    if (response.data) {
      data = response.data;
      data.gas = "4000000";
      data.from = walletAddress;
      tx = await web3.eth.sendTransaction(data);
      if (tx.status) {
        await console.log(tx.status);
      }
    }
  } catch (e) {
    console.log("failed to approve" + e.message);
    throw new Error(e.message + " => oneInchApprove failed");
  }
}

async function swap(tokenContract, fromToken, toToken, amount, walletAddress) {
  console.log(`fromToken ${fromToken}, toToken${toToken}, amount ${amount} `);

  try {
    if (fromToken != "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
      await oneInchApprove(fromToken, amount, walletAddress);
    }
    console.log("getting swap quote");
    console.log(fromToken, toToken, amount, walletAddress);
    let quoteUrl = `https://api.1inch.io/v4.0/43114/swap?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}&fromAddress=${walletAddress}&slippage=1`;
    console.log("quote=", quoteUrl);
    const response = await axios.get(quoteUrl);
    console.log("swapping");
    if (response.data) {
      data = response.data;
      data.tx.gas = "1000000";
      tx = await web3.eth.sendTransaction(data.tx);
      console.log(tx.status);
    }
  } catch (e) {
    console.log("failed to swap: " + e.message);
    throw new Error(e.message + " => swap() failed");
  }
  return data.toTokenAmount;
}

async function getSwapQuote(
  fromToken,
  toToken,
  amount,
  seconds,
  walletAddress
) {
  let time = await web.getTime();
  console.log(time);
  const firstPeriod = await BigNumber(time)
    .add(BigNumber(seconds).div(3))
    .toString();
  const secondPeriod = await BigNumber(time).add(BigNumber(seconds)).toString();
  const thirdPeriod = await BigNumber(time)
    .add(BigNumber(seconds).mult(3).div(2))
    .toString();
  console.log();
  let min = "300"; //300 represents .3% slippage
  let quoteUrl;
  let response;
  let swapAmount;
  while (thirdPeriod > time) {
    time = await web.getTime();
    try {
      quoteUrl = `https://api.1inch.io/v4.0/43114/swap?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}&fromAddress=${walletAddress}&slippage=1`;
      response = await axios.get(quoteUrl);
      swapAmount = response.data.toTokenAmount;
      const target = await aave.convertFromTokenToToken(
        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
        amount,
        walletAddress
      );
      const slippage = BigNumber(target)
        .minus(BigNumber(swapAmount))
        .mult(100000) //gets three decimal places on .05 = 50; .1 = 100
        .div(swapAmount)
        .toString();

      if (
        BigNumber(slippage).lt(BigNumber(min)) &&
        BigNumber(time).lt(firstPeriod)
      ) {
        min = slippage;
      }
      console.log(slippage, min);
      if (BigNumber(slippage).lt(5000)) {
        await swapWithQuote(response, fromToken, amount, walletAddress);
        return;
      }
      if (
        BigNumber(time).gt(firstPeriod) &&
        BigNumber(slippage).lt(BigNumber(min))
      ) {
        await swapWithQuote(response, fromToken, amount, walletAddress);
        return;
      }
      if (BigNumber(time).gt(secondPeriod) && BigNumber(slippage).lt(300)) {
        await swapWithQuote(response, fromToken, amount, walletAddress);
        return;
      }
    } catch (e) {
      console.log(`failed` + e.message);
    }
  }
  try {
    //await swapWithQuote(response, fromToken, amount, walletAddress);
  } catch (e) {
    throw new Error(e.message + " => getSwapQuote() failed");
  }
}

async function swapWithQuote(response, fromToken, amount, walletAddress) {
  try {
    if (fromToken != "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
      await oneInchApprove(fromToken, amount, walletAddress);
    }
    if (response.data) {
      let data = response.data;
      data.tx.gas = "1000000";
      console.log(data);
      console.log(data.tx);
      tx = await web3.obj.eth.sendTransaction(data.tx);
      console.log(tx.status);
    }
  } catch (e) {
    throw new Error(e.message + " => swapData() failed");
  }
}

module.exports = Object.assign({
  swap,
  getSwapQuote,
});
