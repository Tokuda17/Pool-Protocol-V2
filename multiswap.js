const BigNumber = require("big-number");
const fusion = require("./1fusion.js");
const unic = require("./unicache.js");
const utils = require("./utils.js");
const wall = require("./wallet.js");
const chain = require("./chain.js");
const inch = require("./1inch.js");
const inche = require("./1inche.js");
const quote = require("./quote.js");
const web = require("./web3.js");
web3 = web.web3;

let ethPairs = [
  {
    fusion: false,
    chain: "op",
    vsym: "WETH",
    ssym: "USDC",
  },
  {
    fusion: false,
    chain: "poly",
    vsym: "WETH",
    ssym: "USDC",
  },
  {
    fusion: false,
    chain: "arb",
    vsym: "WETH",
    ssym: "USDC",
  },
  {
    fusion: true,
    chain: "op",
    vsym: "WETH",
    ssym: "USDC",
  },
  {
    fusion: true,
    chain: "poly",
    vsym: "WETH",
    ssym: "USDC",
  },
  {
    fusion: true,
    chain: "arb",
    vsym: "WETH",
    ssym: "USDC",
  },
];

function isStablecoin(sym) {
  return ["USDC", "USDT", "USDC.E", "USDT.E"].includes(sym.toUpperCase());
}

function isEthEquivalent(sym) {
  return ["ETH", "WETH", "WETH.E"].includes(sym.toUpperCase());
}

function assertEthPair(sym0, sym1) {
  console.log("assertEthPair", sym0, sym1);
  if (
    (isStablecoin(sym0) && isEthEquivalent(sym1)) ||
    (isStablecoin(sym1) && isEthEquivalent(sym0))
  ) {
    console.log("exiting assertEthPair", sym0, sym1);
    return true;
  }
  throw new Error("assertEthPair() sym0=" + sym0 + " sym1=" + sym1 + " failed");
}

async function getEthQuote() {
  try {
    let ch;
    let oldch = web3.chain;
    let qeth = false,
      qavax = false,
      qop = false,
      qpoly = false,
      qarb = false;

    /*
    ch = "eth";
    chain.init(ch);
    qeth = await quote.oneFastQuote(chain.getAddress("WETH"),ch);

    ch = "avax";
    chain.init(ch);
    qavax = await quote.oneFastQuote(chain.getAddress("WETH"),ch);
*/

    ch = "op";
    chain.init(ch);
    qop = await quote.oneFastQuote(chain.getAddress("WETH"), ch);
    //console.log("qop=",qop);

    ch = "poly";
    chain.init(ch);
    qpoly = await quote.oneFastQuote(chain.getAddress("WETH"), ch);
    //console.log("qpoly=",qpoly);

    ch = "arb";
    chain.init(ch);
    qarb = await quote.oneFastQuote(chain.getAddress("WETH"), ch);

    let qs = { arb: qarb, avax: qavax, eth: qeth, op: qop, poly: qpoly };
    let q;
    if (qarb && qop && qpoly) q = (qarb + qop + qpoly) / 3;
    console.log("qs=", qs, "quote=", q);
    chain.init(oldch);
    return q;
  } catch (e) {
    console.log(e.message + " => getEthQuote() failed");
    throw new Error(e.message + " => getEthQuote() failed");
  }
}

let failedChains = new Map();
const MAX_TRIES = 3;

