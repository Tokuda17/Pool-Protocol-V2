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

const ADJUST_THRESHOLD = 0.9;
const WALLET_ETH_MIN = 0.5;
const WALLET_ETH_BUFFER = 2;
const WALLET_MATIC_BUFFER = 10;
const WALLET_MATIC_MIN = 2;
const TRADING_WETH_BUFFER = 10000;

async function init(port, ch = false, callfrom = false) {
  console.log("init ch=", ch);
  if (!ch) ch = port.uniswapV3.chain; // xxxx note this is the default
  maps.oldInit(ch);
  //console.log("init ch=",ch);
  await wall.initPort(port, ch);
  //console.log("poolOp init() chain=",web3.chain,port);
  univ3.init(port.uniswapV3.pair.span, port.uniswapV3.pair.spacing);
  console.log("completed univ3 init()");
  if (ch == "avax") USDC_ADDRESS = chain.getAddress("USDC.e");
  else USDC_ADDRESS = chain.getAddress("USDC");
  WETH_ADDRESS = chain.getAddress("WETH");
  ETH_ADDRESS = chain.getAddress("ETH");
  let tokenAddresses = [
    WETH_ADDRESS, // weth
    USDC_ADDRESS, // usdc
  ];
  console.log("tokenAddresses=", tokenAddresses, web3.chain);
  if (web3.chain == "poly") {
    MATIC_ADDRESS = chain.getAddress("MATIC");
    tokenAddresses.push(MATIC_ADDRESS);
  } else if (web3.chain == "arb" || web3.chain == "op") {
    ETH_ADDRESS = chain.getAddress("ETH");
    tokenAddresses.push(ETH_ADDRESS);
  }
  // need to handle AVAX and native tokens in general
  await erc20.initMaps(tokenAddresses);
  //console.log("init ETH_ADDRESS", ETH_ADDRESS, web3.chain);
  if (port.email) {
    if (typeof port.email === "string") {
      nodemailer.init(port.email);
    } else {
      nodemailer.init(web3.chain);
    }
  }
  console.log("exiting init web3.chain=", web3.chain, callfrom);
  return port;
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

function getWallet(port, ch) {
  for (let i = 0; i < port.wallets.length; i++) {
    if (port.wallets[i].chain == ch) return port.wallets[i];
  }
  return false;
}

async function managePoly(port) {
  try {
    let pos = port.snapshot;
    let c = utils.checkWallet(pos.positions, "MATIC", "poly");
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
      await init(port, "poly");
      let w = getWallet(port, "poly");
      let r = await inch.swap(
        USDC_ADDRESS,
        MATIC_ADDRESS,
        amt,
        w.walletAddress
      );
      if (!r) throw new Error("Not enough USDC to covert to MATIC");
      let body = "MATIC total increasing\n";
      body += await addPositionChanges(
        port,
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

    let tid = await defundPosition(port);
    if (tid)
    {
      return true;
    }
*/
    return false;
  } catch (e) {
    console.log(e.message, " in managePoly()");
    throw new Error(e.message + " => managePoly() failed");
  }
}
async function manageOp(port) {
  try {
    let pos = port.snapshot;
    console.log("manageOp");
    let c = utils.checkWallet(pos.positions, "ETH");
    let wc = utils.checkWallet(pos.positions, "WETH");
    let u = utils.checkWallet(pos.positions, "USDC");
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
      let r = await inch.swap(WETH_ADDRESS, ETH_ADDRESS, amt, w.walletAddress);
      if (!r) throw new Error("Not enough WETH to convert to ETH");
      let body = "ETH total increasing\n";
      body += await addPositionChanges(port, "op", "down", "manageOp.addETH");
      nodemailer.sendMail("Swapping WETH for ETH", body);
      return true;
    }
    console.log("before defundPos");
    // defund positions that are out of range
    let tid = await defundPosition(port);
    if (tid) {
      return true;
    }
    // if you don't have enough USDC to cover a span, then USDC may require
    // funding but ignore for now
    else if (u < port.snapshot.collateral) {
      console.log("USDC requires funding");
      //throw new Error("USDC requires funding");
    }
    return false;
  } catch (e) {
    console.log(e.message, " in manageOp()");
    throw new Error(e.message + " => manageOp() failed");
  }
}

async function defundPosition(port, all = false) {
  try {
    let pos = port.snapshot;
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
      await init(port, port.uniswapV3.chain, "defund");
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
      body += await addPositionChanges(
        port,
        port.uniswapV3.chain,
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

async function sell(port, slippage = false, ratio = false) {
  try {
    let pos = port.snapshot;
    let vamt = pos.netVamt;
    console.log("SELLING vamt=", vamt);
    let samt = false;
    let opt = " notOpt ";
    if (slippage !== false) {
      samt = vamt * pos.quote * (1 - slippage);
      opt = "OPTIMISTIC ";
    }
    let r = await multi.swap(port, "WETH", "USDC", vamt, samt, ratio);
    if (!r) return false;
    let ch = r.chain;
    let f = r.fusion;
    let now = Math.floor(Date.now() / 1000);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let subject =
      "Profit=" +
      profit +
      " sell($" +
      Math.floor(vamt * pos.quote) +
      ") " +
      opt +
      ch +
      " f=" +
      f +
      " " +
      now;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / port.uniswapV3.pair.value) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Selling " + vamt + " ETH on chain=" + ch + " fusion=" + f + "\n\n";
    body += await addPositionChanges(port, ch, "down", "sell");
    body += "\nbuysell\n";
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,subject+" "+body);
    return true;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => sell() failed");
  }
}
async function buy(port, vusd, slippage = false, ratio = false) {
  try {
    let pos = port.snapshot;
    let vamt = false;
    let opt = " notOpt ";
    if (slippage !== false) {
      vamt = (vusd / pos.quote) * (1 - slippage);
      opt = "OPTIMISTIC ";
    }
    console.log("BUYING vusd", vusd);
    let r = await multi.swap(port, "USDC", "WETH", vusd, vamt, ratio);
    if (!r) return false;
    let ch = r.chain;
    let f = r.fusion;
    let now = Math.floor(Date.now() / 1000);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let subject =
      "Profit=" +
      profit +
      " buy($" +
      Math.floor(vusd) +
      ") " +
      opt +
      ch +
      " f=" +
      f +
      " " +
      now;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / port.uniswapV3.pair.value) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Buying $" + vusd + "on chain=" + ch + " fusion=" + f + "\n\n";
    body += await addPositionChanges(port, ch, "up", "buy");
    body += "\nbuysell\n";
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,subject+" "+body);
    return true;
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

async function addPositionChanges(port, ch, direction, callfrom) {
  let trace = "a";
  let retries = 0;
  let MAX_RETRIES = 5;
  try {
    let pos = port.snapshot;
    let s = JSON.stringify(pos, null, 2) + "\n\n";
    let wweth0;
    wweth0 = utils.checkWallet(pos.positions, "WETH", ch);
    if (direction) {
      let w = { wweth: wweth0, direction: direction };
      unic.writeTagId("wallet", "weth", w, ch);
    }
    console.log("addPositionChanges", wweth0, pos);
    let wweth1;
    let tries = 0;
    let newpos;
    const MAX_TRIES = 5;
    console.log("addPositionChange direction=", direction);
    while (true) {
      trace = trace + "b";
      try {
        while (true) {
          newpos = await getPositions(port);
          break;
        }
      } catch (e) {
        retries++;
        if (retries < MAX_RETRIES) {
          if (utils.shouldRetry(e.message)) {
            continue;
          }
        }
        throw new Error(e.message + " failed in while loop for getPositions()");
      }
      wweth1 = utils.checkWallet(pos.positions, "WETH", ch);
      console.log("addPositionChanges", wweth0, wweth1, newpos, ch);
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
          s =
            "tries=" +
            tries +
            " wweth0=" +
            wweth0 +
            " wweth1=" +
            wweth1 +
            " direction=" +
            direction +
            "\n check failed\n\n" +
            s;
          return s;
        }
        if (tries == 1) {
          nodemailer.sendMail(
            "WETH wallet error: " + callfrom + " ch=" + ch + " " + pos.now,
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
        }
        //throw new Error("addPositionChange wweth0="+wweth0+" wweth1="+wweth1+" trace=",trace);
        await utils.sleep(3 * tries);
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
    port.snapshot = newpos;
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

async function fundIncrease(port, tid, usd) {
  try {
    let pos = port.snapshot;
    await init(port, port.uniswapV3.chain, "fundIncrease");
    console.log("ADJUST LIQUIDITY", tid, port.snapshot.collateral - usd);
    let c = await univ3.getContract();
    await univ3.increaseLiquidity(
      port.uniswapV3.wname,
      c,
      port.uniswapV3.walletAddress,
      tid,
      port.snapshot.collateral - usd
    );
    let now = Math.floor(Date.now() / 1000);
    let subject = "Increasing liqiudity from " + Math.floor(usd);
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / port.uniswapV3.pair.value) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += "Increasing by " + (port.snapshot.collateral - usd) + "\n\n";
    body += await addPositionChanges(
      port,
      port.uniswapV3.chain,
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

async function fundMint(port) {
  try {
    let pos = port.snapshot;
    console.log("MINT");
    let { lowerNut, upperNut } = univ3.findTicks(pos.quote);

    let c = await univ3.getContract();
    await univ3.mint(
      c,
      port.uniswapV3.walletAddress,
      lowerNut,
      port.snapshot.collateral
    );
    let now = Math.floor(Date.now() / 1000);
    let subject = "Minting at " + lowerNut + " " + now;
    let profit = Math.floor((pos.netVusd + pos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (pos.netVusd + pos.netSusd) / port.uniswapV3.pair.value) **
          ((365 * 24 * 3600) / (pos.now - pos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "Profit=" + profit + ", APY=" + apy + "%\n";
    body += await addPositionChanges(
      port,
      port.uniswapV3.chain,
      "down",
      "mint"
    );
    nodemailer.sendMail(subject, body);
    //unic.saveFile("update",wname,"Minting");
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => fundMint() failed");
  }
}

async function fundPositions(port) {
  try {
    let pos = port.snapshot;
    //console.log("fundPositions");
    let position = findInRange(pos);
    if (position) {
      let tid = position.id;
      //console.log("fundPostions found ", tid);
      let usd = getUsd(pos.positions, tid);
      //console.log("fundPostions found ", position, "usd=",usd);
      if (usd < port.snapshot.collateral * ADJUST_THRESHOLD) {
        await init(port, port.uniswapV3.chain, "fundIncrease");
        await fundIncrease(port, tid, usd);
        return true;
      } else {
        console.log("HOLD POSITION");
        let json = JSON.stringify(pos, null, 2);
        //unic.saveFile("update",wname,"Holding position"+"\n\n"+json+"\n");
        return false;
      }
    } else {
      await init(port, port.uniswapV3.chain, "fundMint");
      await fundMint(port);
      return true;
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

async function adjust(port) {
  try {
    //console.log("PORT==========================",port);
    let newpos = await getPositions(port);
    port.snapshot = newpos;
    for (let i = 0; i < port.wallets.length; i++) {
      await init(port, port.wallets[i].chain, "port.wallet" + i);
      //console.log("checkWeth",port);
      //console.log("checkWeth",newpos);
      await checkWeth(newpos, port.wallets[i].chain);
      //console.log("VUSD",newpos.netVusd,"threshold",port.snapshot.threshold);
      //console.log("balance vusd < -thresh",newpos.netVusd < -port.snapshot.threshold);
      if (port.wallets[i].chain == "op") {
        if (await manageOp(port)) return;
      } else if (port.wallets[i].chain == "poly") {
        if (await managePoly(port)) return;
      }
    }
    //console.log("checking if vusd > port.snapshot.threshold");
    console.log("pos=", newpos);
    if (parseFloat(newpos.netVusd) > port.snapshot.threshold) {
      let wc = utils.checkWallet(
        newpos.positions,
        "WETH",
        port.uniswapV3.chain
      );
      if (wc > parseFloat(newpos.netVamt)) {
        newpos.notes =
          "Non optimistic adjust.sell() with ratio " +
          parseFloat(newpos.netVusd) / port.snapshot.threshold;
        unic.saveObj("trade", newpos);
        console.log("Not optimistic sell");
        await sell(
          port,
          false,
          parseFloat(newpos.netVusd) / port.snapshot.threshold
        );
        return;
      } else {
        newpos.notes =
          "Non optimistic, need WETH, adjust.defundPosition() weth=" + wc;
        unic.saveObj("trade", newpos);
        await init(port, port.uniswapV3.chain, "defundPosition");
        let tid = await defundPosition(port, true);
        if (tid) return;
        else throw new Error("Not enough WETH " + wc + " => adjust() failed");
      }
    } else if (parseFloat(newpos.netVusd) < -port.snapshot.threshold) {
      console.log("need to sell usdc to buy weth");
      let u = utils.checkWallet(newpos.positions, "USDC", port.uniswapV3.chain);
      console.log("u=", u, -parseFloat(newpos.netVusd));
      if (u > -parseFloat(newpos.netVusd)) {
        newpos.notes =
          "Non optimistic, adjust.buy() with ratio = " +
          -parseFloat(newpos.netVusd) / port.snapshot.threshold;
        unic.saveObj("trade", newpos);
        console.log("Not optimistic buy");
        await buy(
          port,
          -newpos.netVusd,
          false,
          -parseFloat(newpos.netVusd) / port.snapshot.threshold
        );
        return;
      } else {
        newpos.notes =
          "Non optimistic, need USDC, adjust.defundPosition() usdc=" + u;
        unic.saveObj("trade", newpos);
        await init(port, port.uniswapV3.chain, "defundPosition2");
        let tid = await defundPosition(port, true);
        if (tid) return;
        else throw new Error("Not enough USDC " + u + " => adjust() failed");
      }
    }
    let fp = await fundPositions(port);
    if (!fp) {
      if (
        parseFloat(newpos.netVusd) >
        port.snapshot.threshold * port.uniswapV3.pair.optRatio
      ) {
        let wc = utils.checkWallet(
          newpos.positions,
          "WETH",
          port.uniswapV3.chain
        );
        if (wc > parseFloat(newpos.netVamt)) {
          newpos.notes = "Optimistic adjust.sell() with slippage 0";
          unic.saveObj("trade", newpos);
          console.log("Optimistic sell");
          let v = await sell(port, -0.0005);
          if (v) return;
        } else {
          newpos.notes =
            "Optimistic, need WETH, adjust.defundPosition() weth=" + wc;
          unic.saveObj("trade", newpos);
          await init(port, port.uniswapV3.chain, "defundPosition");
          let tid = await defundPosition(port, true);
          if (tid) return;
          else throw new Error("Not enough WETH " + wc + " => adjust() failed");
        }
      } else if (
        parseFloat(newpos.netVusd) <
        -port.snapshot.threshold * port.uniswapV3.pair.optRatio
      ) {
        console.log("need to sell usdc to buy weth");
        let u = utils.checkWallet(
          newpos.positions,
          "USDC",
          port.uniswapV3.chain
        );
        console.log("u=", u, -parseFloat(newpos.netVusd));
        if (u > -parseFloat(newpos.netVusd)) {
          newpos.notes = "Optimistic adjust.buy() with slippage 0";
          unic.saveObj("trade", newpos);
          console.log("Optimistic buy");
          let v = await buy(port, -newpos.netVusd, -0.0005);
          if (v) return;
        } else {
          newpos.notes =
            "Optimistic, need USDC, adjust.defundPosition() usdc=" + u;
          unic.saveObj("trade", newpos);
          await init(port, port.uniswapV3.chain, "defundPosition");
          let tid = await defundPosition(port, true);
          if (tid) return;
          else throw new Error("Not enough USD " + u + " => adjust() failed");
        }
      }
    }
    console.log("END OF ADJUST");
  } catch (e) {
    console.log(e.message + " => adjust() failed");
    nodemailer.sendMail("adjust() failed", e.message + " => adjust() failed");
    throw new Error(e.message + " => adjust() failed");
  }
}

const MAX_RETRIES = 3;

/*
  let port = {wallets: [
    {wname: "lance", chain: "op", walletAddress: walletAddress},
    {wname: "lance", chain: "poly", walletAddress: walletAddress},
  ]};
*/
async function getPositions(port, retries = 0) {
  try {
    console.log("gp1", port);
    let q = await multi.getEthQuote();
    //let q = await quote.oneFastQuote(chain.getAddress("WETH"),port.uniswapV3.chain);
    maps.priceMap.set("ETH", q);
    console.log("gp1a", maps.priceMap);
    console.log("gp2", q);
    let pos = [];
    let npos;
    let initValue = port.start;
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
      let includelist = port.wallets[i].includelist;
      if (!includelist) includelist = false;
      console.log("INCLUDELIST=", includelist);
      await init(port, port.wallets[i].chain, "port.wallets" + i);
      npos = await wall.getPositionsMulti(port, port.wallets[i]);
      console.log("wallet positions[" + i + "]=", npos);
      pos = pos.concat(npos);
    }
    console.log("getPositionsMult.init 2nd call", port.uniswapV3.chain);
    await init(port, port.uniswapV3.chain, "port.uniswapV3.chain", web3.chain);
    console.log("univ3=", port.uniswapV3, port.uniswapV3.wname);
    npos = await univ3.getPositions(
      port.uniswapV3.wname,
      port.uniswapV3.walletAddress
    );
    //console.log(npos);
    pos = pos.concat(npos);
    //console.log(pos);
    let susd = 0;
    vusd = 0;
    for (let i = 0; i < pos.length; i++) {
      //console.log("looping", i, pos[i]);
      if (chain.isStablecoin(pos[i].symbol, pos[i].chain)) {
        //console.log("stablecoin");
        susd += pos[i].usd;
      } else if (chain.isEthEquivalent(pos[i].symbol, pos[i].chain)) {
        //console.log("native", pos[i].usd);
        vusd += pos[i].usd;
      } else if (pos[i].symbol == "MATIC") {
      } else {
        throw new Error("Unknown coin in getPositions " + pos[i].symbol);
      }
    }
    let profit = vusd - startVamt * q + susd - startSusd;
    let spanValue = port.uniswapV3.pair.value + profit;
    let tradeThresh = spanValue * port.uniswapV3.pair.threshRatio;
    //console.log("setting new pos");
    let newpos = {
      profit: vusd - startVamt * q + susd - startSusd,
      netVusd: vusd - startVamt * q,
      netVamt: vusd / q - startVamt,
      netSusd: susd - startSusd,
      threshold: tradeThresh,
      threshRatio: port.uniswapV3.pair.threshRatio,
      vusd: vusd,
      vamt: vusd / q,
      susd: susd,
      quote: q,
      starttime: initValue.timestamp,
      now: Math.floor(Date.now() / 1000),
      collateral: spanValue,
      positions: pos,
    };
    newpos = prunePositions(newpos);
    //console.log(newpos);
    return newpos;
  } catch (e) {
    if (retries < MAX_RETRIES) {
      if (utils.shouldRetry(e.message)) {
        retries++;
        return getPositions(port, retries);
      }
    }
    console.log(e.message);
    nodemailer.sendMail("pool.getPositions() failed", e.message);
    throw new Error(e.message + " => pool.getPositions failed");
  }
}

async function checkWeth(newpos, ch, reset = true) {
  let wcache = unic.readTagId("wallet", "weth", ch);
  console.log("checkWeth wcache=", wcache);
  let direction = false;
  let cweth;
  if (wcache) {
    cweth = wcache.wweth;
    console.log("wweth=", wcache.wweth, "direction=", wcache.direction);
    if (wcache.direction) direction = wcache.direction;

    let sym = "WETH";
    let wweth = utils.checkWallet(newpos.positions, sym, ch);
    if (
      (direction == "up" && wweth <= cweth) ||
      (!direction && wweth != cweth) ||
      (direction == "down" && wweth >= cweth)
    ) {
      await utils.sleep(12);
      throw new Error(
        "Bad WETH wallet value in checkWeth() cweth=" +
          cweth +
          " newpos.wweth=" +
          wweth +
          " direction=" +
          direction +
          " chain=" +
          ch
      );
    }
    if (direction && reset) {
      let w = { wweth: wweth };
      unic.writeTagId("wallet", "weth", w, ch);
    }
  }
}

async function calculate(port) {
  try {
    console.log("c1");
    await init(port);
    //console.log("c2",port);
    let newpos = await getPositions(port);
    port.snapshot = newpos;
    //console.log("c3",port);
    //console.log("c4",port);
    await checkWeth(newpos, "op", false);
    await checkWeth(newpos, "poly", false);
    await checkWeth(newpos, "arb", false);
    console.log("newpos=", newpos);
    let subject = "";
    let profit = Math.floor((newpos.netVusd + newpos.netSusd) * 100) / 100;
    let apy =
      Math.floor(
        ((1 + (newpos.netVusd + newpos.netSusd) / port.uniswapV3.pair.value) **
          ((365 * 24 * 3600) / (newpos.now - newpos.starttime)) *
          100 -
          100) *
          10
      ) / 10;
    let body = "";
    if (newpos.netVusd > port.snapshot.threshold)
      subject =
        "SELLING " +
        Math.floor(newpos.netVamt * 100) / 100 +
        " ETH " +
        newpos.now;
    else if (newpos.netVusd < -port.snapshot.threshold)
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
    body += "\n\n" + JSON.stringify(port, null, 2) + "\n";
    console.log(body);
    console.log("      timestamp: " + newpos.now + ",");
    console.log("      susd: " + newpos.susd + ",");
    console.log("      vamt: " + newpos.vamt + ",");
    console.log("      collateral: " + port.snapshot.collateral + "\n");
    console.log("\nProfit:", newpos.profit + " APY=" + apy + "%\n");
    if (port.email) {
      //let opt = nodemailer.getMailOptions();
      //console.log("port.email=",port.email, opt);
      nodemailer.sendMail(subject, body);
    }
  } catch (e) {
    console.log(e.message);
    if (port.email) nodemailer.sendMail("calculate() failed", e.message);
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
  init,
  getPositions,
  defundPosition,
  calculate,
  adjust,
});
