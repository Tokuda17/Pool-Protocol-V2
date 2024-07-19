const utils = require("./utils.js");
const BigNumber = require("big-number");
const wall = require("./wallet.js");
const inch = require("./1inch.js");
const avax = require("./avax.js");
const maps = require("./maps.js");
const nodemailer = require("./nodemailer.js");
const erc = require("./erc20.js");
const kucoin = require("./kucoin.js");
const quote = require("./quote.js");

const wavaxAddr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const usdcAddr = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
const usdceAddr = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";

const avaxAddr = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
testAvaxAmount = "1500000000000000000";
testUsdcAmount = "2000000";

async function getQuote(
  fromToken,
  toToken,
  fromAmount,
  walletAddress,
  override = false,
  debug = ""
) {
  try {
    let inchResult = false;
    if (!override) {
      console.log("getQuote");
      inchResult = await inch.getQuote(
        fromToken,
        toToken,
        fromAmount,
        walletAddress
      );
      console.log("quoteReturned");
    }
    let kuResult = false;
    if (kucoin.supportedPair(fromToken, toToken)) {
      console.log("KUCOIN supportedPair ");
      //console.log("maps.symbolMap",maps.symbolMap);
      const fromSymbol = maps.symbolMap.get(fromToken.toLowerCase());
      const toSymbol = maps.symbolMap.get(toToken.toLowerCase());
      const fromDecimals = maps.decimalsMap.get(fromSymbol);
      console.log("swap.js fromSymbol", fromSymbol, "toSymbol", toSymbol);
      const amtScaled =
        parseInt(
          BigNumber(fromAmount)
            .div(BigNumber(10).pow(fromDecimals - 6))
            .toString()
        ) / 1000000;
      //kuResult = await kucoin.getQuote("AVAX-USDT",fromSymbol,amtScaled);
      kuResult = await kucoin.getQuote("AVAX-USDC", fromSymbol, amtScaled);
      console.log("kuResult=", kuResult);
    }
    const result = {
      inch: inchResult,
      kucoin: kuResult,
    };
    console.log("swap.getQuote result", result);
    return result;
  } catch (e) {
    console.log("swap.getQuote failed: " + e.message);
    throw new Error(e.message + " => swap.getQuote failed" + "DEBUG=" + debug);
  }
}

function setSlippage(time, startTime, seconds, minSlip, maxSlip) {
  const slip = minSlip + ((time - startTime) / seconds) * (maxSlip - minSlip);
  return slip;
}

