//Imports

require("dotenv").config();
var BigNumber = require("big-number");
const avax = require("./avax.js");
const swap = require("./swap.js");
const kucoin = require("./kucoin.js");
const maps = require("./maps.js");
const erc20 = require("./erc20.js");
const nodemailer = require("./nodemailer.js");
const aave = require("./aave.js");
const alpha = require("./alpha.js");
const pan = require("./pan.js");
const wall = require("./wallet.js");
const inch = require("./1inch.js");
const quote = require("./quote.js");
const factory = require("./panFactory.js");
const web = require("./web3.js");
const DEBT_RATIO_LOWER = 63;
const DEBT_RATIO_UPPER = 68;
var wallet;
var SWAP_ATTEMPTS = 0;
var DEFAULT_SWAP_ATTEMPTS = 0;
let web3 = web.web3;

const DEFAULT_LEVERAGE = 2.75;
// to calculate multiple 2.75 * 1/(1+(outside positions)/(alpha leveraged position))
// includes AVAX-USDT and AVAX-USDC.e in pan
const LANCE_LEVERAGE = 2.75;
//const LANCE_LEVERAGE = 2.75; // without AVAX-USDT in pan, should be this

const OPTIMISTIC_TRADE_THRESHOLD = 0.9; // percent
function getTradeThreshold(wname) {
  if (wname == "lance") {
    return 1.2;
    //return 1.1;
  } else {
    return 1.2;
  }
}

//*********************************************************************
// Misc support functions
//*********************************************************************
function printMap(name, map) {
  console.log(name);
  map.forEach((value, key) => {
    console.log(key, value);
  });
}

function getSymbolFromArray(sym, a) {
  //console.log("getsymbolfromarray");
  //console.log(sym,a);
  for (let i = 0; i < a.length; i++) {
    if (a[i].symbol.toUpperCase() == sym.toUpperCase()) return a[i];
  }
  return { symbol: sym, amount: 0, decimals: 18 };
}

function getIdSymbolFromArray(id, sym, a) {
  //console.log("getsymbolidfromarray");
  //console.log(id,sym,a);
  for (let i = 0; i < a.length; i++) {
    if (a[i].id == id) {
      if (a[i].symbol.toUpperCase() == sym.toUpperCase()) return a[i];
    }
  }
  return { symbol: sym, amount: 0, decimals: 18 };
}

// divides two number and returns a decimal with decimal places of precision
function getDecimalDivision(numerator, denominator, decimal) {
  let n = BigNumber(numerator)
    .mult(10 ** decimal)
    .div(denominator)
    .toString();
  n = parseInt(n) / 10 ** decimal;
  return n;
}

