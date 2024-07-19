/*
Caching notes:
  ./cache/chain/wallet/weth.json stores the last wallet WETH value prior to any changes
  poolOp.addPositionChanges() checks that the next WETH value is either higher or lower
    after a change has taken place.  The new value is stored in the cache
  poolOp.getPositions - after calling poolOp.getPositions, the value of pos.wallet.weth should
    be compared with the value in cache

  liquidity positions are cached by Uniswap index id
  removing, adding, minting need to update the Uniswap index id entry

  ethquotes - stores multiple eth quotes from eth, avax, poly, and op chains
*/

const BigNumber = require("big-number");
const multi = require("./multiswap.js");
const user = require("./user.js");
const utils = require("./utils.js");
const unic = require("./unicache.js");
const chain = require("./chain.js");
const univ3 = require("./univ3.js");
const quote = require("./quote.js");
const wall = require("./wallet.js");
const erc20 = require("./erc20.js");
const maps = require("./maps.js");
const inch = require("./1inch.js");
const web = require("./web3.js");
const web3 = web.web3;
const nodemailer = require("./nodemailer.js");

let USDC_ADDRESS;
let WETH_ADDRESS;
let ETH_ADDRESS;
let MATIC_ADDRESS;

let INIT_SPAN = 10000;
//let THRESHOLD_RATIO = 0.04; // TS_SPAN = 64
let THRESHOLD_RATIO = 0.02; // TS_SPAN = 128
let SPAN_VALUE = INIT_SPAN;
let TRADE_THRESHOLD = SPAN_VALUE * THRESHOLD_RATIO;
const ADJUST_THRESHOLD = 0.9;
const WALLET_ETH_MIN = 0.5;
const WALLET_ETH_BUFFER = 2;
const WALLET_MATIC_BUFFER = 10;
const WALLET_MATIC_MIN = 2;
const TRADING_WETH_BUFFER = 10000;

async function initMulti(port, ch = false, callfrom = false) {
  console.log("initMulti ch=", ch);
  if (!ch) ch = port.uniswapV3.chain; // xxxx note this is the default
  //console.log("initMulti2 ch=",ch);
  port = await wall.initPort(port, ch);
  //console.log("poolOp init() chain=",web3.chain,port);
  univ3.init();
  console.log("completed univ3 init()");
  USDC_ADDRESS = chain.getAddress("USDC");
  WETH_ADDRESS = chain.getAddress("WETH");
  ETH_ADDRESS = chain.getAddress("ETH");
  let tokenAddresses = [
    WETH_ADDRESS, // weth
    USDC_ADDRESS, // usdc
  ];
  console.log("tokenAddresses=", tokenAddresses, web3.chain);
  if (web3.chain == "poly") {
    //    THRESHOLD_RATIO = 0.1;
    //    INIT_SPAN = 10000;
    //    THRESHOLD_RATIO = 0.02; SPAN_VALUE = INIT_SPAN;
    //    TRADE_THRESHOLD = SPAN_VALUE*THRESHOLD_RATIO;
    MATIC_ADDRESS = chain.getAddress("MATIC");
    tokenAddresses.push(MATIC_ADDRESS);
  }
  await erc20.initMaps(tokenAddresses);
  //console.log("init ETH_ADDRESS", ETH_ADDRESS, web3.chain);
  if (port.email) {
    if (typeof port.email === "string") {
      nodemailer.init(port.email);
    } else {
      nodemailer.init(web3.chain);
    }
  }
  console.log("exiting initMulti web3.chain=", web3.chain, callfrom);
  return port;
}

async function init(email) {
  console.log("poolOp init() chain=", web3.chain);
  univ3.init();
  console.log("completed univ3 init()");
  USDC_ADDRESS = chain.getAddress("USDC");
  WETH_ADDRESS = chain.getAddress("WETH");
  ETH_ADDRESS = chain.getAddress("ETH");
  let tokenAddresses = [
    WETH_ADDRESS, // weth
    USDC_ADDRESS, // usdc
  ];
  console.log("tokenAddresses=", tokenAddresses);
  if (web3.chain == "poly") {
    //    THRESHOLD_RATIO = 0.1;
    INIT_SPAN = 100;
    THRESHOLD_RATIO = 0.04;
    SPAN_VALUE = INIT_SPAN;
    TRADE_THRESHOLD = SPAN_VALUE * THRESHOLD_RATIO;
    MATIC_ADDRESS = chain.getAddress("MATIC");
    tokenAddresses.push(MATIC_ADDRESS);
  }
  await erc20.initMaps(tokenAddresses);
  console.log("init ETH_ADDRESS", ETH_ADDRESS);
  if (email) {
    if (typeof email === "string") nodemailer.setToOption(email);
    else nodemailer.init(web3.chain);
  }
}

function compoundPosition(pos) {
  SPAN_VALUE = INIT_SPAN + pos.profit;
  TRADE_THRESHOLD = SPAN_VALUE * THRESHOLD_RATIO;
  console.log("COMPOUND POSITION", SPAN_VALUE, TRADE_THRESHOLD);
}

function checkPositions(pos) {
  let positions = pos.positions;
  for (let i = 0; i < positions.length; i++) {
    //console.log("Checking pos", i, positions[i]);
    if (!isNaN(positions[i].id)) {
      console.log("FOUND number id", positions[i].id);
    }
  }
  return 0;
}

function checkWallet(positions, sym, chin = false) {
  let ch = web3.chain;
  if (chin) ch = chin;
  for (let i = 0; i < positions.length; i++) {
    //console.log("Checking pos", i, positions[i]);
    if (positions[i].id == "wallet" && positions[i].chain == ch) {
      //console.log("Found wallet");
      if (positions[i].symbol == sym) {
        //console.log("Found sym");
        return (
          parseInt(
            BigNumber(positions[i].amount)
              .mult(100)
              .div(BigNumber(10).pow(positions[i].decimals))
              .toString()
          ) / 100
        );
      }
    }
  }
  return 0;
}