async function swap(
  port,
  fromSym,
  toSym,
  fromAmt,
  toAmt = false,
  ratio = false
) {
  try {
    failedChains.clear();
    while (true) {
      const wname = "lance";
      let tries = 0;
      let opt = false;
      if (toAmt) opt = true;
      console.log("calling swap", fromSym, toSym, fromAmt);

      let s = await quoteEthSwap(port, fromSym, toSym, fromAmt, opt, ratio);
      console.log("multiswap.swap s=", s);
      if (!s) return false;
      if (s.quote) {
        console.log("swap.step2 chain=", s.chain);
        unic.saveFile("trade", "SWAP step 2");
        let wallet = await wall.init(wname, s.chain);
        if (toAmt) {
          console.log("OPTIMISTIC check toAmt=", toAmt);
          if (isEthEquivalent(toSym))
            toAmt = BigNumber(Math.floor(toAmt * 1000000))
              .mult(BigNumber(10).pow(18 - 6))
              .toString();
          else if (isStablecoin(toSym)) toAmt = Math.floor(toAmt * 1000000);
          else
            throw new Error(
              "Unknown slippage check " + toSym + " => swap() failed"
            );
          if (BigNumber(s.toAmt).lt(toAmt)) return false;
          console.log(
            "OPTIMISTIC check passed target toAmt=",
            toAmt,
            "quote=",
            s.toAmt
          );
        }
        try {
          console.log("SWAP.step3");
          unic.saveFile("trade", "SWAP step 3 tries=" + tries);
          unic.writeTagId(
            "trade",
            Math.floor(Date.now() / 1000) + ".nonfusionQuote",
            {
              fromSym: s.fromSym,
              fromAmt: s.fromAmt,
              toSym: s.toSym,
              toAmt: s.toAmt,
              targetToAmt: toAmt,
              url: s.quoteUrl,
              notes: "this is the quote to be executed with nonfusion swap()",
            },
            s.chain
          );
          if (!s.fusion) {
            console.log("swap.step3a", s.quote, s.quote.data);
            console.log("Ready to swapWithQuote() s.chain=", s.chain);
            await inche.swapWithQuote(
              s.quote,
              s.quote.data.fromToken.address,
              s.fromAmt,
              wallet.address
            );
          } else {
            console.log("swap.step3b fusion", s);
            unic.writeTagId(
              "fusion",
              Math.floor(Date.now() / 1000) + ".fusionQuote",
              {
                fromSym: s.fromSym,
                fromAmt: s.fromAmt,
                toSym: s.toSym,
                toAmt: s.toAmt,
                targetToAmt: toAmt,
                notes: "this is the quote to be executed with fusion.swap()",
              },
              s.chain
            );
            let result = await fusion.swap(
              s.chain,
              s.fromSym,
              s.toSym,
              fromAmt,
              wallet.address
            );
            if (!result) {
              console.log("fusion swap failed");
              throw new Error("fusion swap failed");
            }
          }
          unic.saveFile("trade", "SWAP step 4 tries=" + tries);
          console.log("swap.step4");
        } catch (e) {
          unic.saveFile("trade", "SWAP step 5 error=" + e.message);
          console.log("swap.step5 error=" + e.message);
          if (tries < MAX_TRIES) return false;
          tries++;
          let f = failedChains.get(s.chain);
          if (f) failedChains.set(s.chain, f + 1);
          else failedChains.set(s.chain, 1);
          continue;
        }
        let r = { chain: s.chain, fusion: s.fusion };
        return r;
      }
    }
    return false;
  } catch (e) {
    unic.saveFile("trade", e.message + " => multiswap.swap() failed");
    console.log(e.message + " => multiswap.swap() failed");
    throw new Error(e.message + " => multiswap.swap() failed");
  }
}

async function adjustForGas(gas, sym, amount, ch, quote) {
  let cost = 0;
  if (ch == "poly") {
    let alc = web.getEthersAlchemy("poly");
    let gasPrice = await alc.core.getGasPrice();
    gasPrice = gasPrice.toString();
    //console.log("Polygon gas price = ", gasPrice.toString());
    // assume MATIC price is close to $1
    cost =
      parseInt(
        BigNumber(gas)
          .mult(gasPrice)
          .div(BigNumber(10).pow(18 - 6))
          .toString()
      ) / 1000000;
  } else if (ch == "arb") {
    let alc = web.getEthersAlchemy("arb");
    let gasPrice = await alc.core.getGasPrice();
    gasPrice = gasPrice.toString();
    cost =
      (parseInt(
        BigNumber(gas)
          .mult(gasPrice)
          .mult(Math.floor(quote * 1000))
          .div(BigNumber(10).pow(18 - 9))
          .toString()
      ) *
        0.7) /
      1000000;
  } else if (ch == "op") {
    let alc = web.getEthersAlchemy("eth");
    let gasPrice = await alc.core.getGasPrice();
    gasPrice = gasPrice.toString();
    cost =
      parseInt(
        BigNumber(25000)
          .mult(gasPrice)
          .mult(Math.floor(quote * 1000))
          .div(BigNumber(10).pow(18 - 9))
          .toString()
      ) / 1000000;
    console.log("gasPrice=", BigNumber(25000).toString());
    console.log("gasPrice=", BigNumber(25000).mult(gasPrice).toString());
    //console.log("gasPrice=",BigNumber(25000).mult(gasPrice).mult(Matquote).toString());
    //console.log("gasPrice=",BigNumber(25000).mult(gasPrice).mult(quote).div(BigNumber(10).pow(18-6)).toString());
    console.log("gasPrice=", gasPrice, quote, cost);
  }
  if (chain.isStablecoin(sym, ch)) {
    console.log("amount=", amount, cost);
    amount = BigNumber(amount)
      .minus(Math.floor(cost * 1000000))
      .toString();
    console.log("amount=", amount, cost);
  } else {
    amount = BigNumber(amount)
      .minus(
        BigNumber(Math.floor((cost / quote) * 1000000000)).mult(
          BigNumber(10).pow(18 - 9)
        )
      )
      .toString();
  }
  console.log(
    "adjustForGas",
    gas,
    sym,
    ch,
    quote,
    "cost=",
    cost,
    "newAmount=",
    amount
  );
  return amount;
}

const FUSION_SLIPPAGE = 0.007;

