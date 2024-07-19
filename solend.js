const axios = require("axios");
require("dotenv").config();
var BigNumber = require("big-number");
const wall = require("./wallet.js");
const web = require("./web3.js");
const web3 = web.web3;

function getPositions(list, mult) {
  var pos = [];
  for (let i = 0; i < list.length; i++) {
    let newpos;
    if (mult == 1) {
      newpos = {
        symbol: list[i].symbol,
        amount: list[i].depositedAmount,
        usd: list[i].valueUSD,
      };
    } else {
      newpos = {
        symbol: list[i].symbol,
        amount: -list[i].borrowedAmount,
        usd: -list[i].valueUSD,
      };
    }
    pos.push(newpos);
  }
  return pos;
}

async function getPosition(walletAddress) {
  try {
    const solendUrl =
      "https://api.solend.fi/v1/user-overview?wallet=" + walletAddress;
    var positions = await axios.get(solendUrl);
    console.log("positions.data", positions.data);
    const storeAddr = "4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY";
    positions = positions.data[storeAddr];
    console.log(positions);
    const deposits = positions.deposits;
    const borrows = positions.borrows;
    var pos = [];
    pos = getPositions(deposits, 1);
    pos = pos.concat(getPositions(borrows, -1));
    return pos;
  } catch (e) {
    console.log("getPositions error" + e.message);
    throw new Error(e.message + " => getPositions failed");
  }
}

function isNativeEquivalent(sym) {
  return ["SOL", "STSOL"].includes(sym.toUpperCase());
}

function isStablecoin(sym) {
  return ["USDC", "USDT"].includes(sym.toUpperCase());
}

async function calculateNetPosition(walletAddress) {
  try {
    const pos = await getPosition(walletAddress);
    console.log("pos", pos);
    var stable = 0;
    var native = 0;
    for (let i = 0; i < pos.length; i++) {
      if (isNativeEquivalent(pos[i].symbol)) {
        native += parseFloat(pos[i].usd);
      } else if (isStablecoin(pos[i].symbol)) {
        stable += parseFloat(pos[i].usd);
      }
    }
    console.log("native", native);
    console.log("stable", stable);
  } catch (e) {
    console.log("calculateNetPosition error" + e.message);
    throw new Error(e.message + " => calculateNetPosition failed");
  }
}

module.exports = Object.assign({
  calculateNetPosition,
});