async function findSwap(
  fromToken,
  toToken,
  fromAmount,
  seconds,
  walletAddress,
  minSlip, // set min slippage for trade
  maxSlip,
  debug = ""
) {
  // slippage increases linearly from min to max over seconds
  console.log("findSwap");
  await kucoin.init();
  console.log("getQuote");
  let q;
  let useKuCoin;
  let fromSymbol = maps.symbolMap.get(fromToken.toLowerCase());
  let toSymbol = maps.symbolMap.get(toToken.toLowerCase());
  console.log("toSymbol1", toSymbol, "fromSymbol1", fromSymbol);
  let avaxAmount;
  let limitPrice;
  console.log("findSwap", fromAmount, seconds, minSlip, maxSlip);

  const startTime = Date.now();
  seconds *= 1000;
  let swapAmount;
  var SLIPPAGE;
  let time = Date.now();

  while (time < startTime + seconds) {
    try {
      SLIPPAGE = setSlippage(time, startTime, seconds, minSlip, maxSlip);
      await kucoin.getOrderbook();
      q = await getQuote(
        fromToken,
        toToken,
        fromAmount,
        walletAddress,
        false,
        debug
      );

      useKuCoin = false;
      swapAmount = q.inch.toAmount;

      if (q.kucoin !== false) {
        if (q.inch.toAmount < q.kucoin.toAmount) {
          let fSymbol;
          let decimals;
          if (avax.isNativeEquivalent(fromSymbol)) {
            fSymbol = "AVAX";
            decimals = 18;
          } else {
            fSymbol = "USDC";
            decimals = 6;
          }
          const kuAmount = await kucoin.getPosition(fSymbol);
          if (
            BigNumber(Math.floor(kuAmount * 1000000))
              .mult(BigNumber(10).pow(decimals - 6))
              .gt(fromAmount)
          ) {
            swapAmount = q.kucoin.toAmount;
            useKuCoin = true;
            console.log("quoting from kucoin", swapAmount);
          }
        }
      } else {
        console.log("quoting from 1inch", swapAmount);
      }
      await quote.oneLoadQuotes();
      let target = await inch.convertAmount(fromToken, toToken, fromAmount);
      const toDecimals = maps.decimalsMap.get(toSymbol);
      console.log("toDecimals", toDecimals, toSymbol);
      console.log(
        "target",
        target,
        "swapAmount",
        swapAmount,
        "seconds",
        seconds,
        Math.floor((time - startTime) / 1000)
      );
      const slippage =
        ((parseInt(
          BigNumber(target)
            .div(BigNumber(10).pow(toDecimals - 6))
            .toString()
        ) /
          1000000 -
          swapAmount) /
          swapAmount) *
        100000;
      console.log("slippage (300 = 0.3%):", slippage, "SLIPPAGE", SLIPPAGE);

      if (slippage <= SLIPPAGE) {
        console.log("findSwap SWAPPING", fromAmount);
        try {
          if (useKuCoin) {
            // xxx this section only works for trading USDC/AVAX, need to change if we add more pairs
            let avaxAmount;
            let limitPrice = q.kucoin.limitPrice;
            if (avax.isNativeEquivalent(fromSymbol)) {
              fromSymbol = "AVAX";
              //toSymbol = "USDT";
              toSymbol = "USDC";
              let avaxPrice = quote.oneQuote("WAVAX");
              console.log("findSwap WAVAX price", avaxPrice);
              avaxAmount = q.kucoin.toAmount / avaxPrice;
            } else {
              //fromSymbol = "USDT";
              fromSymbol = "USDC";
              toSymbol = "AVAX";
              avaxAmount = q.kucoin.toAmount;
            }
            // xxx check and possibly use limit price equal to 1inch quote price since we
            // we don't want anything filled above a price that 1inch can swap
            console.log(
              "findSwap.trade KUCOIN",
              fromSymbol,
              toSymbol,
              limitPrice,
              avaxAmount
            );
            //utils.sleep(4);
            await kucoin.trade(fromSymbol, toSymbol, limitPrice, avaxAmount);
            await utils.sleep(5);
            await kucoin.cancelOrders();
            let mtime = Math.floor(Date.now() / 1000);
            let subject = "KuCoin findSwap() " + mtime;
            let body = "Using KuCoin\n";
            //body += "\n"+JSON.stringify(q,null,2)+"\n";
            nodemailer.sendMail(subject, body);
          } else {
            console.log("findSwap.trade 1INCH", fromToken, fromAmount);
            //utils.sleep(4);
            await inch.swapWithQuote(
              q.inch.quoteData,
              fromToken,
              fromAmount,
              walletAddress
            );
            let mtime = Math.floor(Date.now() / 1000);
            let subject = "1inch findSwap() " + mtime;
            let body = "Using 1inch\n";
            //body += "\n"+JSON.stringify(q,null,2)+"\n";
            nodemailer.sendMail(subject, body);
          }
          console.log("swap.findSwap() SWAP SUCCEEDED");
          return true;
        } catch (e) {
          console.log("swap.findSwap() SWAP FAILED", e.message);
        }
        break;
      }
      await utils.sleep(4);
      time = Date.now();
    } catch (e) {
      console.log(
        "findSwap pricing failed amount=" +
          fromAmount +
          " minSlippage=" +
          minSlip +
          " " +
          e.message
      );
      throw new Error(
        e.message +
          " => findSwap() failed " +
          fromAmount +
          " minSlippage=" +
          minSlip
      );
    }
  }
  return false;
}