function getWallet(port, ch) {
  for (let i = 0; i < port.wallets.length; i++) {
    if (port.wallets[i].chain == ch) return port.wallets[i];
  }
  return false;
}

async function managePolyMulti(port, pos) {
  try {
    let c = checkWallet(pos.positions, "MATIC", "poly");
    //console.log("getSpendableBalance=",c);
    c =
      parseInt(
        BigNumber(c)
          .div(BigNumber(10).pow(18 - 6))
          .toString()
      ) / 1000000;
    //console.log("Comparing MATIC=",c," with WALLET_MATIC_BUFFER");
    if (c < WALLET_MATIC_MIN) {
      let q = await quote.oneFastQuote(chain.getAddress("MATIC"), "poly");
      let amt = (WALLET_MATIC_BUFFER - c) * q;
      amt = Math.floor(amt * 1000000);
      port = await initMulti(port, "poly");
      let w = getWallet(port, "poly");
      await inch.swap(USDC_ADDRESS, MATIC_ADDRESS, amt, w.walletAddress);
      let body = "MATIC total increasing\n";
      body += await addPositionChangesMulti(
        port,
        pos,
        "poly",
        false,
        "managePoly.addMATIC"
      );
      nodemailer.sendMail("Swapping USDC for MATIC", body);
      return true;
    }
    // defund positions that are out of range
    /*  xxx no need to defund, if the portfolio declared which chains can have positions
    this may avoid checking for uniswap positions

    let tid = await defundPositionMulti(port,pos);
    if (tid)
    {
      return true;
    }
*/
    return false;
  } catch (e) {
    console.log(e.message, " in managePolyMulti()");
    throw new Error(e.message + " => managePoly() failed");
  }
}
async function managePoly(wname, walletAddress, pos) {
  try {
    let c = checkWallet(pos.positions, "MATIC", "poly");
    //console.log("getSpendableBalance=",c);
    c =
      parseInt(
        BigNumber(c)
          .div(BigNumber(10).pow(18 - 6))
          .toString()
      ) / 1000000;
    //console.log("Comparing MATIC=",c," with WALLET_MATIC_BUFFER");
    if (c < WALLET_MATIC_MIN) {
      let q = await quote.oneFastQuote(chain.getAddress("MATIC"), web3.chain);
      let amt = (WALLET_MATIC_BUFFER - c) * q;
      amt = Math.floor(amt * 1000000);
      await inch.swap(USDC_ADDRESS, MATIC_ADDRESS, amt, walletAddress);
      let body = "MATIC total increasing\n";
      body += await addPositionChanges(
        wname,
        walletAddress,
        pos,
        false,
        "managePoly.addMATIC"
      );
      nodemailer.sendMail("Swapping USDC for MATIC", body);
      return true;
    }
    // defund positions that are out of range
    let tid = await defundPosition(wname, walletAddress, pos);
    if (tid) {
      return true;
    }
    return false;
  } catch (e) {
    console.log(e.message, " in managePoly()");
    throw new Error(e.message + " => managePoly() failed");
  }
}
async function manageOpMulti(port, pos) {
  try {
    console.log("manageOp");
    let c = checkWallet(pos.positions, "ETH");
    let wc = checkWallet(pos.positions, "WETH");
    let u = checkWallet(pos.positions, "USDC");
    console.log("ETH", c);
    console.log("WETH", wc);
    console.log("USDC", u);
    // if ETH is below MIN threshold, then add to BUFFER amount
    if (c < WALLET_ETH_MIN && wc > WALLET_ETH_BUFFER) {
      let amt = WALLET_ETH_BUFFER - c;
      console.log("amt from weth to eth", amt);
      amt = BigNumber(Math.floor(amt * 1000000))
        .mult(BigNumber(10).pow(18 - 6))
        .toString();
      console.log("Buying amt from weth to eth", amt);
      let w = getWallet(port, "op");
      await inch.swap(WETH_ADDRESS, ETH_ADDRESS, amt, w.walletAddress);
      let body = "ETH total increasing\n";
      body += await addPositionChangesMulti(
        port,
        pos,
        "op",
        "down",
        "manageOp.addETH"
      );
      nodemailer.sendMail("Swapping WETH for ETH", body);
      return true;
    }
    console.log("before defundPos");
    // defund positions that are out of range
    let tid = await defundPositionMulti(port, pos);
    if (tid) {
      return true;
    }
    // if you don't have enough USDC to cover a span, then USDC may require
    // funding but ignore for now
    else if (u < SPAN_VALUE) {
      console.log("USDC requires funding");
      //throw new Error("USDC requires funding");
    }
    return false;
  } catch (e) {
    console.log(e.message, " in manageOp()");
    throw new Error(e.message + " => manageOp() failed");
  }
}

async function manageOp(wname, walletAddress, pos) {
  try {
    console.log("manageOp");
    let c = checkWallet(pos.positions, "ETH");
    let wc = checkWallet(pos.positions, "WETH");
    let u = checkWallet(pos.positions, "USDC");
    console.log("ETH", c);
    console.log("WETH", wc);
    console.log("USDC", u);
    // if ETH is below MIN threshold, then add to BUFFER amount
    if (c < WALLET_ETH_MIN && wc > WALLET_ETH_BUFFER) {
      let amt = WALLET_ETH_BUFFER - c;
      console.log("amt from weth to eth", amt);
      amt = BigNumber(Math.floor(amt * 1000000))
        .mult(BigNumber(10).pow(18 - 6))
        .toString();
      console.log("Buying amt from weth to eth", amt);
      await inch.swap(WETH_ADDRESS, ETH_ADDRESS, amt, walletAddress);
      let body = "ETH total increasing\n";
      body += await addPositionChanges(
        wname,
        walletAddress,
        pos,
        "down",
        "manageOp.addETH"
      );
      nodemailer.sendMail("Swapping WETH for ETH", body);
      return true;
    }
    console.log("before defundPos");
    // defund positions that are out of range
    let tid = await defundPosition(wname, walletAddress, pos);
    if (tid) {
      return true;
    }
    // if you don't have enough USDC to cover a span, then USDC may require
    // funding but ignore for now
    else if (u < SPAN_VALUE) {
      console.log("USDC requires funding");
      //throw new Error("USDC requires funding");
    }
    return false;
  } catch (e) {
    console.log(e.message, " in manageOp()");
    throw new Error(e.message + " => manageOp() failed");
  }
}

