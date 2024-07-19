const kucoin = require("./kucoin.js");
const quote = require("./quote.js");
const inch = require("./1inch.js");
const chain = require("./chain.js");
const wall = require("./wallet.js");
const swap = require("./swap.js");
const erc20 = require("./erc20.js");
const BigNumber = require("big-number");

let wavaxAddr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
let usdcAddr = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
let usdceAddr = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
let avaxAddr = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

async function main() {
  try {
    var wname = "lance";
    let wallet = await wall.init(wname, "poly");
    await inch.swap(
      chain.getAddress("WETH"),
      chain.getAddress("USDC"),
      "10000000000000000",
      wallet.address
    );
    /*
    const pngAddr = "0x60781c2586d68229fde47564546784ab3faca982";

    //await quote.oneLoadQuotes();
    q = await quote.oneFastQuote(pngAddr);
    console.log("quote",q);
  await inch.initMaps();
  //await kucoin.init();
  //await kucoin.getOrderbook();
  let testAvaxAmount = BigNumber(10).pow(16).toString();
  //swap.getQuote(avaxAddr,usdcAddr,testAvaxAmount,wallet.address);
  //swap.getQuote(usdceAddr,avaxAddr,testUsdcAmount,wallet.address);
  //swap(usdceAddr,avaxAddr,2000000,wallet.address);
console.log("here3");
  //swap.findSwap(usdceAddr,avaxAddr,1000000,30,wallet.address,100,300);
  //swap.findSwap(avaxAddr,usdceAddr,"100000000000000000",30,wallet.address,100,300);

  //await inch.getSwapQuote("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E","0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E","1000000000000000000",225,"0x0fFeb87106910EEfc69c1902F411B431fFc424FF");

//    await inch.getSwapQuote(
//      "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664",
//      "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
//      "1700000",
//      225,
//      "0x0fFeb87106910EEfc69c1902F411B431fFc424FF",
//      50,300);
*/

    console.log("calling inch.swap");
    await inch.swap(
      chain.getAddress("USDC"),
      chain.getAddress("WETH"),
      "100000",
      "0x0fFeb87106910EEfc69c1902F411B431fFc424FF"
    );
  } catch (e) {
    console.log(e.message);
  }
}

main();