async function swap(
  fromToken,
  toToken,
  fromAmount,
  walletAddress,
  override = false,
  debug = ""
) {
  try {
    await kucoin.init();
    await kucoin.getOrderbook();
    const q = await getQuote(
      fromToken,
      toToken,
      fromAmount,
      walletAddress,
      override,
      debug
    );
    let useKuCoin = false;
    //console.log("swap.swap quote found", q, q.kucoin);
    let fromSymbol;
    let toSymbol;
    let avaxAmount;
    let limitPrice;
    if (
      q.kucoin !== false &&
      (q.kucoin.toAmount > q.inch.toAmount || override)
    ) {
      //console.log("q.kucoin is not false");
      let decimals;
      let toAmount = q.kucoin.toAmount;
      fromSymbol = maps.symbolMap.get(fromToken.toLowerCase());
      console.log("fromSymbol", fromSymbol);
      if (avax.isNativeEquivalent(fromSymbol)) {
        fromSymbol = "AVAX";
        toSymbol = "USDC";
        decimals = 18;
        avaxAmount =
          parseFloat(
            BigNumber(fromAmount)
              .div(BigNumber(10).pow(18 - 3))
              .toString()
          ) / 1000;
        console.log("here1");
      } else if (avax.isStablecoin(fromSymbol)) {
        fromSymbol = "USDC";
        toSymbol = "AVAX";
        decimals = 6;
        avaxAmount = parseFloat(Math.floor(1000 * q.kucoin.toAmount)) / 1000;
        console.log("here2");
      } else {
        //console.log("here3");
        throw new Error("Unsupported token " + fromSymbol);
      }
      if (override) {
        const fromAmount2 = BigNumber(fromAmount).div(3).toString();
        const amtScaled =
          parseInt(
            BigNumber(fromAmount2)
              .div(BigNumber(10).pow(decimals - 6))
              .toString()
          ) / 1000000;
        //let q2 = await kucoin.getQuote("AVAX-USDT",fromSymbol,amtScaled,override);
        let q2 = await kucoin.getQuote(
          "AVAX-USDC",
          fromSymbol,
          amtScaled,
          override
        );
        limitPrice = parseFloat(q2.limitPrice);
      } else {
        limitPrice = parseFloat(q.kucoin.limitPrice);
      }
      console.log(fromSymbol, decimals);
      const kuAmount = await kucoin.getPosition(fromSymbol);
      console.log(fromSymbol, "KuCoin holdings", kuAmount);
      if (
        BigNumber(Math.floor(kuAmount * 1000000))
          .mult(BigNumber(10).pow(decimals - 6))
          .gt(fromAmount)
      ) {
        console.log("here2");
        useKuCoin = true;
        console.log("swap.swap useKuCoin = true");
      } else if (override) {
        throw new Error("1inch failing and not enough coins in KuCoin");
      }
      console.log("here3");
    }
    //useKuCoin = true;
    if (!useKuCoin) {
      console.log("swapping with Quote - calling 1inch");
      await inch.swapWithQuote(
        q.inch.quoteData,
        fromToken,
        fromAmount,
        walletAddress
      );
      let mtime = Math.floor(Date.now() / 1000);
      let subject = "1inch swap() " + mtime;
      let body = "Using 1inch\n";
      //body += "\n"+JSON.stringify(q,null,2)+"\n";
      nodemailer.sendMail(subject, body);
      console.log("here1");
    } else {
      console.log("kucoin.trade", fromSymbol, toSymbol, limitPrice, avaxAmount);
      await kucoin.trade(fromSymbol, toSymbol, limitPrice, avaxAmount);
      let mtime = Math.floor(Date.now() / 1000);
      let subject = "KuCoin swap() " + mtime;
      let body = "Using KuCoin\n";
      if (override) {
        subject += " override=true";
        body += "override=true\n";
        await utils.sleep(15);
      }
      await utils.sleep(5);
      await kucoin.cancelOrders();
      //body += "\n"+JSON.stringify(q,null,2)+"\n";
      nodemailer.sendMail(subject, body);
      console.log("here2");
    }
  } catch (e) {
    console.log(e.message, "swap failed");
    throw new Error(e.message + " swap() failed");
  }
}

//swap(avaxAddr,usdcAddr,amount,waddr);
async function main() {
  var wname = "lance";
  let wallet = await wall.init(wname);
  await inch.initMaps();
  await kucoin.init();
  await kucoin.getOrderbook();
  //getQuote(avaxAddr,usdcAddr,testAvaxAmount,wallet.address);
  //getQuote(usdceAddr,avaxAddr,testUsdcAmount,wallet.address);
  //swap(usdceAddr,avaxAddr,2000000,wallet.address);
  swap(avaxAddr, usdcAddr, "100000000000000000", wallet.address);
  //inch.getSwapQuote(usdceAddr,avaxAddr,1000000,0.044,wallet.address,700,700);
}

//main();

module.exports = Object.assign({
  swap,
  findSwap,
  getQuote,
});