async function defundPositionMulti(port, pos, all = false) {
  try {
    let positions = pos.positions;
    //console.log("defunding",positions);
    let upos = false;
    for (let i = 0; i < positions.length; i++) {
      //console.log("checking i=",i,positions[i].id,univ3.lookupLiquidity(positions[i].tickLower));
      // if id is a number and the position has liquidity
      if (
        !isNaN(positions[i].id) &&
        univ3.lookupLiquidity(positions[i].tickLower) > 0
      ) {
        // if the position is in-range or the all flag is set (to defund active positions)
        if (!positions[i].inRange || all) {
          console.log("FOUND number id", positions[i].id);
          //upos = univ3.lookupPosition(positions[i].id);
          upos = positions[i].id;
          //console.log("upos=",upos);
          break;
        }
      }
    }
    //console.log("upos=",upos);
    if (upos) {
      console.log("defund", upos, positions);
      port = await initMulti(port, port.uniswapV3.chain, "defund");
      let c = await univ3.getContract();
      await univ3.removeLiquidity(
        port.uniswapV3.wname,
        c,
        port.uniswapV3.walletAddress,
        upos
      );
      console.log("positions=", positions, " upos=", upos);
      let epos = findEthPosById(positions, upos);
      let direction = false;
      if (pos.quote < epos.pupper) direction = "up";
      let body = "Defunding=" + upos + "\n";
      body += await addPositionChangesMulti(
        port,
        pos,
        port.uniswapV3.chain,
        direction,
        "defundPositionMulti"
      );
      nodemailer.sendMail("Defunding position", body);
      return upos;
    }
    return false;
  } catch (e) {
    console.log(e.message, " in defundPositionMulti()");
    throw new Error(e.message + " => defundPositionMulti() failed");
  }
}

async function defundPosition(wname, walletAddress, pos, all = false) {
  try {
    let positions = pos.positions;
    //console.log("defunding",positions);
    let upos = false;
    for (let i = 0; i < positions.length; i++) {
      //console.log("checking i=",i,positions[i].id,univ3.lookupLiquidity(positions[i].tickLower));
      // if id is a number and the position has liquidity
      if (
        !isNaN(positions[i].id) &&
        univ3.lookupLiquidity(positions[i].tickLower) > 0
      ) {
        // if the position is in-range or the all flag is set (to defund active positions)
        if (!positions[i].inRange || all) {
          console.log("FOUND number id", positions[i].id);
          //upos = univ3.lookupPosition(positions[i].id);
          upos = positions[i].id;
          //console.log("upos=",upos);
          break;
        }
      }
    }
    //console.log("upos=",upos);
    if (upos) {
      console.log("defund", upos, positions);
      let c = await univ3.getContract();
      await univ3.removeLiquidity(wname, c, walletAddress, upos);
      console.log("positions=", positions, " upos=", upos);
      let epos = findEthPosById(positions, upos);
      let direction = false;
      if (pos.quote < epos.pupper) direction = "up";
      let body = "Defunding=" + upos + "\n";
      body += await addPositionChanges(
        wname,
        walletAddress,
        pos,
        direction,
        "defundPosition"
      );
      nodemailer.sendMail("Defunding position", body);
      return upos;
    }
    return false;
  } catch (e) {
    console.log(e.message, " in defundPosition()");
    throw new Error(e.message + " => defundPosition() failed");
  }
}

async function sellMulti(port, vamt, pos) {
  try {
    console.log("SELLING vamt=", vamt);
    let ch = await multi.swap(port, "WETH", "USDC", vamt);
    let now = Math.floor(Date.now() / 1000);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let subject =
      "Profit=" +
      profit +
      " sell($" +
      Math.floor(vamt * pos.quote) +
      ") of ETH " +
      now;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Selling " + vamt + " ETH on chain" + ch + "\n\n";
    body += await addPositionChangesMulti(port, pos, ch, "down", "sell");
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,subject+" "+body);
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => sell() failed");
  }
}
async function sell(wname, vamt, pos, walletAddress) {
  try {
    let vamount = BigNumber(Math.floor(vamt * 1000000))
      .mult(BigNumber(10).pow(18 - 6))
      .toString();
    console.log("SELLING vamount=", vamount, "vamt", vamt);
    await inch.swap(WETH_ADDRESS, USDC_ADDRESS, vamount, walletAddress);
    let now = Math.floor(Date.now() / 1000);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let subject =
      "Profit=" +
      profit +
      " sell($" +
      Math.floor(vamt * pos.quote) +
      ") of ETH " +
      now;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Selling " + vamt + " ETH\n\n";
    body += await addPositionChanges(wname, walletAddress, pos, "down", "sell");
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,subject+" "+body);
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => sell() failed");
  }
}
async function buyMulti(port, vusd, pos) {
  try {
    console.log("BUYING vusd", vusd);
    let ch = await multi.swap(port, "USDC", "WETH", vusd);
    let now = Math.floor(Date.now() / 1000);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let subject =
      "Profit=" + profit + " buy($" + Math.floor(vusd) + ") of ETH " + now;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Buying $" + vusd + "on chain" + ch + "\n\n";
    body += await addPositionChangesMulti(port, pos, ch, "up", "buy");
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,subject+" "+body);
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => buy() failed");
  }
}
async function buy(wname, vusd, pos, walletAddress) {
  try {
    let samount = Math.floor(vusd * 1000000);
    console.log("BUYING vusd", vusd, "samount", samount);
    await inch.swap(USDC_ADDRESS, WETH_ADDRESS, samount, walletAddress);
    let now = Math.floor(Date.now() / 1000);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let subject =
      "Profit=" + profit + " buy($" + Math.floor(vusd) + ") of ETH " + now;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Buying $" + vusd + "\n\n";
    body += await addPositionChanges(wname, walletAddress, pos, "up", "buy");
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,subject+" "+body);
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => buy() failed");
  }
}

