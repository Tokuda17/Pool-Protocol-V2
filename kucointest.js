var BigNumber = require("big-number");
const avax = require("./avax.js");
const maps = require("./maps.js");
require("dotenv").config();
const kucoin = require("kucoin-node-api");

const config = {
  apiKey: process.env.KUCOIN_API_KEY,
  secretKey: process.env.KUCOIN_SECRET_KEY,
  passphrase: process.env.KUCOIN_PASSPHRASE,
  environment: "live",
};

let orderBook = { book: null };

function check(result) {
  if (!result) {
    console.log("empty result");
    throw new Error("empty result => check()");
  } else if (!result.code) {
    console.log("missing code field");
    throw new Error(result + " missing code field => check()");
  } else if (result.code != 200000) {
    console.log("code not equal to 200000");
    throw new Error(result.code + " code not equal to 200000 => check()");
  }
  return result.data;
}

async function trade(fromSymbol, toSymbol, price, avaxAmount) {
  try {
    let tid = Math.floor(Date.now() / 1000);
    let side = "buy";
    console.log("trade fromSymbol=", fromSymbol);
    if (fromSymbol == "AVAX") side = "sell";
    let params = {
      clientOid: "PoolProtocol" + tid,
      side: side, // buying AVAX
      symbol: "AVAX-USDT",
      type: "limit",
      price: price,
      size: Math.floor(avaxAmount * 1000) / 1000,
      timeInForce: "GTC",
      hidden: "true",
    };
    console.log("calling placeOrder", params);
    let result = await kucoin.placeOrder(params);
    console.log("result=", result);
  } catch (e) {
    console.log(e.message + " => trade()");
    throw new Error(e.message + " => trade()");
  }
}

async function getPosition(sym) {
  try {
    params = { currency: sym, type: "trade" };
    let result = check(await kucoin.getAccounts(params));
    result = parseFloat(result[0].balance);
    //console.log("kucoin.getPosition", result);
    return result;
  } catch (e) {
    console.log(e.message + " => getPosition()");
    throw new Error(e.message + " => getPosition()");
  }
}

async function getPositions() {
  try {
    let coins = ["USDC", "AVAX", "USDT"];
    let positions = [];
    let params;
    for (let i = 0; i < coins.length; i++) {
      let decimals;
      if (avax.isNative(coins[i])) decimals = 18;
      else decimals = maps.decimalsMap.get(coins[i]);
      params = { currency: coins[i], type: "trade" };
      let result = check(await kucoin.getAccounts(params));
      result = result[0];
      console.log("getPosition", coins[i], result);
      let pos = {
        id: "kucoin-trade",
        symbol: result.currency,
        amount: BigNumber(Math.floor(1000000 * result.balance))
          .mult(BigNumber(10).pow(decimals))
          .div(1000000)
          .toString(),
        decimals: decimals,
      };
      positions = positions.concat(pos);
    }
    console.log("Positions:", positions);
    return positions;
  } catch (e) {
    console.log(e.message + " => getPositions()");
    throw new Error(e.message + " => getPositions()");
  }
}

async function init() {
  kucoin.init(config);
}

async function getOrderbook() {
  try {
    let data = await kucoin.getPartOrderBook({
      amount: 100,
      symbol: "AVAX-USDT",
    });
    //console.log("data=",data);
    if (!data) throw new Error("empty response");
    if (data.code != 200000)
      throw new Error("Error code " + data.code + " returned");
    orderBook.book = data.data;
    //console.log("orders=",orderBook);
  } catch (e) {
    console.log(e.message + " => main()");
  }
}

const TRADE_FEE = 0.001;

function convertSell(orders, amount) {
  // amount of coins received
  let toAmount = 0;
  let unfilled = amount;
  let limitPrice;
  let i;
  for (i = 0; i < orders.length; i++) {
    if (orders[i][1] >= unfilled) {
      toAmount += unfilled * orders[i][0];
      limitPrice = parseFloat(orders[i][0]);
      break;
    } else {
      toAmount += parseFloat(orders[i][1]) * orders[i][0];
      unfilled -= parseFloat(orders[i][1]);
    }
  }
  if (i == orders.length) return false;
  let result = { toAmount: toAmount, limitPrice: limitPrice };
  return result;
}

