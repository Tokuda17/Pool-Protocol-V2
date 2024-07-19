/*

outline:
while (time < timeout)
{
  while (swapRatio)
  {
    await getQuoteWithRetry()
    if (slippage ok)
    {
      executeSwap
      if (all swapped) return;
    }
    else
      swapRatio++;
  }
}


*/
const kucoin = require("./kucoin.js");
const swap = require("./swap.js");
const quote = require("./quote.js");
const inch = require("./1inch.js");
const maps = require("./maps.js");
const wall = require("./wallet.js");
const erc20 = require("./erc20.js");

const wavaxAddr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const usdcAddr = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
const usdceAddr = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";

const avaxAddr = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

async function main() {
  try {
    var wname = "lance";
    let wallet = await wall.init(wname);
    /*
  await inch.initMaps();
  await kucoin.init();
  await kucoin.getOrderbook();
  q = await kucoin.getQuote("AVAX-USDC","AVAX",500);
console.log("quote",q);
*/
    let testUsdcAmount = 1000000;
    await inch.getQuote(usdcAddr, avaxAddr, testUsdcAmount, wallet.address);
    //swap(usdceAddr,avaxAddr,2000000,wallet.address);
    /*
  swap(avaxAddr,usdcAddr,"100000000000000000",wallet.address);
  //inch.getSwapQuote(usdceAddr,avaxAddr,1000000,0.044,wallet.address,700,700);

    var wname = "lance";
    if (process.argv.length >= 3)
    {
      wname = process.argv[2];
    }
    let wallet = await wall.init(wname);
    let q;
    //let q = await quote.cgQuote("solana",5);
    //console.log("SOL quote", q);
    const pngAddr = "0x60781c2586d68229fde47564546784ab3faca982";
    const wavaxAddr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";


    //await quote.oneLoadQuotes();
    //q = await quote.oneFastQuote(pngAddr);
    //q = await quote.oneFastQuote(wavaxAddr);
    //console.log("quote",q);

    await inch.initMaps();
    let qr = await inch.getQuote(
      maps.addressMap.get("USDC"),
      wavaxAddr,
      "1000000",
      "0x0fFeb87106910EEfc69c1902F411B431fFc424FF");

    console.log("Quote response:",qr);
    await inch.getSwapQuote(
      "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664",
      "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      "1700000",
      225,
      "0x0fFeb87106910EEfc69c1902F411B431fFc424FF",
      50,300);
*/

    /*
    await inch.swap(
      "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      "1700000",
      "0x0fFeb87106910EEfc69c1902F411B431fFc424FF");
*/
  } catch (e) {
    console.log(e.message);
  }
}

main();