function prunePositions(pos) {
  let npos = [];
  for (let i = 0; i < pos.positions.length; i++) {
    if (!isNaN(pos.positions[i].id) && pos.positions[i].liquidity == 0) {
      //console.log("SKIPPING pos",pos.positions[i]);
      continue;
    } else if (
      String(pos.positions[i].id).search("fees-") >= 0 &&
      pos.positions[i].usd == 0
    ) {
      //console.log("SKIPPING pos",pos.positions[i]);
      continue;
    }
    npos.push(pos.positions[i]);
  }
  pos.positions = npos;
  return pos;
}

async function addPositionChangesMulti(port, pos, ch, direction, callfrom) {
  let trace = "a";
  try {
    let s = JSON.stringify(pos, null, 2) + "\n\n";
    let wweth0 = checkWallet(pos.positions, "WETH", ch);
    console.log("addPositionChanges", wweth0, pos);
    let wweth1;
    let tries = 0;
    const MAX_TRIES = 5;
    console.log("addPositionChange direction=", direction);
    while (true) {
      trace = trace + "b";
      let newpos = await getPositionsMulti(port);
      wweth1 = checkWallet(newpos.positions, "WETH", ch);
      console.log("addPositionChanges", wweth1, newpos);
      trace = trace + "c";
      newpos = prunePositions(newpos);
      trace = trace + "d";
      if (
        (direction == "up" && wweth1 <= wweth0) ||
        (direction == "down" && wweth1 >= wweth0)
      ) {
        trace = trace + "e";
        tries++;
        let poss = JSON.stringify(pos, null, 2) + "\n";
        poss += JSON.stringify(newpos, null, 2) + "\n";
        if (tries >= MAX_TRIES) {
          unic.removeTagId("wallet", "weth", ch);
          throw new Error(
            "addPositionChangeMulti callfrom=" +
              callfrom +
              " wweth0=" +
              wweth0 +
              " wweth1=" +
              wweth1 +
              " trace=" +
              trace +
              " tries=" +
              tries +
              "\n\n" +
              poss
          );
        }
        nodemailer.sendMail(
          "WETH wallet error: " + callfrom + " ch=" + ch,
          "Detected bad WETH wweth0=" +
            wweth0 +
            " wweth1=" +
            wweth1 +
            " dir=" +
            direction +
            " trace=" +
            trace +
            " tries=" +
            tries +
            "\n\n" +
            poss
        );
        //throw new Error("addPositionChange wweth0="+wweth0+" wweth1="+wweth1+" trace=",trace);
        await utils.sleep(2 * tries);
        trace = trace + "f";
        continue;
      }
      s += JSON.stringify(newpos, null, 2) + "\n";
      break;
    }
    trace = trace + "g";
    let w = { wweth: wweth1 };
    trace = trace + "h";
    unic.writeTagId("wallet", "weth", w, ch);
    trace = trace + "i";
    return s;
  } catch (e) {
    console.log(e.message);
    throw new Error(
      e.message + " trace=" + trace + " => addPositionChangesMulti() failed"
    );
  }
}

async function addPositionChanges(
  wname,
  walletAddress,
  pos,
  direction,
  callfrom
) {
  let trace = "a";
  try {
    pos = prunePositions(pos);
    let s = JSON.stringify(pos, null, 2) + "\n\n";
    let wweth0 = checkWallet(pos.positions, "WETH");
    console.log("addPositionChanges", wweth0, pos);
    let wweth1;
    let tries = 0;
    const MAX_TRIES = 5;
    console.log("addPositionChange direction=", direction);
    while (true) {
      trace = trace + "b";
      let newpos = await getPositions(wname, walletAddress);
      wweth1 = checkWallet(newpos.positions, "WETH");
      console.log("addPositionChanges", wweth1, newpos);
      trace = trace + "c";
      newpos = prunePositions(newpos);
      trace = trace + "d";
      if (
        (direction == "up" && wweth1 <= wweth0) ||
        (direction == "down" && wweth1 >= wweth0)
      ) {
        trace = trace + "e";
        tries++;
        let poss = JSON.stringify(pos, null, 2) + "\n";
        poss += JSON.stringify(newpos, null, 2) + "\n";
        if (tries >= MAX_TRIES) {
          unic.removeTagId("wallet", "weth");
          throw new Error(
            "addPositionChange callfrom=" +
              callfrom +
              " wweth0=" +
              wweth0 +
              " wweth1=" +
              wweth1 +
              " trace=" +
              trace +
              " tries=" +
              tries +
              "\n\n" +
              poss
          );
        }
        nodemailer.sendMail(
          "WETH wallet error: " + callfrom,
          "Detected bad WETH wweth0=" +
            wweth0 +
            " wweth1=" +
            wweth1 +
            " dir=" +
            direction +
            " trace=" +
            trace +
            " tries=" +
            tries +
            "\n\n" +
            poss
        );
        //throw new Error("addPositionChange wweth0="+wweth0+" wweth1="+wweth1+" trace=",trace);
        await utils.sleep(3 * tries);
        //return await addPositionChanges(wname,walletAddress,pos,direction)
        trace = trace + "f";
        continue;
      }
      s += JSON.stringify(newpos, null, 2) + "\n";
      break;
    }
    trace = trace + "g";
    let w = { wweth: wweth1 };
    trace = trace + "h";
    unic.writeTagId("wallet", "weth", w);
    trace = trace + "i";
    return s;
  } catch (e) {
    console.log(e.message);
    throw new Error(
      e.message + " trace=" + trace + " => addPositionChanges() failed"
    );
  }
}

function getUsd(pos, tid) {
  let usd = 0;
  for (let i = 0; i < pos.length; i++) {
    if (pos[i].id == tid) {
      usd += pos[i].usd;
    }
  }
  return usd;
}

