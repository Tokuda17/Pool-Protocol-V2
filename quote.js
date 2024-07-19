const utils = require("./utils.js");
const web = require("./web3.js");
const chain = require("./chain.js");
const axios = require("axios");
const maps = require("./maps.js");
const erc20 = require("./erc20.js");
var BigNumber = require("big-number");
var avaxPrice18;

// pass coingecko id
// xxx can improve accuracy by getting value in btc and multiplying (more significant digits)
// consider a call like this:   'https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2%2Cbitcoin%2Cusd-coin%2Ctether&vs_currencies=btc%2Ceth'
// it gives you multiple paths through btc and eth with more significant digits

async function cgQuote(cgid, retries = 0, sleeptime = 0) {
  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=" +
      cgid +
      "&vs_currencies=usd&include_24hr_change=true";
    console.log("Entering quote", url);
    const quote = await axios.get(url);
    console.log("quote returned ");
    return quote.data[cgid]["usd"];
  } catch (e) {
    console.log(e.message);
    if (retries == 0) throw Error(e.message, " => cgQuote failed");
    else {
      retries--;
      if (sleeptime == 0) sleeptime = 3;
      else sleeptime *= 2;
      await utils.sleep(sleeptime);
      return cgQuote(cgid, retries, sleeptime);
    }
  }
}

function oneQuoteFromAddress(addr) {
  const sym = maps.symbolMap.get(addr.toLowerCase());
  return oneQuote(sym);
}

function oneQuote(sym) {
  console.log("avaxPrice18", avaxPrice18);
  //const addr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
  //console.log("addr",addr);
  //console.log("price",maps.priceMap.get(addr.toLowerCase));
  const q =
    parseInt(
      BigNumber(maps.priceMap.get(sym))
        .mult(avaxPrice18)
        .div(BigNumber(10).pow(18 + 9))
        .toString()
    ) / 1000000000;
  console.log("quote for", sym, q);
  return q;
}

async function oneLoadQuotes(ch = "avax") {
  try {
    let id = chain.chainId(ch);
    //console.log("Retrieving quotes");
    const url = "https://token-prices.1inch.io/v1.1/" + id;
    var quotes = await axios.get(url);
    quotes = quotes.data;
    console.log("quotes=", quotes);
    let usdcAddr = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
    console.log("1");
    if (id == 1) {
      console.log("1a");
      usdcAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      console.log("1b");
    }
    console.log("1c");
    const tokenAddresses = [usdcAddr];
    console.log("2");
    await erc20.initMaps(tokenAddresses);
    console.log("3");
    for (var addr in quotes) {
      addr = addr.toLowerCase();
      const sym = maps.symbolMap.get(addr);
      if (sym != undefined) {
        console.log("sym", sym, "price", quotes[addr]);
        maps.priceMap.set(sym, quotes[addr]);
      }
    }
    const usdcPrice18 = maps.priceMap.get("USDC");
    avaxPrice18 = BigNumber(10).pow(36).div(usdcPrice18).toString();
  } catch (e) {
    console.log(e.message);
    throw Error(e.message, " => oneLoadQuotes failed");
  }
}

async function oneFastQuote(qaddr, ch = "avax") {
  try {
    if (!qaddr) throw new Error("oneFastQuote bad qaddr", qaddr);
    console.log("calling oneFastQuote", qaddr, ch);
    let id = chain.chainId(ch);
    const url = "https://token-prices.1inch.io/v1.1/" + id;
    //console.log("URL" , url);
    var quotes = await axios.get(url);
    quotes = quotes.data;
    //console.log("finding quote for qaddr=",qaddr);
    //console.log(quotes);
    var usdFlag = false;
    var qaddrFlag = false;
    let usdcAddr = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
    if (id == 1) {
      usdcAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    } else if (id == 10) {
      // op
      usdcAddr = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";
    } else if (id == 137) {
      // poly
      usdcAddr = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    } else if (id == 42161) {
      // arbitrum
      usdcAddr = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
    }
    usdcAddr = usdcAddr.toLowerCase();
    var qaddr = qaddr.toLowerCase();
    var qPrice;
    //    var usdcPrice18 = maps.priceMap.get(usdcAddr);
    let usdcPrice18;
    for (let addr in quotes) {
      addr = addr.toLowerCase();
      if (usdFlag && qaddrFlag) break;
      if (addr == qaddr) {
        //maps.priceMap.set(addr.toLowerCase(), quotes[addr]);
        qPrice = quotes[addr];
        qaddrFlag = true;
      } else if (addr == usdcAddr) {
        //maps.priceMap.set(addr.toLowerCase(), quotes[addr]);
        usdcPrice18 = quotes[addr];
        usdFlag = true;
      }
    }
    if (usdFlag && qaddrFlag) {
      console.log("USDC Price=", usdcPrice18);
      console.log("WETH Price=", qPrice);
      avaxPrice18 = BigNumber(10).pow(36).div(usdcPrice18).toString();
      //console.log("AVAX Price=", parseInt(BigNumber(avaxPrice18).div(BigNumber(10).pow(16)).toString())/100);
      let q =
        parseInt(
          BigNumber(qPrice)
            .mult(avaxPrice18)
            .div(BigNumber(10).pow(18 + 9))
            .toString()
        ) / 1000000000;
      //q=parseInt(BigNumber(qPrice).mult(avaxPrice18).div(BigNumber(10).pow(27)).toString())/1000000000;
      console.log("Price=", q);
      return q;
    } else throw new Error("Could not find qaddr in 1inch quotes");
  } catch (e) {
    console.log(e.message);
    throw Error(e.message, " => oneLoadQuotes failed");
  }
}
module.exports = Object.assign({
  cgQuote,
  oneQuote,
  oneQuoteFromAddress,
  oneLoadQuotes,
  oneFastQuote,
});