function addCommas(n, dollar) {
  if (dollar === true) dollar = "$";
  else dollar = "";
  if (n < 0) {
    minus = "-";
    n = -n;
  } else minus = "";
  if (n < 1000) {
    n = Math.floor(n * 100) / 100.0;
    return minus + dollar + n;
  } else {
    n = Math.floor(n);
    return minus + dollar + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}

// creates addressMap, symbolMap, and decimalsMap from an array of positions
// a position is { symbol: <sym>, token: <address>, decimals: <decimals> }
function addPositionsToMaps(pos) {
  //console.log("CREATE MAPS",pos.length);
  for (let i = 0; i < pos.length; i++) {
    if (pos[i].symbol !== undefined) {
      if (pos[i].token !== undefined) {
        //console.log("sym",pos[i].symbol,"token",pos[i].token);
        maps.addressMap.set(pos[i].symbol, pos[i].token);
        maps.symbolMap.set(pos[i].token, pos[i].symbol);
      }
      if (pos[i].decimals !== undefined) {
        maps.decimalsMap.set(pos[i].symbol, pos[i].decimals);
        //console.log("dec",pos[i].decimals);
      }
    }
  }
  //console.log ("MAPS CREATED");
}

async function initMaps() {
  await inch.initMaps();
  let ch = web3.chain;
  if (ch == "avax") {
    await pan.initMaps(ch);
  }
}

async function exchangeRewards(
  wname,
  owner,
  walletPng,
  toAddress = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
) {
  /*
  if (wname == "lance")
  {
    // convert to WETH instead of USDC.e
    toAddress = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";
  }
*/
  console.log("EXCHANGE REWARDS:", walletPng);
  try {
    //console.log("Inside Try:");
    //const threshold = alpha.getClaimThreshold(wname);
    //console.log("Threshold:", threshold);
    const amount = parseInt(
      BigNumber(walletPng.amount).div(BigNumber(10).pow(walletPng.decimals))
    );
    console.log("Amount:", amount);
    //    if (amount >= threshold)
    if (BigNumber(amount).gt(0)) {
      console.log("Need to SELL PNG:", walletPng);
      pAddress = maps.addressMap.get("PNG");
      console.log("Calling swap");
      pContract = await erc20.getContract(pAddress);
      console.log(
        "exchangeRewards swap",
        pAddress,
        toAddress,
        walletPng.amount,
        owner
      );
      await inch.swap(pAddress, toAddress, walletPng.amount, owner);
      console.log("Swapping PNG for USDC.e or other token");
      return true;
    }
    return false;
  } catch (e) {
    console.log("exchangeRewards " + e.message);
    throw new Error(e.message + " => exchangeRewards failed");
  }
}

// xxx - run this on the result of wallet getPositions to get the value of lp tokens
// untested
function expandPoolPositions(pos, poolAddresses) {
  let newpos = [];
  for (let i = 0; i < pos.length; i++) {
    if (poolAddresses.includes(pos[i].symbol)) {
      tokens = pan.getPoolTokens(
        pos.symbol,
        maps.addressMap(pos.symbol),
        pos.amount
      );
      newpos = newpos.concat(tokens);
    } else {
      newpos = newpos.concat(pos[i]);
    }
  }
}

function getNativeExposure(ids, a) {
  console.log("ids=", ids);
  console.log("a=", a);
  let amount = 0;
  let s = ["USDC.e", "USDC", "USDT", "USDT.e"];
  for (let i = 0; i < ids.length; i++) {
    console.log("i", i);
    for (let j = 0; j < s.length; j++) {
      console.log("j", j);
      let ne = getIdSymbolFromArray(ids[i], s[j], a);
      console.log("ne=", ne);
      if (ne) {
        amount += parseFloat(ne.amount);
      }
    }
  }
  console.log("AMOUNT ==============", amount);
  return amount;
}

async function calculateNetPositions(wname, owner) {
  try {
    await initMaps();
    console.log("calculateNetPositions", wname, owner);
    //console.log("initMaps");
    //const ct = await alpha.getClaimThreshold(wname);
    //console.log("getclaimthresh",ct);

    let pos = [];
    const alphaPos = await alpha.getPositions(wname, owner);
    alphaRewards = alphaPos.rewards;
    //console.log("ALPHA REWARDS:", alphaRewards);
    let rewardsUsd = 0;
    rewardsUsd = alphaPos.rewardsUsd;
    pos = pos.concat(alphaPos.positions);
    var aavePos = await aave.getPositions(owner);
    //console.log("aave position", aavePos);
    pos = pos.concat(aavePos);
    addPositionsToMaps(pos); // addressMap and other maps filled in here
    var pos3 = await wall.getPositions(owner, maps.addressMap, false, [
      "WETH.E",
      "USDC.E",
    ]);
    //console.log("pos3=",pos3);
    //exit();
    let pos4;
    if (wname == "lance") pos4 = await pan.getPositions(owner, pos3);
    else pos4 = pos3;
    let wallNativeExposure = 0;
    wallNativeExposure = getNativeExposure(
      ["AVAX-USDC", "AVAX-USDC.e", "AVAX-USDT"],
      pos4
    );
    //console.log("=====================\n");
    //console.log(pos4);
    pos = pos.concat(pos4);
    if (wname == "lance") {
      await kucoin.init();
      var kucoinPos = await kucoin.getPositions();
      pos = pos.concat(kucoinPos);
    }
    const aaveRewards = await aave.getUserRewards(owner);
    //console.log("aaveRewards",aaveRewards);
    pos = pos.concat(aaveRewards);
    let walletPng = getIdSymbolFromArray("wallet", "PNG", pos);
    await alpha.claimRewards(wname, owner, alphaRewards);
    const exchanged = await exchangeRewards(wname, owner, walletPng);
    if (exchanged) return calculateNetPositions(wname, owner);
    let usd = 0;
    let native = 0;
    for (let i = 0; i < pos.length; i++) {
      //console.log("i=",i, pos[i]);
      //console.log("SYMBOL "  + i + " " + pos[i].symbol + "\n");
      let sym = pos[i].symbol;
      let id = pos[i].id;
      //if (id == "rewards") continue;
      //console.log("sym=",sym);
      if (avax.isStablecoin(sym)) {
        usd = BigNumber(usd).add(pos[i].amount).toString();
      } else if (avax.isNativeEquivalent(sym)) {
        native = BigNumber(native).add(pos[i].amount).toString();
        //      } else if (sym == "AVAX-USDT") {
        //        let panResult = await pan.getPoolTokens(
        //          "AVAX_USDT", "0xe3bA3d5e3F98eefF5e9EDdD5Bd20E476202770da", pos[i].amount);
        //        console.log("PAN_RESULT=",panResult);
      } else {
      }
    }
    let netpos = {
      positions: [
        { id: "net", symbol: "USD", amount: usd, decimals: 6 },
        { id: "net", symbol: "AVAX", amount: native, decimals: 18 },
      ],
      //{ id: "rewards", rewards: alphaRewards} ],
      aavePositions: aavePos,
      rewards: alphaRewards,
      rewardsUsd: rewardsUsd,
      numPositions: alphaPos.numPositions,
      ids: alphaPos.positionIds,
      nativeExposure: alphaPos.nativeExposure + wallNativeExposure,
      poolNativePrice: alphaPos.poolNativePrice,
    };
    netpos.positions = netpos.positions.concat(pos);

    console.log("netpos in calculateNetPositions", netpos);
    return netpos;
  } catch (e) {
    console.log("calculateNetPositions " + e.message);
    throw new Error(e.message + " => calculateNetPositions failed");
  }
}

async function calculateRebalanceAndAdjust(
  wname,
  addr,
  mailResults = true,
  init
) {
  try {
    console.log("******************************************");
    console.log("1. Calculated Net Position");
    console.log("******************************************");

    var netPosition = await calculateNetPosition(wname, addr);

    console.log("******************************************");
    console.log("2. If liquidity found then deposit");
    console.log("******************************************");

    // deposit liquidity tokens first if they are present
    // we should only see them if there was some kind of previous error
    // since alpha withdrawals don't give you liquidity tokens
    // console.log("step1");
    const poolStableToken = maps.addressMap.get("USDC.e");
    // console.log("step2");
    const factoryContract = await factory.getFactoryContract();
    // console.log("step3");
    const borrowVariableToken = maps.addressMap.get("WAVAX");

    // console.log("step4", poolStableToken,borrowVariableToken);
    const panPoolAddress = await factory.getPanPair(
      factoryContract,
      poolStableToken,
      borrowVariableToken
    );
    // console.log("step5");
    const panPoolContract = await erc20.getContract(panPoolAddress);
    // console.log("step6");
    const lp = await erc20.balanceOf(panPoolContract, addr);
    // console.log("step7");
    if (BigNumber(lp).gt(0)) {
      const bankContract = await alpha.getBankContract();
      await leverDeposit(
        addr,
        poolStableToken,
        borrowVariableToken,
        factoryContract,
        bankContract,
        panPoolAddress,
        lp
      );
      return calculateRebalanceAndAdjust(wname, addr, mailResults, init);
    }
    // console.log("step8");

    console.log("******************************************");
    console.log("3. Check debt ratio");
    console.log("******************************************");

    let debtRatio = netPosition.debtRatio;
    var rebalanceMsg = "";
    const numPositions = parseInt(netPosition.alphaNumPositions);
    console.log("numPositions", numPositions);
    //throw new Error("unhandled");
    if (
      numPositions == 0 ||
      debtRatio < DEBT_RATIO_LOWER ||
      debtRatio > DEBT_RATIO_UPPER
    ) {
      if (wname != "lance") {
        console.log("ADJUSTING POSITION, debt ratio is", debtRatio);
        console.log("POSITIONS = ", netPosition.alphaNumPositions);
        rebalanceMsg =
          "REBALANCE Required: debt ratio is " +
          debtRatio +
          ", calling adjustPosition.\n";
        console.log("******************************************");
        console.log("3a. Rebalance required, calling adjustPosition");
        console.log("******************************************");
        await adjustPosition(
          wname,
          addr,
          "USDC",
          "WAVAX",
          "USDC.e",
          "AVAX",
          netPosition
        );
        netPosition = await calculateNetPosition(wname, addr);
      } else {
        rebalanceMsg =
          "REBALANCE Required: debt ratio is " +
          debtRatio +
          ", NOT calling adjustPostion for lance's portfolio.\n";
      }
    } else {
      console.log("rebalancing not required");
    }
    //throw new Error("unhandled");
    let avVal = netPosition.variableValue;
    let avTokens = netPosition.variableTokens;
    let uVal = netPosition.stableValue;
    let spread = netPosition.tradeThreshold;
    let netVal = netPosition.netVal;
    console.log("netPosition", netPosition);
    console.log("init", init);
    console.log("NETVAL: ", netPosition.netVal, init.netValue);
    let profit = netPosition.netVal - init.netValue;
    const now = Date.now() / 1000;
    const elapsed = now - init.timestamp;
    var apy =
      (1 + profit / init.collateral) ** ((365 * 24 * 3600) / elapsed) * 100 -
      100;
    profit = Math.floor(profit * 100) / 100;
    apy = Math.floor(apy * 10) / 10;
    console.log("APY", apy, "elapsed", elapsed, "now", now);
    let printProfit = addCommas(profit);
    let printNetVal = addCommas(netVal, true);
    let printAvTokens = addCommas(avTokens);
    let printAvVal = addCommas(avVal, true);
    let printSpread = addCommas(spread, true);
    const dt = new Date(init.timestamp * 1000).toLocaleString("en-US", {
      timeZone: "America/Chicago",
    });
    let subject;
    let body = rebalanceMsg;
    if (avVal > spread) {
      console.log("YOU ARE LONG AVAX!  TRADING ...", wname);
      let mtime = Math.floor(Date.now() / 1000);
      subject = "SELLING " + printAvTokens + " AVAX " + mtime;
      body += "Profit= " + printProfit + ", APY= " + apy + "%\n";
      body += "You are LONG " + printAvVal + ". Net Value = " + printNetVal;
      if (wname != "lance") {
        //console.log("calling adjustDebt");
        await adjustDebt(wname, "WAVAX", avTokens, "USDC", addr, "default");
        body += " \nStarting " + dt;
        nodemailer.sendMail(subject, body);
      } else {
        body += "\nNot trading lance's wallet with calculateRebalanceAndAdjust";
      }
      //avTokens = addCommas(avTokens);
      //avVal = addCommas(avVal,true);
      //console.log("You are LONG, SELL", avTokens, "AVAX = $", avVal);
      //console.log("USD=$", uVal);
    } else if (avVal < -spread) {
      let printMavVal = addCommas(-avVal, true);
      let printMavTokens = addCommas(-avTokens);
      let mtime = Math.floor(Date.now() / 1000);
      subject = "BUYING " + printMavVal + " of AVAX " + mtime;
      body += "Profit=" + printProfit + ", APY=" + apy + "%\n";
      body +=
        "You are SHORT " +
        printMavTokens +
        " AVAX. Net Value = " +
        printNetVal +
        "\n";
      console.log("**YOU ARE SHORT AVAX!  TRADING ...");
      if (wname != "lance") {
        await adjustDebt(wname, "USDC", -avVal, "WAVAX", addr, "default");
        body += " \nStarting " + dt;
        nodemailer.sendMail(subject, body);
      } else {
        body += "\nNot trading lance's wallet";
      }
      //avTokens = addCommas(-avTokens);
      //avVal = addCommas(-avVal,true);
      //console.log("You are SHORT", avTokens, "AVAX, BUY", avVal, "of AVAX");
      //console.log("USD=$", uVal);
    } else {
      console.log("Your AVAX postion is", avTokens);
      //      if (wname == "lance")
      //      {
      subject = "Your AVAX postion is " + avTokens;
      body += "Profit=" + printProfit + ", APY=" + apy + "%\n";
      body += "AVAX = " + printAvVal + ", Net Value = " + printNetVal + "\n";
      //      }
      if (mailResults) {
        body += " \nStarting " + dt;
        nodemailer.sendMail(subject, body);
      }
    }
  } catch (e) {
    console.log(e.message);
    nodemailer.sendMail(
      "calculateRebalanceAndAdjust() failed",
      e.message + " => calculateRebalanceAndAdjust failed"
    );
    throw new Error(e.message + " => calculateRebalanceAndAdjust failed");
  }
}

async function calculateAndAdjust(wname, addr, mailResults = true, init) {
  try {
    //nodemailer.sendMail("calculateAndAdjust called","notification");
    let netPosition = await calculateNetPosition(wname, addr);
    console.log("caa1");
    let avVal = netPosition.variableValue;
    let avTokens = netPosition.variableTokens;
    let uVal = netPosition.stableValue;
    let spread = netPosition.tradeThreshold;
    let netVal = netPosition.netVal;
    console.log("caa2 init", init);
    let profit = netPosition.netVal - init.netValue;
    console.log("caa3");
    const now = Date.now() / 1000;
    const elapsed = now - init.timestamp;
    var apy =
      (1 + profit / init.collateral) ** ((365 * 24 * 3600) / elapsed) * 100 -
      100;
    apy = Math.floor(apy * 10) / 10;
    profit = Math.floor(profit * 100) / 100;
    console.log("APY", apy, "elapsed", elapsed, "now", now);
    let printProfit = addCommas(profit);
    let printNetVal = addCommas(netVal, true);
    let printAvTokens = addCommas(avTokens);
    let printAvVal = addCommas(avVal, true);
    let printSpread = addCommas(spread, true);
    console.log("caa4");
    let subject;
    let body = "";
    let tradeType = "default";
    const dt = new Date(init.timestamp * 1000).toLocaleString("en-US", {
      timeZone: "America/Chicago",
    });
    if (
      (avVal > spread * OPTIMISTIC_TRADE_THRESHOLD && wname == "lance") ||
      avVal > spread
    ) {
      let mtime = Math.floor(Date.now() / 1000);
      subject = "SELLING " + printAvTokens + " AVAX " + mtime;
      body += "Profit=" + printProfit + ", APY=" + apy + "%\n";
      body +=
        "You are LONG " + printAvVal + ". Net Value = " + printNetVal + "\n";
      console.log("YOU ARE LONG AVAX! TRADING ...", wname);
      if (avVal < spread) {
        subject = "OPTIMISTIC SELLING " + printAvTokens + " AVAX";
        tradeType = "profit";
      }
      await adjustDebt(wname, "WAVAX", avTokens, "USDC", addr, tradeType);
      body += " \nStarting " + dt;
      body += "\n\n" + JSON.stringify(netPosition, null, 2) + "\n";
      nodemailer.sendMail(subject, body);
    } else if (
      (avVal < -spread * OPTIMISTIC_TRADE_THRESHOLD && wname == "lance") ||
      avVal < -spread
    ) {
      let printMavTokens = addCommas(-avTokens);
      let printMavVal = addCommas(-avVal, true);
      let mtime = Math.floor(Date.now() / 1000);
      subject = "BUYING " + printMavVal + " of AVAX " + mtime;
      body += "Profit= " + printProfit + ", APY= " + apy + "%\n";
      body +=
        "You are SHORT " +
        printMavTokens +
        " AVAX. Net Value = " +
        printNetVal +
        "\n";
      console.log("YOU ARE SHORT AVAX!  TRADING ...");
      if (avVal > -spread) {
        subject = "OPTIMISTIC BUYING " + printMavVal + " of AVAX";
        tradeType = "profit";
      }
      await adjustDebt(wname, "USDC", -avVal, "WAVAX", addr, tradeType);
      body += " \nStarting " + dt;
      body += "\n\n" + JSON.stringify(netPosition, null, 2) + "\n";
      nodemailer.sendMail(subject, body);
    } else {
      console.log("Your AVAX postion is", avTokens);
      subject = "Your AVAX postion is " + avTokens;
      body += "Profit=" + printProfit + ", APY=" + apy + "%\n";
      body +=
        "AVAX = " +
        printAvVal +
        ", Net Value = " +
        printNetVal +
        ", Spread = " +
        printSpread +
        "\n";
      if (mailResults) {
        body += " \nStarting " + dt;
        body += "\n\n" + JSON.stringify(netPosition, null, 2) + "\n";
        nodemailer.sendMail(subject, body);
      }
    }
  } catch (e) {
    console.log(e.message);
    let mtime = Math.floor(Date.now() / 1000);
    nodemailer.sendMail(
      "calculateAndAdjust() failed " + mtime,
      e.message + " => calculateAndAdjust failed"
    );
    throw new Error(e.message + " => calculateAndAdjust failed");
  }
}

function mailPosition(netPosition, init) {
  console.log("mailPosition", netPosition, init);
  let avVal = netPosition.variableValue;
  let avTokens = netPosition.variableTokens;
  let uVal = netPosition.stableValue;
  let spread = netPosition.tradeThreshold;
  let netVal = netPosition.netVal;
  let profit = netPosition.netVal - init.netValue;
  console.log("NETPOS: ", netPosition.netVal);
  console.log("init: ", init.netValue);
  const now = Math.floor(Date.now() / 1000);
  let elapsed = now - init.timestamp;
  var apy =
    (1 + profit / init.collateral) ** ((365 * 24 * 3600) / elapsed) * 100 - 100;
  profit = Math.floor(profit * 100) / 100;
  apy = Math.floor(apy * 10) / 10;
  elapsed = Math.floor((elapsed * 10) / 3600 / 24) / 10;
  console.log("APY", apy, "elapsed days", elapsed, "now", now);
  let printProfit = addCommas(profit);
  let printNetVal = addCommas(netVal, true);
  let printAvTokens = addCommas(avTokens);
  let printAvVal = addCommas(avVal, true);
  let printSpread = addCommas(spread, true);
  const dt = new Date(init.timestamp * 1000).toLocaleString("en-US", {
    timeZone: "America/Chicago",
  });
  let subject = "";
  let body = "";
  subject += "Profit=" + profit + " " + apy + "%";
  body += "APY: " + apy + "% VariableUsd=" + avVal + "\n";
  body += "Starting " + dt + "\n";
  body += "\n" + JSON.stringify(netPosition, null, 2) + "\n";
  nodemailer.sendMail(subject, body);
}

async function calculateNetPosition(
  wname,
  walletAddress,
  mailFlag = false,
  init = null
) {
  try {
    const netPos = await calculateNetPositions(wname, walletAddress);
    //console.log("calculateNetPositions",netPos);
    //console.log("rewardsUsd",rewardsUsd);

    const tokenToPrice = await aave.getPriceOfAllTokens(walletAddress);

    /*
    const avaxTokenToPrice = getSymbolFromArray("WAVAX",tokenToPrice);
    const avaxUSDPrice = avaxTokenToPrice.price/100000000;
    console.log("avaxUSDPrice=",avaxUSDPrice,"avaxTokenToPrice.price",avaxTokenToPrice.price);
    maps.priceMap.set("AVAX",avaxUSDPrice);
    let avaxPrice = avaxTokenToPrice.price*100000000;
    console.log("avaxPrice=",avaxPrice);
*/

    const wavaxAddr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
    let avaxUSDPrice = await quote.oneFastQuote(wavaxAddr);
    console.log("avaxUSDPrice", avaxUSDPrice);
    let avaxPrice = BigNumber(Math.floor(avaxUSDPrice * 100000000000))
      .mult(100000)
      .toString();
    console.log("avaxPrice", avaxPrice);
    maps.priceMap.set("AVAX", avaxUSDPrice);
    maps.priceMap.set("WAVAX", avaxUSDPrice);

    let av = getIdSymbolFromArray("net", "AVAX", netPos.positions);
    let avVal = BigNumber(av.amount)
      .mult(avaxPrice)
      .div(BigNumber(10).power(av.decimals))
      .div(BigNumber(10).power(8))
      .toString();
    console.log("avVal=", avVal);
    // avTokens is the number of AVAX tokens to two decimal places
    let avTokens = getDecimalDivision(
      av.amount,
      BigNumber(10).power(av.decimals).toString(),
      2
    );

    console.log("step2");
    let u = getSymbolFromArray("usd", netPos.positions);
    // uVal = net dollar value of all stablecoin positions
    let uVal = BigNumber(u.amount)
      .div(BigNumber(10).power(u.decimals))
      .toString();

    console.log("step3", netPos.positions);
    let ad = getIdSymbolFromArray("aave-avalanche", "WAVAX", netPos.positions);
    console.log("ad", ad);
    // adVal = value of AVAX debt from Aave
    let adVal = BigNumber(ad.amount)
      .mult(-1)
      .mult(avaxPrice)
      .div(BigNumber(10).power(8))
      .div(BigNumber(10).power(18))
      .toString();

    console.log("step4");
    // spread is a % of Aave AVAX debt used to determine if a trade should be executed
    //let spread=BigNumber(adVal).mult(parseInt(getTradeThreshold(wname) * 1000)).div(1000).div(100).toString();
    let leverage = DEFAULT_LEVERAGE;
    if (wname == "lance") leverage = LANCE_LEVERAGE;
    let spread =
      (((parseInt(netPos.nativeExposure) / 1000000 / leverage) *
        getTradeThreshold(wname)) /
        100) *
      100000000;

    // netVal is the sum of the net AVAX and USD positions
    //console.log("HERE IS THE NETVAL",BigNumber(avVal).add(uVal*100000000).toString());
    let netVal = BigNumber(avVal)
      .add(uVal * 100000000)
      .add(Math.floor(netPos.rewardsUsd * 100000000))
      .toString();
    //console.log("HERE ARE THE REWARDS BEING ADDED IN", Math.floor(netPos.rewardsUsd*100000000));
    //console.log("HERE IS THE NETVAL",netVal);

    console.log("Step5");
    const poolContract = await aave.getPoolContract();
    const netPosition = {
      avaxPrice: avaxUSDPrice,
      poolNativePrice: netPos.poolNativePrice,
      variableValue: parseInt(avVal) / 100000000,
      tradeThreshold: parseInt(spread) / 100000000,
      variableTokens: avTokens,
      stableValue: uVal,
      netVal: parseInt(netVal) / 100000000,
      debtRatio: await aave.getDebtRatio(poolContract, walletAddress),
      collateral:
        (await aave.getCollateralBase(poolContract, walletAddress)) / 100000000,
      aavePositions: netPos.aavePositions,
      alphaNumPositions: netPos.numPositions,
      alphaPositionIds: netPos.ids,
      positions: netPos.positions,
      rewards: netPos.rewards,
      rewardsUsd: netPos.rewardsUsd,
      nativeExposure: Math.floor(parseInt(netPos.nativeExposure) / 10000) / 100,
    };
    console.log("NET Position:", netPosition);
    if (mailFlag) {
      console.log("Emailing position");
      mailPosition(netPosition, init);
    }
    return netPosition;
  } catch (e) {
    console.log(e.message);
    nodemailer.sendMail("calculateNetPosition() failed", e.message);
    throw new Error(e.message + " => calculateNetPosition failed");
  }
}

function getDebtTradeParams(tradeType, params = {}) {
  if (tradeType == "default") {
    if (SWAP_ATTEMPTS == 1) {
      params = { minThresh: 300, maxThresh: 500, seconds: 20 };
    } else {
      params = { minThresh: 500, maxThresh: 700, seconds: 20 };
    }
  } else if (tradeType == "profit") {
    if (SWAP_ATTEMPTS > 1) {
      throw new Error(
        "Max swap attempts for optimistic trade reached = " + SWAP_ATTEMPTS
      );
    } else {
      params = { minThresh: 0, maxThresh: 0, seconds: 10 };
    }
  } else if (tradeType == "custom") {
  } else
    throw new Error(
      "Undefined trade type " + tradeType + " in getDebtTradeParams"
    );
  console.log("getDebtTradeParams", params);
  return params;
}

// await adjustDebt(wname,"WAVAX", avTokens, "USDC", addr, "default");
// await adjustDebt(wname,"USDC", -avVal, "WAVAX", addr, "default");
async function adjustDebt(
  wname,
  debtTokenSym,
  amount,
  tokenToSym,
  walletAddress,
  tradeType
) {
  try {
    console.log(
      "adjusting debt",
      wname,
      debtTokenSym,
      amount,
      tokenToSym,
      walletAddress,
      tradeType
    );
    const debtTokenMap = await aave.getDebtTokenMap();

    let debug = "";
    let decimals;
    let debtTokenFrom;
    amount = Math.floor(amount * 1000000);
    const tokenTo = maps.addressMap.get(tokenToSym);
    for (let i = 0; i < debtTokenMap.length; i++) {
      if (debtTokenMap[i].symbol == debtTokenSym) {
        debtTokenFrom = debtTokenMap[i].token;
        decimals = debtTokenMap[i].decimals - 6;
        break;
      }
    }

    // xxx set minimum based on % of amount to be traded
    const minimum = BigNumber(10)
      .pow(decimals + 5)
      .toString();
    console.log("decimals", decimals);
    console.log("adjustDebt minimum", minimum);

    amount = BigNumber(amount).mult(BigNumber(10).pow(decimals)).toString(); // this should convert to 6 or 18
    console.log("amount", amount);
    const debtTokenContract = await aave.getDebtTokenContract(debtTokenFrom); //gets debt token contract
    const poolContract = await aave.getPoolContract(); // gets pool contract
    const tokenFrom = await aave.debtTokenUnderlyingAssetAddress(
      debtTokenContract
    );

    const tokenFromContract = await erc20.getContract(tokenFrom);
    const tokenToContract = await erc20.getContract(tokenTo);

    let tokenFromBal = await erc20.balanceOf(tokenFromContract, walletAddress);
    debug += " POS1 tokenFromBal=" + tokenFromBal;
    console.log(" POS1 tokenFromBal", tokenFromBal);
    let tokenToBal = await erc20.balanceOf(tokenToContract, walletAddress);
    console.log("tokenToBal", tokenToBal);
    let borrowAmount = BigNumber(amount)
      .minus(tokenFromBal)
      .minus(
        await aave.convertFromTokenToToken(
          tokenTo,
          tokenFrom,
          tokenToBal,
          walletAddress
        )
      )
      .toString();
    console.log("borrowAmount", borrowAmount);

    let borrowMoney = await aave.canBorrowMoney(
      tokenFrom,
      borrowAmount,
      walletAddress
    );
    console.log("borrowMoney", borrowMoney);
    const availableDebtToRepay = await aave.isDebtAvailableToRepay(
      tokenFrom,
      amount,
      tokenTo,
      walletAddress
    );

    console.log("availableDebtToRepay", availableDebtToRepay);
    if (!borrowMoney)
      throw new Error(
        "Not enough collateral in Aave to borrow",
        borrowAmount,
        tokenFrom
      );
    /* xxx this does not work as expected
    if (!availableDebtToRepay) throw new Error("Not enough debt in Aave to repay",amount,tokenFrom);
*/
    if (BigNumber(borrowAmount).gt(minimum)) {
      await aave.borrow(
        poolContract,
        debtTokenFrom,
        borrowAmount,
        walletAddress
      );
    }
    tokenFromBal = await erc20.balanceOf(tokenFromContract, walletAddress);
    debug += " POS2 tokenFromBal=" + tokenFromBal;
    console.log("tokenFromBal", tokenFromBal);

    SWAP_ATTEMPTS++;
    var { minThresh, maxThresh, seconds } = getDebtTradeParams(tradeType);
    console.log(
      "adjustDebt params for findSwap",
      minThresh,
      maxThresh,
      seconds
    );
    console.log("BEFORE GET SWAP QUOTE");
    if (BigNumber(tokenFromBal).gt(minimum)) {
      let status;
      if (tradeType == "profit") {
        console.log("CALLING SWAP for profit", tokenFrom, tokenTo, amount);
        try {
          status = await swap.findSwap(
            tokenFrom,
            tokenTo,
            amount,
            seconds,
            walletAddress,
            minThresh,
            maxThresh,
            debug
          );
        } catch (e) {
          if (e.message.search("Request failed with status code 400") >= 0)
            throw new Error(
              e.message +
                " tokenFromBal=" +
                tokenFromBal +
                " => swap.findSwap()"
            );
          else throw new Error(e.message + " => swap.findSwap()");
        }
        if (!status)
          throw new Error(
            "swap.findSwap failed to execute on SWAP_ATTEMPTS=" +
              SWAP_ATTEMPTS +
              " tradeType=" +
              tradeType
          );
      } else if (tradeType == "default") {
        console.log(
          "CALLING SWAP for forced trade",
          tokenFrom,
          tokenTo,
          amount
        );
        DEFAULT_SWAP_ATTEMPTS++;
        if (wname == "lance") {
          let override = false;
          if (DEFAULT_SWAP_ATTEMPTS > 2) override = true;
          await swap.swap(
            tokenFrom,
            tokenTo,
            amount,
            walletAddress,
            override,
            debug
          );
        } else {
          await inch.swap(tokenFrom, tokenTo, amount, walletAddress);
        }
      } else throw new Error("unrecognized tradeType => adjustDebt()");
    }
    tokensToRepay = await erc20.balanceOf(tokenToContract, walletAddress);
    /*
    await aave.repay(
      poolContract,
      tokenToContract,
      tokenTo,
      tokensToRepay,
      walletAddress
    );
*/
    if (wname == "lance")
      await checkAndReloadWallet(walletAddress, maps.addressMap.get("USDC"));
  } catch (e) {
    throw new Error(
      e.message +
        " adjustDebt failed SWAP_ATTEMPTS=" +
        SWAP_ATTEMPTS +
        " DEFAULT_SWAP_ATTEMPTS=" +
        DEFAULT_SWAP_ATTEMPTS
    );
  }
}

const BORROW_THRESHOLD = 0.01;

// checks that wallet has at least tokens of contract type, returns the difference
async function checkWallet(walletAddress, contract, tokens) {
  try {
    let wtokens = await erc20.balanceOf(contract, walletAddress);
    return BigNumber(wtokens).minus(tokens).toString();
  } catch (e) {
    console.log("Error checkWallet: " + e.message);
    throw new Error(e.message + " => checkWallet failed");
  }
}

function min(a, b) {
  if (BigNumber(a).lt(b)) return a;
  else return b;
}

// n=numerator, d=denominator, t=threshold
function checkThreshold(n, d, t) {
  if (
    parseInt(BigNumber(n).mult(1000000).div(d).abs().toString()) >
    t * 1000000
  )
    return true;
  return false;
}

// stableDiff, the target amount to be repaid should be positive
async function repay(
  walletAddress,
  idealBorrowAmount,
  actualBorrowAmount,
  borrowTokenSym,
  borrowTokenContract,
  borrowToken,
  poolTokenSym,
  poolToken,
  targetRepayAmount,
  borrowPoolContract
) {
  try {
    console.log("REPAY coins from aave", targetRepayAmount);
    // if amount in wallet is enough then continue
    // else
    //   swap pool for borrow token

    // calculate if there are enough tokens in the wallet.
    // if number is negative, swap is required
    let tokenDeficit = await checkWallet(
      walletAddress,
      borrowTokenContract,
      targetRepayAmount
    );
    console.log(
      "compare tokenDeficit",
      tokenDeficit,
      targetRepayAmount,
      BORROW_THRESHOLD
    );
    if (
      BigNumber(tokenDeficit).lt(0) &&
      checkThreshold(tokenDeficit, targetRepayAmount, BORROW_THRESHOLD)
    ) {
      tokenDeficit = BigNumber(tokenDeficit).mult(-1).toString();
      console.log(
        "not enough",
        borrowTokenSym,
        "in wallet, swapping",
        tokenDeficit
      );
      console.log("SWAPPING", tokenDeficit);
      await inch.swap(poolToken, borrowToken, tokenDeficit, walletAddress);
      let mtime = Math.floor(Date.now() / 1000);
      let subject = "pool.js repay() " + mtime;
      let body = "Repaying\n";
      body +=
        "Swapping poolToken, borrowToken, tokenDeficit, walletAddress: " +
        poolToken +
        " " +
        borrowToken +
        " " +
        tokenDeficit +
        " " +
        walletAddress +
        "\n";
      nodemailer.sendMail(subject, body);
    } else {
      console.log("enough coins found");
    }
    let borrowTokenBal = await erc20.balanceOf(
      borrowTokenContract,
      walletAddress
    );
    let repayAmount = min(borrowTokenBal, targetRepayAmount);
    console.log("borrowTokenBal", borrowTokenBal);
    console.log("targetRepayAmount", targetRepayAmount);
    console.log("idealBorrowAmount", idealBorrowAmount);
    console.log("REPAYING", repayAmount);
    //console.log(borrowPoolContract,borrowTokenContract,borrowToken,targetRepayAmount,walletAddress);
    await aave.repay(
      borrowPoolContract,
      borrowTokenContract,
      borrowToken,
      repayAmount,
      walletAddress
    );
  } catch (e) {
    console.log("Error repay: " + e.message);
    throw new Error(e.message + " => repay failed");
  }
}

// if wallet native tokens are below the min reserve, then set to reserve amount
// if there is a deficit, then the supplyToken is traded for native tokens
async function checkAndReloadWallet(walletAddress, supplyToken) {
  try {
    bal = await wall.getBalance(walletAddress);
    console.log("checking wallet balance", bal, wall.MIN_WALLET_RESERVE);
    if (BigNumber(bal).gt(wall.MIN_WALLET_RESERVE)) return;
    const price = maps.priceMap.get("WAVAX");
    let diff = BigNumber(wall.NATIVE_WALLET_RESERVE).minus(bal).toString();
    //console.log("diff=",diff);
    diff = BigNumber(diff)
      .mult(Math.floor(price * 10000000))
      .div(10000000)
      .div(BigNumber(10).pow(12))
      .toString();
    //console.log("diff=",diff);
    //console.log("swapping to reload wallet price=",price,diff);
    //return;
    await inch.swap(
      supplyToken,
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      diff,
      walletAddress
    );
  } catch (e) {
    console.log("Error checkAndReloadWallet: " + e.message);
    throw new Error(e.message + " => checkAndReloadWallet failed");
  }
}

async function convertNativeTokens(walletAddress, toToken) {
  try {
    console.log("swapping from native tokens to pool tokens");
    tokens = wall.getSpendableBalance(walletAddress);
    if (BigNumber(tokens).gt(0)) {
      await inch.swap(
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        toToken,
        tokens,
        walletAddress
      );
    }
  } catch (e) {
    console.log("Error convertNativeTokens: " + e.message);
    throw new Error(e.message + " => convertNativeTokens failed");
  }
}

async function convertTokens(walletAddress, contract, fromToken, toToken) {
  try {
    tokens = await erc20.balanceOf(contract, walletAddress);
    console.log("swapping from borrow tokens to pool tokens", tokens);
    if (BigNumber(tokens).gt(0)) {
      await inch.swap(fromToken, toToken, tokens, walletAddress);
    }
  } catch (e) {
    console.log("Error convertTokens: " + e.message);
    throw new Error(e.message + " => convertTokens failed");
  }
}

// xxx add another set of params for what tokens the swap pool requires
// that will handle the wrap/unwrap case that michael covered
async function balanceTokens(
  walletAddress,
  stableTokenSym,
  stableTokenContract,
  stableToken,
  variableTokenSym,
  variableTokenContract,
  variableToken
) {
  try {
    console.log(
      "balanceTokens",
      walletAddress,
      stableTokenSym,
      variableTokenSym
    );
    let quoteToken = variableToken;
    console.log("variableTokenSym", variableTokenSym);
    let bval;
    if (avax.isNative(variableTokenSym)) {
      console.log("getting spendable balance");
      bval = await wall.getSpendableBalance(walletAddress);
      quoteToken = maps.addressMap.get("WAVAX");
    } else {
      bval = await erc20.balanceOf(variableTokenContract, walletAddress);
    }
    console.log("variableToken", variableToken);
    busd = BigNumber(await aave.convertToUSD(quoteToken, bval, walletAddress))
      .div(BigNumber(10).pow(12))
      .toString();
    susd = await erc20.balanceOf(stableTokenContract, walletAddress);
    diff = BigNumber(busd).minus(susd).div(2).toString();
    console.log("busd", busd, "susd", susd, "diff", diff);
    if (checkThreshold(diff, busd, BORROW_THRESHOLD)) {
      if (BigNumber(diff).gt(0)) {
        // xxx need to handle decimals
        // xxx USDC hard coded
        var amt = diff;
        console.log("amt", amt);
        let tokens = await aave.convertFromTokenToToken(
          "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC - must be stablecoin supported by aave
          quoteToken,
          //BigNumber(diff).mult(BigNumber(10).pow(12)).toString(),
          amt,
          walletAddress
        );

        console.log("SWAPPING for USD", tokens);
        await inch.swap(variableToken, stableToken, tokens, walletAddress);
      } else {
        const amt = BigNumber(diff).mult(-1).toString();
        console.log("SWAPPING for AVAX", amt);
        await inch.swap(stableToken, variableToken, amt, walletAddress);
      }
    }
  } catch (e) {
    console.log("Error balanceTokens: " + e.message);
    throw new Error(e.message + " => balanceTokens failed");
  }
}

async function leverDeposit(
  walletAddress,
  poolStableToken,
  poolVariableToken,
  factoryContract,
  bankContract,
  swapPoolAddress,
  lpTokens
) {
  try {
    console.log(
      "depositing liquidity to alpha",
      poolStableToken,
      poolVariableToken
    );
    console.log(
      "deposit lpTokens",
      lpTokens,
      "swapPoolAddress",
      swapPoolAddress
    );
    //throw Error();
    //const lpContract = await erc20.getContract(lpTokens);
    //const amtLP = await erc20.balanceOf(lpContract, walletAddress);
    const panPoolData = await pan.getPoolTokens(
      "pooltokens",
      swapPoolAddress,
      lpTokens
    );
    console.log(panPoolData.positions[0].amount);
    const stableAlphaBorrowAmount = Math.floor(
      BigNumber(panPoolData.positions[0].amount).mult(18).div(10)
    ).toString();
    console.log(stableAlphaBorrowAmount);
    const variableAlphaBorrowAmount = Math.floor(
      BigNumber(panPoolData.positions[1].amount).mult(18).div(10)
    ).toString();
    // throw Error("pass");
    console.log(
      "before bankDeposit",
      walletAddress,
      poolStableToken,
      stableAlphaBorrowAmount,
      poolVariableToken,
      variableAlphaBorrowAmount,
      "amount LP " + lpTokens
    );
    await alpha.bankDeposit(
      bankContract,
      walletAddress,
      poolStableToken,
      "0",
      stableAlphaBorrowAmount,
      BigNumber(stableAlphaBorrowAmount).mult(97).div(100).toString(),
      poolVariableToken,
      "0",
      variableAlphaBorrowAmount,
      BigNumber(variableAlphaBorrowAmount).mult(97).div(100).toString(),
      lpTokens,
      0,
      9
    );
  } catch (e) {
    console.log("Error leverDeposit: " + e.message);
    throw new Error(e.message + " => leverDeposit failed");
  }
}

async function adjustPosition(
  wname,
  walletAddress,
  borrowStableTokenSym, // aave token borrowed
  borrowVariableTokenSym, // aave token borrowed
  poolStableTokenSym, // pangolin token deposited
  poolVariableTokenSym, // pangolin token deposited
  netPosition
) {
  console.log("calling adjustPosition");
  try {
    // ***** Getting the all the contracts for the tokens and pools
    const borrowPoolContract = await aave.getPoolContract();
    const bankContract = await alpha.getBankContract();
    const routerContract = await factory.getRouterContract();
    const factoryContract = await factory.getFactoryContract();
    const debtTokenMap = await aave.getDebtTokenMap();
    let stableDebtToken;
    let variableDebtToken;
    let unwrap = true;
    const borrowStableToken = maps.addressMap.get(borrowStableTokenSym);
    const borrowVariableToken = maps.addressMap.get(borrowVariableTokenSym);
    console.log("poolStableTokenSym", poolStableTokenSym);
    const poolStableToken = maps.addressMap.get(poolStableTokenSym);
    var poolVariableToken = maps.addressMap.get(poolVariableTokenSym);
    for (let i = 0; i < debtTokenMap.length; i++) {
      if (debtTokenMap[i].symbol == borrowStableTokenSym) {
        stableDebtToken = debtTokenMap[i].token;
      }
      if (debtTokenMap[i].symbol == borrowVariableTokenSym) {
        variableDebtToken = debtTokenMap[i].token;
      }
    }
    console.log("finding contracts");
    console.log("borrowStableToken", borrowStableToken);
    const borrowStableTokenContract = await erc20.getContract(
      borrowStableToken
    );
    console.log("borrowVariableToken", borrowVariableToken);
    const borrowVariableTokenContract = await erc20.getContract(
      borrowVariableToken
    );
    console.log("poolStableToken", poolStableToken);
    const poolStableTokenContract = await erc20.getContract(poolStableToken);
    const poolVariableTokenContract = false;
    if (poolVariableTokenSym == "AVAX") {
      poolVariableToken = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    } else {
      console.log("poolVariableToken", poolVariableToken);
      poolVariableTokenContract = await erc20.getContract(poolVariableToken);
    }
    console.log("stableDebtToken", stableDebtToken);
    const stableDebtTokenContract = await erc20.getContract(stableDebtToken);
    console.log("variableDebtToken", variableDebtToken);
    const variableDebtTokenContract = await erc20.getContract(
      variableDebtToken
    );
    //*************End of getting Contracts */

    //console.log("SKIPPING WITHDRAW from Alpha");

    console.log("******************************************");
    console.log("1. Withdrawing from Alpha");
    console.log("******************************************");
    console.log("withdrawing from alpha");
    console.log("alpha positionids", netPosition.alphaPositionIds);
    console.log("netPosition", netPosition);
    // first withdraw from all alpha positions
    // the last thing will be to create a new alpha position so this support reentrancy
    for (let i = 0; i < netPosition.alphaPositionIds.length; i++) {
      console.log("WITHDRAWING", netPosition.alphaPositionIds[i]);
      await alpha.bankWithdraw(
        wname,
        bankContract,
        netPosition.alphaPositionIds[i],
        walletAddress
      );
    }

    //Gets the total collateral in Aave
    const collateral = BigNumber(
      Math.floor(netPosition.collateral * 100000000)
    ).toString();
    console.log("collateral", collateral);

    //Gets the debt ratio in Aave
    // xxx could get this from the result of calculateNetPosition, already being returned
    const debtRatio = await aave.getDebtRatio(
      borrowPoolContract,
      walletAddress
    );
    const avaxUsdPrice = maps.priceMap.get("AVAX");
    const usdWalletReserve = await aave.convertToUSD(
      borrowVariableToken,
      wall.NATIVE_WALLET_RESERVE,
      walletAddress
    );
    const stableReserve = BigNumber(usdWalletReserve)
      .div(BigNumber(10).pow(12))
      .div(2)
      .toString();
    const variableReserve = BigNumber(wall.NATIVE_WALLET_RESERVE)
      .div(2)
      .toString();

    //Find the ideal borrow amount 66.66% of total collateral divided by 2
    var idealStableBorrowAmount = BigNumber(collateral)
      .mult(6666)
      .div(10000)
      .div(100)
      .div(2)
      .toString();

    //converts the stableBorrowAmount to borrowVariableToken to find the idealVariableBorrowAmount
    var idealVariableBorrowAmount = await aave.convertFromTokenToToken(
      borrowStableToken,
      borrowVariableToken,
      idealStableBorrowAmount,
      walletAddress
    );
    idealStableBorrowAmount = BigNumber(idealStableBorrowAmount)
      .minus(stableReserve)
      .toString();
    idealVariableBorrowAmount = BigNumber(idealVariableBorrowAmount)
      .add(variableReserve)
      .toString();
    console.log(
      "idealStableBorrowAmount",
      idealStableBorrowAmount,
      "idealVariableBorrowAmount",
      idealVariableBorrowAmount
    );
    console.log("netPosition.aavePositions", netPosition.aavePositions);
    console.log("borrowStableTokenSym", borrowStableTokenSym);
    let actualStableBorrowAmount = BigNumber(
      getSymbolFromArray(borrowStableTokenSym, netPosition.aavePositions).amount
    )
      .mult(-1)
      .toString();
    console.log("borrowVariableTokenSym", borrowVariableTokenSym);
    let actualVariableBorrowAmount = BigNumber(
      getSymbolFromArray(borrowVariableTokenSym, netPosition.aavePositions)
        .amount
    )
      .mult(-1)
      .toString();
    console.log("borrow Stable", actualStableBorrowAmount);
    console.log("borrow Variable", actualVariableBorrowAmount);
    console.log("ideal Stable", idealStableBorrowAmount);
    console.log("ideal Variable", idealVariableBorrowAmount);
    let stableDiff = BigNumber(idealStableBorrowAmount)
      .minus(actualStableBorrowAmount)
      .toString();
    let variableDiff = BigNumber(idealVariableBorrowAmount)
      .minus(actualVariableBorrowAmount)
      .toString();

    console.log("stableDiff", stableDiff);
    console.log("variableDiff", variableDiff);

    // xxx maybe this should be swapPoolVariableToken instead of borrowVariableToken
    const panPoolAddress = await factory.getPanPair(
      factoryContract,
      poolStableToken,
      borrowVariableToken
    );
    console.log("get contract panPoolAddress", panPoolAddress);
    const panPoolContract = await erc20.getContract(panPoolAddress);
    //console.log("panPoolContract",panPoolContract);
    var lp = await erc20.balanceOf(panPoolContract, walletAddress);
    console.log("lp", lp);

    if (BigNumber(lp).isZero()) {
      if (
        BigNumber(stableDiff).lt(0) &&
        checkThreshold(stableDiff, idealStableBorrowAmount, BORROW_THRESHOLD)
      ) {
        absStableDiff = BigNumber(stableDiff).mult(-1).toString();
        /*
        await repay(walletAddress,idealStableBorrowAmount,actualStableBorrowAmount,
          borrowStableTokenSym, borrowStableTokenContract,borrowStableToken,
          poolStableTokenSym, poolStableToken, absStableDiff, borrowPoolContract);
*/
      }
      if (
        BigNumber(variableDiff).lt(0) &&
        checkThreshold(
          variableDiff,
          idealVariableBorrowAmount,
          BORROW_THRESHOLD
        )
      ) {
        absVariableDiff = BigNumber(variableDiff).mult(-1).toString();
        /*
        await repay(walletAddress,idealVariableBorrowAmount,actualVariableBorrowAmount,
          borrowVariableTokenSym, borrowVariableTokenContract,borrowVariableToken,
          poolVariableTokenSym, poolVariableToken, absVariableDiff, borrowPoolContract);
*/
      }
      if (
        BigNumber(stableDiff).gt(0) &&
        checkThreshold(stableDiff, idealStableBorrowAmount, BORROW_THRESHOLD)
      ) {
        console.log("BORROW stable coins from aave", stableDiff);
        await aave.borrow(
          borrowPoolContract,
          stableDebtToken,
          stableDiff,
          walletAddress
        );
      }
      //console.log("variableDebtToken", variableDebtToken, "borrowVariableToken",borrowVariableToken);
      if (
        BigNumber(variableDiff).gt(0) &&
        checkThreshold(
          variableDiff,
          idealVariableBorrowAmount,
          BORROW_THRESHOLD
        )
      ) {
        console.log("BORROW variable coins from aave", variableDiff);
        await aave.borrow(
          borrowPoolContract,
          variableDebtToken,
          variableDiff,
          walletAddress
        );
      }

      await checkAndReloadWallet(walletAddress, poolVariableToken);

      if (poolStableTokenSym != borrowStableTokenSym)
        await convertTokens(
          walletAddress,
          borrowStableTokenContract,
          borrowStableToken,
          poolStableToken
        );
      if (poolVariableTokenSym != borrowVariableTokenSym)
        await convertTokens(
          walletAddress,
          borrowVariableTokenContract,
          borrowVariableToken,
          poolVariableToken
        );
      await balanceTokens(
        walletAddress,
        poolStableTokenSym,
        poolStableTokenContract,
        poolStableToken,
        poolVariableTokenSym,
        poolVariableTokenContract,
        poolVariableToken
      );

      var poolStableTokenBal = await erc20.balanceOf(
        poolStableTokenContract,
        walletAddress
      );

      var poolVariableTokenBal;
      if (poolVariableTokenSym == "AVAX") {
        poolVariableTokenBal = await wall.getSpendableBalance(walletAddress);
      } else {
        poolVariableTokenBal = await erc20.balanceOf(
          poolVariableTokenContract,
          walletAddress
        );
      }

      console.log("creating liquidity position", poolStableTokenBal);
      await factory.addPanLiquidityAVAX(
        routerContract,
        poolStableToken,
        poolStableTokenBal,
        "0",
        poolVariableTokenBal,
        "0",
        walletAddress
      );
    }

    lp = await erc20.balanceOf(panPoolContract, walletAddress);

    // xxx michael used the unwrap flag here to switch from poolVariableToken to borrowVariableToken
    leverDeposit(
      walletAddress,
      poolStableToken,
      borrowVariableToken,
      factoryContract,
      bankContract,
      panPoolAddress,
      lp
    );

    console.log("Position Adjusted!!!");
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => adjustPosition failed");
  }
}

/*
async function main() {
  try {
    var wname = "default";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    wallet = await wall.init(wname);
    const poolContract = await aave.getPoolContract();
    const debt = await aave.getDebtRatio(poolContract, wallet.address);
    console.log(debt);
    //await nodemailer.init(wname);
    //  await calculateAndAdjust(wname, wallet.address, false);
    await calculateNetPosition(wname, wallet.address);
    //await adjustDebt("USDC", 25.7, "WAVAX", wallet.address);
    const bankContract = await alpha.getBankContract();
    await adjustPosition(
      wname,
      wallet.address,
      "11879",
      "USDC",
      "WAVAX",
      "USDC.e",
      "AVAX"
    );

    // await alpha.bankWithdraw(wname, bankContract, "11969", wallet.address);
  } catch (e) {
    console.log(e.message);
  }
}

main()
*/

module.exports = Object.assign({
  adjustPosition,
  calculateNetPosition,
  calculateAndAdjust,
  calculateRebalanceAndAdjust,
});