function findInRange(pos) {
  try {
    let positions = pos.positions;
    let emptyGoodPos = false;
    for (let i = 0; i < positions.length; i++) {
      if (!isNaN(positions[i].id)) {
        if (positions[i].inRange && positions[i].symbol == "ETH") {
          // if position is already active with liquidity
          if (positions[i].liquidity > 0) return positions[i];

          let { lowerNut, upperNut } = univ3.findTicks(pos.quote);

          // if position has no liquidity but is the exact one that would be minted
          if (positions[i].tickLower == lowerNut) emptyGoodPos = positions[i];
        }
      }
    }
    if (emptyGoodPos) return emptyGoodPos;
    return false;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => removeOutOfRange() failed");
  }
}

function findEthPosById(positions, tid) {
  try {
    for (let i = 0; i < positions.length; i++) {
      if (
        positions[i].id == tid &&
        ["ETH", "WETH"].includes(positions[i].symbol)
      ) {
        return positions[i];
      }
    }
    throw new Error(
      "Could not find tid=" + tid + " symbol=" + positions[i].symbol
    );
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => findPosByIdSymbol() failed");
  }
}

function findOutOfRange(pos) {
  try {
    let positions = pos.positions;
    let tid = false;
    for (let i = 0; i < positions.length; i++) {
      if (!isNaN(positions[i].id)) {
        if (
          !positions[i].inRange &&
          positions[i].liquidity > 0 &&
          positions[i].symbol == "ETH"
        ) {
          tid = positions[i].id;
        }
      }
    }
    return tid;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => removeOutOfRange() failed");
  }
}

function getWalletAmount(pos, token) {
  for (let i = 0; i < pos.length; i++) {
    if (pos[i].id == "wallet" && pos[i].symbol == token) return pos[i].amount;
  }
  return 0;
}
function getWalletUsd(pos, token) {
  for (let i = 0; i < pos.length; i++) {
    if (pos[i].id == "wallet" && pos[i].symbol == token) return pos[i].usd;
  }
  return 0;
}

async function fundIncreaseMulti(port, pos, tid, usd) {
  try {
    port = await initMulti(port, port.uniswapV3.chain, "fundIncreaseMulti");
    console.log("ADJUST LIQUIDITY", tid, SPAN_VALUE - usd);
    let c = await univ3.getContract();
    await univ3.increaseLiquidity(
      port.uniswapV3.wname,
      c,
      port.uniswapV3.walletAddress,
      tid,
      SPAN_VALUE - usd
    );
    let now = Math.floor(Date.now() / 1000);
    let subject = "Increasing liqiudity from " + Math.floor(usd);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Increasing by " + (SPAN_VALUE - usd) + "\n\n";
    body += await addPositionChangesMulti(
      port,
      pos,
      port.uniswapV3.chain,
      "down",
      "increase liquidity"
    );
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,"Increasing liquidity");
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => fundIncreaseMulti() failed");
  }
}

async function fundIncrease(wname, walletAddress, pos, tid, usd) {
  try {
    console.log("ADJUST LIQUIDITY", tid, SPAN_VALUE - usd);
    let c = await univ3.getContract();
    await univ3.increaseLiquidity(
      wname,
      c,
      walletAddress,
      tid,
      SPAN_VALUE - usd
    );
    let now = Math.floor(Date.now() / 1000);
    let subject = "Increasing liqiudity from " + Math.floor(usd);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Increasing by " + (SPAN_VALUE - usd) + "\n\n";
    body += await addPositionChanges(
      wname,
      walletAddress,
      pos,
      "down",
      "increase liquidity"
    );
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,"Increasing liquidity");
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => fundIncrease() failed");
  }
}

async function fundMintMulti(port, pos) {
  try {
    console.log("MINT");
    let { lowerNut, upperNut } = univ3.findTicks(pos.quote);

    let c = await univ3.getContract();
    await univ3.mint(c, port.uniswapV3.walletAddress, lowerNut, SPAN_VALUE);
    let now = Math.floor(Date.now() / 1000);
    let subject = "Minting at " + lowerNut + " " + now;
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += await addPositionChangesMulti(
      port,
      pos,
      port.uniswapV3.chain,
      "down",
      "mint"
    );
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,"Minting");
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => fundMintMulti() failed");
  }
}

async function fundMint(wname, walletAddress, pos) {
  try {
    console.log("MINT");
    let { lowerNut, upperNut } = univ3.findTicks(pos.quote);

    let c = await univ3.getContract();
    await univ3.mint(c, walletAddress, lowerNut, SPAN_VALUE);
    let now = Math.floor(Date.now() / 1000);
    let subject = "Minting at " + lowerNut + " " + now;
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += await addPositionChanges(wname, walletAddress, pos, "down", "mint");
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,"Minting");
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => fundMint() failed");
  }
}

async function fundPositionsMulti(port, pos) {
  try {
    //console.log("fundPositionMulti");
    let position = findInRange(pos);
    if (position) {
      let tid = position.id;
      //console.log("fundPostions found ", tid);
      let usd = getUsd(pos.positions, tid);
      //console.log("fundPostions found ", position, "usd=",usd);
      if (usd < SPAN_VALUE * ADJUST_THRESHOLD) {
        port = await initMulti(port, port.uniswapV3.chain, "fundIncreaseMulti");
        await fundIncreaseMulti(port, pos, tid, usd);
      } else {
        console.log("HOLD POSITION");
        let json = JSON.stringify(pos, null, 2);
        //unic.saveFile("update",wname,"Holding position"+"\n\n"+json+"\n");
      }
    } else {
      port = await initMulti(port, port.uniswapV3.chain, "fundMintMulti");
      await fundMintMulti(port, pos);
    }
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => fundPositionsMulti() failed");
  }
}