// opt - is this an optimistic trade requiring low slippage?
async function quoteEthSwap(
  port,
  sym0,
  sym1,
  amt0,
  opt = false,
  ratio = false
) {
  let currentChain = false;
  try {
    console.log("1");
    assertEthPair(sym0, sym1);
    console.log("2");
    let amt1 = false;
    let q = false;
    let fromSym, toSym;
    let wallet;
    let fromAmt;
    let quotes = [];
    let bestAmt = false;
    let bestQuote = false;
    let bestChain = false;
    let bestUrl = false;
    let bestFusion = false;
    let bestFromSym;
    let bestToSym;
    console.log("port=", port);
    let positions = port.snapshot.positions;
    for (let i = 0; i < ethPairs.length; i++) {
      //if (ethPairs[i].fusion) continue;
      // if a chain failed then go to next chain
      let f = failedChains.get(ethPairs[i].chain);
      if (f && f >= 1) continue;
      currentChain = ethPairs[i].chain;
      console.log("===========INIT(" + ethPairs[i].chain + ")");
      console.log("positions=", positions);
      console.log("checkWallet", sym0, ethPairs[i]);
      // xxx should replace "lance" with lookup of wname in port
      wallet = await wall.init("lance", ethPairs[i].chain);
      //console.log("a");
      await inch.initMaps();
      console.log("quoteEthSwap", sym0, sym1, amt0, ethPairs[i]);
      if (chain.isStablecoin(sym0, ethPairs[i].chain)) {
        console.log("3");
        fromAmt = Math.floor(amt0 * 1000000);
        fromSym = ethPairs[i].ssym;
        toSym = ethPairs[i].vsym;
      } else {
        console.log("4", fromAmt);
        //console.log("4",BigNumber(Math.floor(amt0*1000000)).toString());;
        fromAmt = BigNumber(Math.floor(amt0 * 1000000))
          .mult(BigNumber(10).pow(18 - 6))
          .toString();
        //console.log("fromAmt=",fromAmt);;
        fromSym = ethPairs[i].vsym;
        toSym = ethPairs[i].ssym;
      }
      console.log("5", positions, fromSym, ethPairs[i]);
      let wamt = utils.checkWallet(positions, fromSym, ethPairs[i].chain);
      //console.log("quoteEthSwap wamt=",wamt,ethPairs[i].chain);
      // check if there is enough coins in the wallet
      if (wamt < amt0) continue;

      let toAmt;
      let quote;
      if (ethPairs[i].fusion) {
        try {
          quote = await fusion.getQuote(
            ethPairs[i].chain,
            fromSym,
            toSym,
            amt0
          );
        } catch (e) {
          console.log(e.message + " fusion.getQuote() failed");
          //throw new Error(e.message+" TEMPORARY ABORT fusion.getQuote() "+fromSym+" "+toSym+" "+amt0);
          continue;
        }
        toAmt = BigNumber(quote.toTokenAmount)
          .mult((1 - FUSION_SLIPPAGE) * 1000000)
          .div(1000000)
          .toString();
        console.log(
          "FUSION QUOTE for ch=" + ethPairs[i].chain + " is " + toAmt
        );
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
        console.log("=======================================================");
      } else {
        console.log(
          "6",
          fromSym,
          chain.getAddress(fromSym),
          toSym,
          chain.getAddress(toSym)
        );
        try {
          q = await inch.getQuote(
            chain.getAddress(fromSym),
            chain.getAddress(toSym),
            fromAmt,
            wallet.address,
            ethPairs[i].chain,
            opt,
            ratio
          );
        } catch (e) {
          console.log("quoteEthSwap error =", e.message, "continuing");
          continue;
        }
        console.log(
          "7",
          q.quoteData.data.tx.gas,
          sym1,
          q.quoteData.data.toTokenAmount,
          ethPairs[i].chain,
          port.snapshot.quote
        );
        toAmt = await adjustForGas(
          q.quoteData.data.tx.gas,
          sym1,
          q.quoteData.data.toTokenAmount,
          ethPairs[i].chain,
          port.snapshot.quote
        );
        quote = q.quoteData;
      }
      console.log("8");
      quotes.push(quote);
      if (!bestAmt || BigNumber(bestAmt).lt(toAmt)) {
        bestAmt = toAmt;
        bestQuote = quote;
        bestChain = ethPairs[i].chain;
        bestFusion = ethPairs[i].fusion;
        bestFromSym = fromSym;
        bestToSym = toSym;
        if (q.quoteUrl) bestUrl = q.quoteUrl;
        else bestUrl = false;
      }
    }
    if (!bestAmt) return false;
    let result = {
      chain: bestChain,
      toAmt: bestAmt,
      fromAmt: fromAmt,
      fusion: bestFusion,
      quote: bestQuote,
      quotes: quotes,
      fromSym: bestFromSym,
      toSym: bestToSym,
      quoteUrl: bestUrl,
    };
    let tmpresult = Object.assign({}, result);
    tmpresult.quote = true;
    tmpresult.quotes = true;
    tmpresult.notes = "quoteEthSwap() opt=" + opt + " ratio=" + ratio;
    unic.saveObj("trade", tmpresult);
    console.log("result=", result);
    //  save best quote
    //execute best quote
    return result;
  } catch (e) {
    unic.saveFile("trade", "Error in quoteEthSwap() " + e.message);
    //catch errors
    console.log(e.message + " => quoteEthSwap() failed");
    throw new Error(e.message + " => quoteEthSwap() failed");
  }
}

module.exports = Object.assign({
  adjustForGas,
  getEthQuote,
  quoteEthSwap,
  swap,
});