function convertBuy(orders, amount) {
  // amount of coins received
  let toAmount = 0;
  let unfilled = amount;
  let limitPrice;
  console.log("toAmount", toAmount);
  let i;
  for (i = 0; i < orders.length; i++) {
    console.log("orders[" + i + "]", orders[i][1], orders[i][0]);
    if (parseFloat(orders[i][1]) * orders[i][0] >= unfilled) {
      toAmount += parseFloat(unfilled / orders[i][0]);
      console.log("toAmount-b", toAmount);
      limitPrice = orders[i][0];
      break;
    } else {
      toAmount += parseFloat(orders[i][1]);
      console.log("toAmount-a", toAmount);
      unfilled -= parseFloat(orders[i][1]) * orders[i][0];
    }
  }
  if (i == orders.length) return false;
  let result = { toAmount: toAmount, limitPrice: limitPrice };
  return result;
}

async function getQuote(pair, fromSymbol, fromAmount) {
  console.log("KUCOIN getQuote", fromSymbol, fromAmount);
  if (avax.isNativeEquivalent(fromSymbol)) fromSymbol = "AVAX";
  else if (avax.isStablecoin(fromSymbol)) fromSymbol = "USDT";
  else throw new Error("Unsupported coin " + fromSymbol);
  const symbols = pair.split("-");
  let result;

  //  let data = await getOrderbook()
  if (fromSymbol == "AVAX") {
    console.log("Sell fromAmount=", fromAmount, fromSymbol);
    result = convertSell(orderBook.book.bids, fromAmount / (1 + TRADE_FEE));
    console.log("Sell result=", result);
  } else {
    console.log("Buy fromAmount=", fromAmount, fromSymbol);
    console.log("orderBook=", orderBook.book);
    result = convertBuy(orderBook.book.asks, fromAmount / (1 + TRADE_FEE));
    console.log("Buy result=", result);
  }
  console.log("kucoin.getQuote", fromSymbol, fromAmount, result);
  return result;
}

async function getOrders() {
  try {
    console.log("KUCOIN getOrders");
    let result = check(
      await kucoin.getOrders({ type: "limit", status: "active" })
    );
    console.log("Orders:", result);
    return result;
  } catch (e) {
    console.log(e.message + " => getOrders()");
  }
}

async function cancelOrders() {
  try {
    console.log("KUCOIN cancelOrders");
    result = check(await kucoin.cancelAllOrders({}));
    console.log("Cancel Orders:", result);
    return result;
  } catch (e) {
    console.log(e.message + " => cancelOrders()");
  }
}

const avaxAddr = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function supportedPair(t0, t1) {
  t0 = t0.toLowerCase();
  t1 = t1.toLowerCase();
  console.log("supportedPair", t0, t1);
  let sym0;
  let sym1;
  if (t0 == avaxAddr) {
    sym0 = "AVAX";
  } else {
    sym0 = maps.symbolMap.get(t0);
  }
  if (t1 == avaxAddr) {
    sym1 = "AVAX";
  } else {
    sym1 = maps.symbolMap.get(t1);
  }
  console.log("supportedPair", sym0, sym1);
  if (
    (avax.isNativeEquivalent(sym0) && avax.isStablecoin(sym1)) ||
    (avax.isStablecoin(sym0) && avax.isNativeEquivalent(sym1))
  ) {
    return true;
  }
  return false;
}

async function main() {
  init();
  await getOrderbook("AVAX-USDT");
  //console.log ("Selling 30 AVAX");
  await getQuote("AVAX-USDT", "AVAX", 4);
  //console.log ("Buying 13000 USDC");
  //await getQuote("AVAX-USDC","USDC", 40);
  //await getPositions();
  await trade("USDC", "AVAX", 17, 0.1);
  //await trade("AVAX","USDC",12,0.1);
  //await getOrders();
  //await cancelOrders({symbol:"AVAX"});
}

main();

module.exports = Object.assign({
  trade,
  supportedPair,
  getOrderbook,
  getPosition,
  getPositions,
  cancelOrders,
  convertSell,
  getQuote,
  init,
  convertBuy,
});