async function fundPositions(wname, walletAddress, pos) {
  try {
    console.log("fundPosition");
    let position = findInRange(pos);
    if (position) {
      let tid = position.id;
      console.log("fundPostions found ", tid);
      let usd = getUsd(pos.positions, tid);
      console.log("fundPostions found ", position, "usd=", usd);
      if (usd < SPAN_VALUE * ADJUST_THRESHOLD) {
        await fundIncrease(wname, walletAddress, pos, tid, usd);
      } else {
        console.log("HOLD POSITION");
        let json = JSON.stringify(pos, null, 2);
        //unic.saveFile("update",wname,"Holding position"+"\n\n"+json+"\n");
      }
    } else {
      await fundMint(wname, walletAddress, pos);
    }
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => fundPositions() failed");
  }
}

function printMap(name, map) {
  console.log(name);
  map.forEach((value, key) => {
    console.log(key, value);
  });
}

async function adjustMulti(port) {
  try {
    //console.log("PORT==========================",port);
    let newpos = await getPositionsMulti(port);
    console.log("got getPositionsMulti");
    for (let i = 0; i < port.wallets.length; i++) {
      port = await initMulti(port, port.wallets[i].chain, "port.wallet" + i);
      //console.log("assertWeth",port);
      //console.log("assertWeth",newpos);
      await assertWeth(newpos, "=", port.wallets[i].chain);
      //console.log("VUSD",newpos.netVusd,"threshold",TRADE_THRESHOLD);
      //console.log("balance vusd < -thresh",newpos.netVusd < -TRADE_THRESHOLD);
      if (port.wallets[i].chain == "op") {
        if (await manageOpMulti(port, newpos)) return;
      } else if (port.wallets[i].chain == "poly") {
        if (await managePolyMulti(port, newpos)) return;
      }
    }
    //console.log("checking if vusd > TRADE_THRESHOLD");
    if (parseFloat(newpos.netVusd) > TRADE_THRESHOLD) {
      let wc = checkWallet(newpos.positions, "WETH", port.uniswapV3.chain);
      if (wc > parseFloat(newpos.netVamt))
        await sellMulti(port, newpos.netVamt, newpos);
      else {
        port = await initMulti(port, port.uniswapV3.chain, "defundPosition");
        let tid = await defundPositionMulti(port, newpos, true);
        if (tid) return;
        else
          throw new Error("Not enough WETH " + wc + " => adjustMulti() failed");
      }
    } else if (parseFloat(newpos.netVusd) < -TRADE_THRESHOLD) {
      console.log("need to sell usdc to buy weth");
      let u = checkWallet(newpos.positions, "USDC", port.uniswapV3.chain);
      console.log("u=", u, -parseFloat(newpos.netVusd));
      if (u > -parseFloat(newpos.netVusd))
        await buyMulti(port, -newpos.netVusd, newpos);
      else {
        port = await initMulti(port, port.uniswapV3.chain, "defundPosition2");
        let tid = await defundPositionMulti(port, newpos, true);
        if (tid) return;
        else throw new Error("Not enough USDC " + u + " => adjust() failed");
      }
    } else {
      await fundPositionsMulti(port, newpos);
    }
    console.log("END OF ADJUST");
  } catch (e) {
    console.log(e.message + " => adjustMulti() failed");
    nodemailer.sendMail(
      "adjustMulti() failed",
      e.message + " => adjustMulti() failed"
    );
    throw new Error(e.message + " => adjustMulti() failed");
  }
}

async function adjust(wname, walletAddress) {
  try {
    //await chain.init(web3.chain);
    await init(true);
    let newpos = await getPositions(wname, walletAddress);
    let wcache = unic.readTagId("wallet", "weth");
    if (wcache && checkWallet(newpos.positions, "WETH") != wcache.wweth) {
      await utils.sleep(12);
      throw new Error(
        "Bad WETH wallet value in adjust() wcache.wweth=" +
          wcache.wweth +
          " newpos.wweth=" +
          checkWallet(newpos.positions, "WETH")
      );
    }
    console.log("newpos=", newpos);
    console.log("VUSD", newpos.netVusd, "threshold", TRADE_THRESHOLD);
    console.log("balance vusd < -thresh", newpos.netVusd < -TRADE_THRESHOLD);
    if (web3.chain == "op") {
      if (await manageOp(wname, walletAddress, newpos)) return;
    } else if (web3.chain == "poly") {
      if (await managePoly(wname, walletAddress, newpos)) return;
    }
    console.log("checking if vusd > TRADE_THRESHOLD");
    if (parseFloat(newpos.netVusd) > TRADE_THRESHOLD) {
      let wc = checkWallet(newpos.positions, "WETH");
      if (wc > parseFloat(newpos.netVamt))
        await sell(wname, newpos.netVamt, newpos, walletAddress);
      else {
        let tid = await defundPosition(wname, walletAddress, newpos, true);
        if (tid) return;
        else throw new Error("Not enough WETH " + wc + " => adjust() failed");
      }
    } else if (parseFloat(newpos.netVusd) < -TRADE_THRESHOLD) {
      console.log("need to sell usdc to buy weth");
      let u = checkWallet(newpos.positions, "USDC");
      console.log("u=", u, -parseFloat(newpos.netVusd));
      if (u > -parseFloat(newpos.netVusd))
        await buy(wname, -newpos.netVusd, newpos, walletAddress);
      else {
        let tid = await defundPosition(wname, walletAddress, newpos, true);
        if (tid) return;
        else throw new Error("Not enough USDC " + u + " => adjust() failed");
      }
    } else {
      await fundPositions(wname, walletAddress, newpos);
    }
    console.log("END OF ADJUST");
  } catch (e) {
    console.log(e.message + " => adjust() failed");
    nodemailer.sendMail("adjust() failed", e.message + " => adjust() failed");
    throw new Error(e.message + " => adjust failed");
  }
}

const MAX_RETRIES = 3;

/*
  let port = {wallets: [
    {wname: "lance", chain: "op", walletAddress: walletAddress},
    {wname: "lance", chain: "poly", walletAddress: walletAddress},
  ]};
*/
async function getPositionsMulti(port, retries = 0) {
  try {
    console.log("gp1", port);
    let q = await multi.getEthQuote();
    maps.priceMap.set("ETH", q);
    console.log("gp1a", maps.priceMap);
    console.log("gp2", q);
    let pos = [];
    let npos;
    let initValue = user.getInitMulti();
    console.log("gp3", initValue);
    let startVamt = parseFloat(initValue.vamt);
    let vusd;
    let price = maps.priceMap.get("ETH");
    let startSusd = initValue.susd;
    let vamount = BigNumber(Math.floor(startVamt * 1000000))
      .mult(-BigNumber(10).pow(12))
      .toString();
    let address;
    for (let i = 0; i < port.wallets.length; i++) {
      port = await initMulti(port, port.wallets[i].chain, "port.wallets" + i);
      //console.log("xyz port=",port,"chain=",web3.chain);
      npos = await wall.getPositions(
        port.wallets[i].walletAddress,
        maps.addressMap
      );
      //console.log("wallet positions["+i+"]=",npos);
      let wweth = checkWallet(npos, "WETH");
      pos = pos.concat(npos);
    }
    console.log("getPositionsMult.init 2nd call", port.uniswapV3.chain);
    port = await initMulti(
      port,
      port.uniswapV3.chain,
      "port.uniswapV3.chain",
      web3.chain
    );
    console.log("univ3=", port.uniswapV3, port.uniswapV3.wname);
    npos = await univ3.getPositions(
      port.uniswapV3.wname,
      port.uniswapV3.walletAddress
    );
    console.log(npos);
    pos = pos.concat(npos);
    //console.log(pos);
    let susd = 0;
    vusd = 0;
    for (let i = 0; i < pos.length; i++) {
      //console.log("looping", i, pos[i]);
      if (chain.isStablecoin(pos[i].symbol)) {
        //console.log("stablecoin");
        susd += pos[i].usd;
      } else if (chain.isEthEquivalent(pos[i].symbol)) {
        //console.log("native", pos[i].usd);
        vusd += pos[i].usd;
      } else if (pos[i].symbol == "MATIC") {
      } else {
        throw new Error("Unknown coin in getPositions " + pos[i].symbol);
      }
    }

    //console.log("setting new pos");
    let newpos = {
      profit: vusd - startVamt * q + susd - startSusd,
      netVusd: vusd - startVamt * q,
      netVamt: vusd / q - startVamt,
      netSusd: susd - startSusd,
      threshold: TRADE_THRESHOLD,
      threshRatio: THRESHOLD_RATIO,
      vusd: vusd,
      vamt: vusd / q,
      susd: susd,
      quote: q,
      starttime: initValue.timestamp,
      now: Math.floor(Date.now() / 1000),
      collateral: SPAN_VALUE,
      positions: pos,
    };
    newpos = prunePositions(newpos);
    //console.log(newpos);
    return newpos;
  } catch (e) {
    if (retries < MAX_RETRIES) {
      if (utils.shouldRetry(e.message)) {
        retries++;
        return getPositionsMulti(port, retries);
      }
    }
    console.log(e.message);
    nodemailer.sendMail("pool.getPositions() failed", e.message);
    throw new Error(e.message + " => pool.getPositions failed");
  }
}

async function getPositions(wname, walletAddress, retries = 0) {
  try {
    console.log("gp1");
    let q;
    q = await quote.oneFastQuote(chain.getAddress("WETH"), web3.chain);
    maps.priceMap.set("ETH", q);
    console.log("gp1a", maps.priceMap);
    console.log("gp2", q);
    let pos = [];
    let npos;
    let initValue = user.getInit();
    console.log("gp3", initValue);
    let startVamt = parseFloat(initValue.vamt);
    let vusd;
    // xxx switch from ETH to WETH
    let price = maps.priceMap.get("ETH");
    let startSusd = initValue.susd;
    let vamount = BigNumber(Math.floor(startVamt * 1000000))
      .mult(-BigNumber(10).pow(12))
      .toString();
    npos = await wall.getPositions(walletAddress, maps.addressMap);
    console.log("wallet positions=", npos);
    let wweth = checkWallet(npos, "WETH");
    pos = pos.concat(npos);
    //console.log(pos);
    npos = await univ3.getPositions(wname, walletAddress);
    pos = pos.concat(npos);
    //console.log(pos);
    let susd = 0;
    vusd = 0;
    for (let i = 0; i < pos.length; i++) {
      //console.log("looping", i, pos[i]);
      if (chain.isStablecoin(pos[i].symbol)) {
        //console.log("stablecoin");
        susd += pos[i].usd;
      } else if (chain.isEthEquivalent(pos[i].symbol)) {
        //console.log("native", pos[i].usd);
        vusd += pos[i].usd;
      } else if (pos[i].symbol == "MATIC") {
      } else {
        throw new Error("Unknown coin in getPositions " + pos[i].symbol);
      }
    }

    //console.log("setting new pos");
    let newpos = {
      profit: vusd - startVamt * q + susd - startSusd,
      netVusd: vusd - startVamt * q,
      netVamt: vusd / q - startVamt,
      netSusd: susd - startSusd,
      threshold: TRADE_THRESHOLD,
      threshRatio: THRESHOLD_RATIO,
      vusd: vusd,
      vamt: vusd / q,
      susd: susd,
      quote: q,
      wweth: wweth,
      starttime: initValue.timestamp,
      now: Math.floor(Date.now() / 1000),
      collateral: SPAN_VALUE,
      positions: pos,
    };
    //console.log(newpos);
    return newpos;
  } catch (e) {
    if (retries < MAX_RETRIES) {
      if (utils.shouldRetry(e.message)) {
        retries++;
        return getPositions(wname, walletAddress, retries);
      }
    }
    console.log(e.message);
    nodemailer.sendMail("pool.getPositions() failed", e.message);
    throw new Error(e.message + " => pool.getPositions failed");
  }
}

async function assertWeth(newpos, direction, ch) {
  let wcache = unic.readTagId("wallet", "weth", ch);
  if (wcache) {
    wcache = wcache.wweth;
    let wweth = checkWallet(newpos.positions, "WETH", ch);
    if (
      (direction == ">" && wweth <= wcache) ||
      (direction == "=" && wweth != wcache) ||
      (direction == "<" && wweth >= wcache)
    ) {
      await utils.sleep(12);
      throw new Error(
        "Bad WETH wallet value in assertWeth() wcache=" +
          wcache +
          " newpos.wweth=" +
          wweth +
          " direction=" +
          direction +
          " chain=" +
          ch
      );
    }
  }
}

async function calculateMulti(port) {
  try {
    port = await initMulti(port);
    let newpos = await getPositionsMulti(port);
    await assertWeth(newpos, "=", "op");
    await assertWeth(newpos, "=", "poly");
    compoundPosition(newpos);
    //console.log("pp=",pp);
    let subject = "";
    let profit = Math.floor((newpos.netVusd + newpos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (newpos.netVusd + newpos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (newpos.now - newpos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "";
    if (newpos.netVusd > TRADE_THRESHOLD)
      subject =
        "SELLING " +
        Math.floor(newpos.netVamt * 100) / 100 +
        " ETH " +
        newpos.now;
    else if (newpos.netVusd < -TRADE_THRESHOLD)
      subject =
        "BUYING " +
        Math.floor(-newpos.netVamt * 100) / 100 +
        " ETH " +
        newpos.now;
    else
      subject =
        "Profit=" +
        profit +
        " (" +
        Math.floor(newpos.netVusd) +
        "), APY=" +
        apy +
        "%\n";
    body += "Profit=" + profit + ", APY=" + apy + "%\n";
    body +=
      "Your ETH position is " +
      Math.floor(newpos.netVamt * 100) / 100 +
      " " +
      newpos.now;
    const dt = new Date(newpos.starttime * 1000).toLocaleString("en-US", {
      timeZone: "America/Chicago",
    });
    body += "\nStarting " + dt;
    body += "\n\n" + JSON.stringify(newpos, null, 2) + "\n";
    console.log(body);
    console.log("    timestamp: " + newpos.now + ",");
    console.log("    susd: " + newpos.susd + ",");
    console.log("    vamt: " + newpos.vamt + ",");
    console.log("    collateral: " + SPAN_VALUE + "\n");
    console.log("\nProfit:", newpos.profit + " APY=" + apy + "%\n");
    if (port.email) {
      //let opt = nodemailer.getMailOptions();
      //console.log("port.email=",port.email, opt);
      nodemailer.sendMail(subject, body);
    }
  } catch (e) {
    console.log(e.message);
    if (port.email) nodemailer.sendMail("calculateMulti() failed", e.message);
    throw new Error(e.message + " => calculateMulti() failed");
  }
}

async function calculate(wname, walletAddress, email = true) {
  try {
    console.log("Calling init");
    await init(email);
    console.log("getting positions");
    let newpos = await getPositions(wname, walletAddress);
    let wcache = unic.readTagId("wallet", "weth");
    if (wcache && checkWallet(newpos.positions, "WETH") != wcache.wweth) {
      await utils.sleep(12);
      throw new Error(
        "Bad WETH wallet value in calculate() wcache.wweth=" +
          wcache.wweth +
          " newpos.wweth=" +
          checkWallet(newpos.positions, "WETH")
      );
    }
    compoundPosition(newpos);
    newpos = prunePositions(newpos);
    //console.log("pp=",pp);
    let subject = "";
    let profit = Math.floor((newpos.netVusd + newpos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (newpos.netVusd + newpos.netSusd) / SPAN_VALUE) **
          ((365 * 24 * 3600) / (newpos.now - newpos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "";
    if (newpos.netVusd > TRADE_THRESHOLD)
      subject =
        "SELLING " +
        Math.floor(newpos.netVamt * 100) / 100 +
        " ETH " +
        newpos.now;
    else if (newpos.netVusd < -TRADE_THRESHOLD)
      subject =
        "BUYING " +
        Math.floor(-newpos.netVamt * 100) / 100 +
        " ETH " +
        newpos.now;
    else
      subject =
        "Profit=" +
        profit +
        " (" +
        Math.floor(newpos.netVusd) +
        "), APY=" +
        apy +
        "%\n";
    body += "Profit=" + profit + ", APY=" + apy + "%\n";
    body +=
      "Your ETH position is " +
      Math.floor(newpos.netVamt * 100) / 100 +
      " " +
      newpos.now;
    const dt = new Date(newpos.starttime * 1000).toLocaleString("en-US", {
      timeZone: "America/Chicago",
    });
    body += "\nStarting " + dt;
    body += "\n\n" + JSON.stringify(newpos, null, 2) + "\n";
    console.log(body);
    console.log("    timestamp: " + newpos.now + ",");
    console.log("    susd: " + newpos.susd + ",");
    console.log("    vamt: " + newpos.vamt + ",");
    console.log("    collateral: " + SPAN_VALUE + "\n");
    console.log("\nProfit:", newpos.profit + " APY=" + apy + "%\n");
    if (email) nodemailer.sendMail(subject, body);
  } catch (e) {
    console.log(e.message);
    if (email) nodemailer.sendMail("calculate() failed", e.message);
    throw new Error(e.message + " => calculate() failed");
  }
}

/*
async function main()
{
  const wname = "lance";
  let wallet = await wall.init(wname,"op");
  let newpos = await getPositions(wname,wallet.address);
  //await calculateNetPosition(wname,wallet.address);
  await adjust(wname,wallet.address);
  let c = await univ3.getContract();
  //await univ3.removeLiquidity(c,wallet.address,344945);
  //await univ3.removeLiquidity(c,wallet.address,344944);
  //await univ3.removeLiquidity(c,wallet.address,344939);
}

main();
*/

module.exports = Object.assign({
  getPositions,
  getPositionsMulti,
  defundPosition,
  calculate,
  calculateMulti,
  init,
  adjust,
  adjustMulti,
});
