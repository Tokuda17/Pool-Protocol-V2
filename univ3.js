const uniABI = require("./ABI/UniswapV3.json");
var BigNumber = require("big-number");
const utils = require("./utils.js");
const wall = require("./wallet.js");
const unic = require("./unicache.js");
const gas = require("./gasPoly.js");
const unifees = require("./unifees.js");
const chain = require("./chain.js");
const web = require("./web3.js");
const web3 = web.web3;
const erc = require("./erc20.js");
const quote = require("./quote.js");
const maps = require("./maps.js");
poolInterface = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
quoterInterface = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json");

const NF_POSITION_MANAGER_ADDRESS =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const SUBGRAPH_URL =
  "http://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";

const MAX_ETH_IN = "100000000000000000000";
const MAX_USD_IN = "1000000000000";
const POOL_FEE = 500;

let TICK_SPACING;
let SPAN;
let HALF_SPAN;

let lowTickMap = new Map();
let liquidityMap = new Map();
let positionMap = new Map();

function setPosition(tid, i) {
  positionMap.set(parseInt(tid), parseInt(i));
}

function setLowTick(lowerNut, tid) {
  lowTickMap.set(parseInt(lowerNut), parseInt(tid));
}

function setLiquidity(lowerNut, liquidity) {
  //console.log("SETLIQUIDITY",lowerNut,liquidity);
  liquidityMap.set(parseInt(lowerNut), parseInt(liquidity));
}

function lookupLiquidity(lowerNut) {
  let v = liquidityMap.get(parseInt(lowerNut));
  if (v !== undefined) return parseInt(v);
  else return v;
}

function lookupLowTick(lowerNut) {
  let v = lowTickMap.get(parseInt(lowerNut));
  if (v !== undefined) return parseInt(v);
  else return v;
}

function lookupPosition(tid) {
  console.log("positionMap=", positionMap);
  let v = positionMap.get(parseInt(tid));
  if (v !== undefined) return parseInt(v);
  else return v;
}

async function checkTokenId(wname, i, c, tid) {
  setPosition(tid, i);
  let posInfo = unic.readUniswapId(wname, i);
  if (!posInfo) {
    posInfo = await positions(c, tid);
    unic.writeUniswapId(
      wname,
      i,
      tid,
      posInfo.tickLower,
      posInfo.tickUpper,
      posInfo.liquidity,
      posInfo.fee
    );
  } else {
    //console.log("reading posInfo from cache for",i);
  }
  console.log("fee", posInfo, " i=", i);
  if (parseInt(posInfo.fee) != POOL_FEE) {
    //console.log("fee mismatch for",i,tid);
    return false;
  }
  console.log(
    tid,
    " tickLower",
    posInfo.tickLower,
    " tickUpper",
    posInfo.tickUpper,
    " SPAN",
    SPAN
  );
  if (parseInt(posInfo.tickLower) + SPAN == parseInt(posInfo.tickUpper)) {
    //console.log("\n**** STAGE 1 *****\n");
    if (lookupLowTick(posInfo.tickLower) !== undefined) {
      console.log("tickLowerMap=", lowTickMap);
      console.log(
        "\n**** EXIT EXIT EXIT " + lookupLowTick(posInfo.tickLower) + " ****\n"
      );
      return false;
    }
    console.log("\n********\nFOUND tid=", tid, posInfo.tickLower);
    setLowTick(posInfo.tickLower, tid);
    setLiquidity(posInfo.tickLower, posInfo.liquidity);
    console.log(
      "Setting liquidity ",
      posInfo.liquidity,
      "tickLower",
      posInfo.tickLower
    );
    return true;
  }
  return false;
}

async function getTokenIds(wname, c, walletAddress) {
  console.log("getTokenIds()", wname, walletAddress, c);
  try {
    lowTickMap = new Map();
    liquidityMap = new Map();
    positionMap = new Map(); // maps from Uniswap tokenId to Uniswap position number (consecutive)
    for (i = 0; ; i++) {
      try {
        let tid = unic.checkUniswapId(wname, i);
        console.log("id=", i, tid);
        if (!tid) {
          tid = await c.methods.tokenOfOwnerByIndex(walletAddress, i).call();
        }
        if (!(await checkTokenId(wname, i, c, tid))) {
          continue;
        }
      } catch (e) {
        if (e.message.search("index out of bounds") >= 0) {
          break;
        }
        console.log(e.message);
        throw new Error(e.message + " => tokenOfOwnerByIndex() failed");
      }
    }
  } catch (e) {
    console.log(e.message + " => getTokenIds() failed");
    throw new Error(e.message + " => getTokenIds() failed");
  }
}

function getTickPrice(ticks) {
  if (web3.chain == "poly") ticks = -ticks;
  let p = 1000000000000 / 1.0001 ** -ticks;
  return p;
}

function getTickFromPrice(price) {
  let tick = -Math.round(Math.log(1000000000000 / price) / Math.log(1.0001));
  if (web3.chain == "poly") tick = -tick;
  return tick;
}

async function getPoolContract(pool) {
  try {
    const contract = await new web3.obj.eth.Contract(poolInterface.abi, pool);
    return contract;
  } catch (e) {
    console.log(e.message + " getPoolContract failed");
    throw Error(e.message + " => getPoolContract failed");
  }
}

async function getContract() {
  try {
    const contract = await new web3.obj.eth.Contract(
      uniABI,
      NF_POSITION_MANAGER_ADDRESS
    );
    return contract;
  } catch (e) {
    console.log(e.message + " getContract failed");
    throw Error(e.message + " => getContract failed");
  }
}

async function positions(contract, tokenid) {
  try {
    //console.log("POSITIONS", tokenid);
    //console.log("CONTRACT", contract);
    //console.log("METHODS", contract.methods);
    const info = await contract.methods
      .positions(tokenid)
      .call()
      .catch(function (e) {
        console.log(e.message);
        throw new Error(e.message + " => positions() failed");
      });
    console.log("positions", tokenid, info);
    return info;
  } catch (e) {
    console.log(e.message + " positions failed");
    throw Error(e.message + " => positions failed");
  }
}

async function position(contract, tokenid, q) {
  posInfo = await positions(contract, tokenid);
  const lower = posInfo.tickLower;
  const upper = posInfo.tickUpper;
  const liq = posInfo.liquidity;
  let plower = getTickPrice(lower);
  let pupper = getTickPrice(upper);
  console.log("POSITION plower=", plower, "pupper=", pupper);
  if (plower > pupper) {
    let ptmp = plower;
    plower = pupper;
    pupper = plower;
  }
  if (q < plower) q = plower;
  else if (q > pupper) q = pupper;
  // need to update this to use 1inch quotes
  let vamt =
    (liq * (Math.sqrt(pupper) - Math.sqrt(q))) /
    Math.sqrt(q) /
    Math.sqrt(pupper);
  vamt = BigNumber(Math.floor(vamt)).mult(1000000).toString();
  //console.log("q=",q,"plower=",plower,"liq",liq);
  let samt = liq * (Math.sqrt(q) - Math.sqrt(plower));
  //console.log("samt=",samt);
  samt = Math.floor(samt / 10 ** 6);
  //  console.log("lower",lower,"upper",upper,"liq",liq,"plower",plower,"pupper",pupper, "price",q);
  var pos = [
    {
      symbol: "ETH",
      decimals: 18,
      amount: vamt,
      tickLower: lower,
      liquidity: liq,
    },
    {
      symbol: "USDC",
      decimals: 6,
      amount: samt,
      tickLower: lower,
      liquidity: liq,
    },
  ];
  return pos;
}

const univ3sdk = require("@uniswap/v3-sdk");
const unicore = require("@uniswap/sdk-core");

const FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

let WETH_TOKEN;
let USDC_TOKEN;

function init(span, spacing) {
  TICK_SPACING = spacing;
  SPAN = span * spacing;
  HALF_SPAN = SPAN / 2;
  console.log("univ3.init()", web3.chain);
  console.log("univ3.init WETH_ADDRESS", chain.getAddress("WETH"));
  console.log("univ3.init ETH_ADDRESS", chain.getAddress("ETH"));
  console.log("univ3.init USDC_ADDRESS", chain.getAddress("USDC"));
  try {
    WETH_TOKEN = new unicore.Token(
      69,
      chain.getAddress("WETH"),
      18,
      "WETH",
      "Wrapped Ether"
    );

    USDC_TOKEN = new unicore.Token(
      69,
      chain.getAddress("USDC"),
      6,
      "USDC",
      "USD//C"
    );
  } catch (e) {
    console.log(e.message + " => univ3.init() failed");
    throw new Error(e.message + " => univ3.init() failed");
  }
  //console.log("exiting univ3.init()");
}

function getPool() {
  console.log("getPool() tokenA", WETH_TOKEN);
  const poolAddress = univ3sdk.computePoolAddress({
    factoryAddress: FACTORY_ADDRESS,
    tokenA: WETH_TOKEN,
    tokenB: USDC_TOKEN,
    fee: POOL_FEE,
  });
  console.log("poolAddress=", poolAddress);
  return poolAddress;
}

async function feeGrowthGlobal0X128(c) {
  const tu = await c.methods
    .feeGrowthGlobal0X128()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => feeGrowthGlobal0X128() failed");
    });
  return tu;
}

async function feeGrowthGlobal1X128(c) {
  const tu = await c.methods
    .feeGrowthGlobal1X128()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => feeGrowthGlobal1X128() failed");
    });
  return tu;
}

async function slot0(c) {
  //console.log("CONTRACT for SLOT0",c);
  const s0 = await c.methods
    .slot0()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => s0() failed");
    });
  return s0;
}

async function ticks(c, tick) {
  //console.log("CONTRACT for TICKS",c);
  const t0 = await c.methods
    .ticks(tick)
    //.ticks("-201680")
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => tickUpper() failed");
    });
  return t0;
}

async function tickSpacing(c) {
  const ts = await c.methods
    .tickSpacing()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => ts() failed");
    });
  return ts;
}

async function liquidity(c) {
  const liq = await c.methods
    .liquidity()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => s0() failed");
    });
  return liq;
}

function calculateAmounts(tick, lower, upper, value) {
  console.log(
    "calculateAmounts tick=",
    tick,
    "lower=",
    lower,
    "upper=",
    upper,
    "value=",
    value
  );
  if (tick < lower) tick = lower;
  else if (tick > upper) tick = upper;
  let p = getTickPrice(tick);
  let plow = getTickPrice(lower);
  let pup = getTickPrice(upper);
  console.log("price=", p, "low=", plow, "pup=", pup);
  if (plow > pup) {
    let ptmp = plow;
    plow = pup;
    pup = ptmp;
  }
  console.log("price=", p, "low=", plow, "pup=", pup);
  let v = (Math.sqrt(pup) - Math.sqrt(p)) / Math.sqrt(p) / Math.sqrt(pup);
  let s = (Math.sqrt(p) - Math.sqrt(plow)) / Math.sqrt(p) / Math.sqrt(plow);
  console.log("v=", v, "s=", s);
  let vr = v / (s + v);
  let sr = s / (s + v);
  //console.log("vr=",vr,"sr=",sr);
  return { vr, sr };
}

async function refundETH(contract, walletAddress) {
  try {
    let multiParams = {
      from: walletAddress,
      value: 0,
      gas: 800000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    };
    if (web3.chain == "poly")
      multiParams.maxPriorityFeePerGas = await gas.getGas();

    console.log("multiParams", multiParams);
    let tx = await contract.methods.refundETH().send(multiParams);
    console.log("tx=", tx);
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => refundETH() failed");
  }
}

async function mint(
  contract,
  walletAddress,
  lowerNut,
  value,
  tries = 0,
  gp = false
) {
  try {
    let calls = [];
    console.log("mint1 lowerNut", lowerNut);
    let c = await erc.getContract(chain.getAddress("WETH"));
    await erc.approve(c, walletAddress, NF_POSITION_MANAGER_ADDRESS, 1);
    console.log("mint2");
    c = await erc.getContract(chain.getAddress("USDC"));
    await erc.approve(c, walletAddress, NF_POSITION_MANAGER_ADDRESS, 1);
    console.log("mint3");
    let p = await getPool();
    console.log("Pool=", p);
    let pc = await getPoolContract(p);
    console.log("mint4");
    //console.log("PoolContract=",pc);
    let s0 = await slot0(pc);
    console.log("s0=", s0);
    let ts = parseInt(await tickSpacing(pc));
    console.log("ts=", ts);
    let tick = parseInt(s0[1]);
    console.log("tick=", tick);
    let upperNut = lowerNut + SPAN;
    console.log("lowerNUT=", lowerNut, "upperNUT=", upperNut);
    let price = getTickPrice(tick);
    let { vr, sr } = calculateAmounts(tick, lowerNut, upperNut, value);
    console.log("vr=", vr, "sr=", sr);
    let vin = BigNumber(Math.floor(vr * value * 1000000))
      .mult(BigNumber(10).pow(18))
      .div(Math.floor(price * 1000000))
      .toString();
    let sin = Math.floor(sr * value * 1000000).toString();
    console.log(
      "vin=",
      vin,
      parseInt(
        BigNumber(vin)
          .mult(Math.floor(price * 1000000))
          .div(BigNumber(10).pow(18))
          .toString()
      ) / 1000000,
      "sin=",
      sin,
      sin / 1000000
    );

    let t0 = chain.getAddress("WETH");
    let t1 = chain.getAddress("USDC");
    if (web3.chain == "poly") {
      //let ln=Math.abs(lowerNut);
      //let un = Math.abs(upperNut);
      //lowerNut = un;
      //upperNut = ln;
      let t2 = t0;
      t0 = t1;
      t1 = t2;
      let in2 = vin;
      vin = sin;
      sin = in2;
    }
    let params = [
      t0,
      t1,
      POOL_FEE,
      lowerNut,
      upperNut,
      vin,
      sin,
      0,
      0,
      walletAddress,
      Math.floor(Date.now() / 1000) + 60 * 20,
    ];

    let mintEncode = await contract.methods.mint(params).encodeABI();
    let refundEncode = await contract.methods.refundETH().encodeABI();

    let multiParams = {
      from: walletAddress,
      value: 0,
      gas: 800000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    };
    if (web3.chain == "poly")
      multiParams.maxPriorityFeePerGas = await gas.getGas();

    console.log("multiParams", multiParams);
    calls.push(mintEncode);
    calls.push(refundEncode);
    //console.log("calling mint transaction");
    //exit();
    let tx = await contract.methods.multicall(calls).send(multiParams);
    console.log("tx=", tx);
  } catch (e) {
    tries++;
    if (tries < MAX_TRIES) {
      let gp = utils.parseGas(e.message);
      gp = Math.floor((1 + 0.5 * tries) * gp);
      await mint(contract, walletAddress, lowerNut, value, tries, gp);
      return;
    }
    console.log(e.message);
    throw new Error(e.message + " => mint failed");
  }
}

function nearestTick(tick) {
  let nut = univ3sdk.nearestUsableTick(tick, TICK_SPACING);
  return nut;
}

function findTicks(p) {
  let tick = getTickFromPrice(p);
  let ts = TICK_SPACING;
  let nut = univ3sdk.nearestUsableTick(tick, ts);
  console.log("findTicks nut", nut);
  let lowerNut = nut - HALF_SPAN;
  let upperNut = nut + HALF_SPAN;
  console.log(
    "findTicks() lowerNut=",
    lowerNut,
    "upperNut=",
    upperNut,
    "tick=",
    tick,
    " SPAN=",
    SPAN,
    " HALF_SPAN=",
    HALF_SPAN
  );
  return { lowerNut, upperNut };
}

async function increaseLiquidity(
  wname,
  c,
  walletAddress,
  tokenid,
  value,
  tries = 0,
  gp = false
) {
  try {
    let calls = [];

    let p = await getPool();
    console.log("Pool=", p);
    let pc = await getPoolContract(p);
    //console.log("PoolContract=",pc);
    let liq = parseInt(await liquidity(pc));
    let s0 = await slot0(pc);
    let ts = parseInt(await tickSpacing(pc));
    console.log("step1");
    let posInfo = await positions(c, tokenid);
    console.log("step2");
    let lowerNut = posInfo.tickLower;
    let upperNut = posInfo.tickUpper;
    let tick = parseInt(s0[1]);
    if (tick < lowerNut) tick = lowerNut;
    else if (tick > upperNut) tick = upperNut;
    let price = getTickPrice(tick);
    let { vr, sr } = calculateAmounts(tick, lowerNut, upperNut, value);
    console.log("vr=", vr, "sr=", sr);
    let vin = BigNumber(Math.floor(vr * value * 1000000))
      .mult(BigNumber(10).pow(18))
      .div(Math.floor(price * 1000000))
      .toString();
    let sin = Math.floor(sr * value * 1000000).toString();
    console.log(
      "vin=",
      vin,
      parseInt(
        BigNumber(vin)
          .mult(Math.floor(price * 1000000))
          .div(BigNumber(10).pow(18))
          .toString()
      ) / 1000000,
      "sin=",
      sin,
      sin / 1000000
    );
    let params; // tokenid, amount0Desired, amount1Desired, amount0Min, amount1Min, deadline
    if (web3.chain == "poly") {
      let in2 = vin;
      vin = sin;
      sin = in2;
    }
    console.log("pos0=", vin, "pos1=", sin);
    let test0 = parseInt(vin) / 1000000;
    let test1 =
      parseInt(
        BigNumber(sin)
          .mult(Math.floor(price * 1000000))
          .div(BigNumber(10).pow(18))
          .toString()
      ) / 1000000;
    let test = test0 + test1;
    console.log("Amount=", test, test0, test1);
    params = [tokenid, vin, sin, 0, 0, Math.floor(Date.now() / 1000) + 60 * 20];
    let multiParams = {
      from: walletAddress,
      value: 0,
      gas: 800000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    };
    if (web3.chain == "poly")
      multiParams.maxPriorityFeePerGas = await gas.getGas();
    console.log("increaseLiquidity params=", params);
    unic.removeUniswapId(wname, lookupPosition(tokenid));
    let increaseEncode = await c.methods.increaseLiquidity(params).encodeABI();
    let refundEncode = await c.methods.refundETH().encodeABI();
    calls.push(increaseEncode);
    calls.push(refundEncode);
    let tx = await c.methods.multicall(calls).send(multiParams);
    console.log("tx=", tx);
  } catch (e) {
    tries++;
    if (tries < MAX_TRIES) {
      let gp = utils.parseGas(e.message);
      gp = Math.floor((1 + 0.5 * tries) * gp);
      await increaseLiquidity(
        wname,
        c,
        walletAddress,
        tokenid,
        value,
        tries,
        gp
      );
      return;
    }
    console.log(e.message);
    throw new Error(e.message + " => increaseLiquidity and refund failed");
  }
}

async function collect(wname, c, walletAddress, tokenid) {
  try {
    let calls = [];
    let info = await positions(c, tokenid);
    let m0 = MAX_ETH_IN;
    let m1 = MAX_USD_IN;
    if (web3.chain == "poly") {
      m0 = MAX_USD_IN;
      m1 = MAX_ETH_IN;
    }
    let cparams = {
      tokenid: tokenid,
      recipient: walletAddress,
      amount0Max: m0,
      amount1Max: m1,
    };
    cparams = [tokenid, walletAddress, m0, m1];
    console.log("rl 1");
    let collectEncode = await c.methods.collect(cparams).encodeABI();
    calls.push(collectEncode);
    console.log("rl 2");

    let multiParams = {
      from: walletAddress,
      value: 0,
      gas: 800000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    };
    if (web3.chain == "poly")
      multiParams.maxPriorityFeePerGas = await gas.getGas();

    await c.methods.multicall(calls).send(multiParams);
    console.log("rl 3");
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => collect failed");
  }
}

async function removePositions(wname, walletAddress) {
  try {
    console.log("removePositions()");
    init();
    let c = await getContract();
    await getTokenIds(wname, c, walletAddress);
    for (let [key, value] of liquidityMap) {
      console.log(key, value);
      let pid = lookupLowTick(key);
      console.log("Checking pid=", pid);
      if (value > parseFloat(0)) {
        console.log("Removing pid=", pid);
        await removeLiquidity(wname, c, walletAddress, pid);
        //unic.saveFile("update",wname,"Removing liquidity");
      }
    }
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => removePositions failed");
  }
}

let MAX_TRIES = 3;

async function removeLiquidity(
  wname,
  c,
  walletAddress,
  tokenid,
  tries = 0,
  gp = false
) {
  try {
    console.log("removeLiquidity", tokenid);
    let calls = [];
    let info = await positions(c, tokenid);
    let params = {
      tokenid: tokenid,
      liquidity: info.liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20,
    };
    params = [
      tokenid,
      info.liquidity,
      0,
      0,
      Math.floor(Date.now() / 1000) + 60 * 20,
    ];
    console.log("removeLiquidity params=", params);
    unic.removeUniswapId(wname, lookupPosition(tokenid));
    unic.removeTagId("unifees", tokenid);
    let removeEncode = await c.methods.decreaseLiquidity(params).encodeABI();
    let cparams = {
      tokenid: tokenid,
      recipient: walletAddress,
      amount0Max: MAX_ETH_IN,
      amount1Max: MAX_USD_IN,
    };
    let m0 = MAX_ETH_IN;
    let m1 = MAX_USD_IN;
    if (web3.chain == "poly") {
      m0 = MAX_USD_IN;
      m1 = MAX_ETH_IN;
    }
    cparams = [tokenid, walletAddress, m0, m1];
    console.log("rl 1");
    let collectEncode = await c.methods.collect(cparams).encodeABI();
    calls.push(removeEncode);
    calls.push(collectEncode);
    console.log("rl 2");

    let multiParams = {
      from: walletAddress,
      value: 0,
      gas: 800000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    };
    if (gp) {
      multiParams.gasPrice = gp;
    }
    if (web3.chain == "poly")
      multiParams.maxPriorityFeePerGas = await gas.getGas();

    await c.methods.multicall(calls).send(multiParams);
    console.log("rl 3");
  } catch (e) {
    console.log(e.message);
    if (e.message.search("Returned error: gas price too low:") >= 0) {
      tries++;
      if (tries < MAX_TRIES) {
        let gp = utils.parseGas(e.message);
        gp = Math.floor((1 + 0.5 * tries) * gp);
        await removeLiquidity(wname, c, walletAddress, tokenid, tries, gp);
        return;
      }
    }
    throw new Error(e.message + " => removeLiquidity and collect failed");
  }
}

async function removePositions(wname, walletAddress) {
  try {
    console.log("removePositions()");
    init();
    let c = await getContract();
    await getTokenIds(wname, c, walletAddress);
    for (let [key, value] of liquidityMap) {
      console.log(key, value);
      let pid = lookupLowTick(key);
      console.log("Checking pid=", pid);
      if (value > parseFloat(0)) {
        console.log("Removing pid=", pid);
        await removeLiquidity(wname, c, walletAddress, pid);
        //unic.saveFile("update",wname,"Removing liquidity");
      }
    }
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => removePositions failed");
  }
}

async function getPositions(wname, walletAddress) {
  try {
    console.log("Calling getPositions");
    let c = await getContract();
    await getTokenIds(wname, c, walletAddress);
    let pos = [];
    if (wname != "lance") return pos;
    let q = maps.priceMap.get("ETH");
    //console.log("liquidityMap=");
    for (let [key, value] of liquidityMap) {
      console.log("PAIR:", key, value);
      let p = q;
      let tl = parseInt(key);
      let pid = lookupLowTick(key);
      let plower = getTickPrice(tl);
      let pupper = getTickPrice(tl + SPAN);
      if (plower > pupper) {
        let ptmp = plower;
        plower = pupper;
        pupper = ptmp;
      }

      let inRange = true;
      if (p < plower) {
        p = plower;
        inRange = false;
      } else if (p > pupper) {
        p = pupper;
        inRange = false;
      }
      let liq = parseInt(value);
      var vamt =
        (liq * (Math.sqrt(pupper) - Math.sqrt(p))) /
        Math.sqrt(p) /
        Math.sqrt(pupper);
      vamt = BigNumber(Math.floor(vamt)).mult(1000000).toString();
      let vusd =
        (parseInt(BigNumber(vamt).div(BigNumber(10).pow(12)).toString()) /
          1000000) *
        q;
      var samt = liq * (Math.sqrt(p) - Math.sqrt(plower));
      samt = Math.floor(samt / 10 ** 6);
      let susd = parseInt(samt) / 1000000;
      console.log(
        "lower",
        tl,
        "liq",
        liq,
        "plower",
        plower,
        "pupper",
        pupper,
        "price",
        p
      );
      //console.log("f0",f0,"f1",f1);
      var newpos = [
        {
          id: pid,
          chain: web3.chain,
          symbol: "ETH",
          decimals: 18,
          inRange: inRange,
          tickLower: tl,
          plower: plower,
          pupper: pupper,
          liquidity: liq,
          amount: vamt,
          quote: q,
          usd: vusd,
        },
        {
          id: pid,
          chain: web3.chain,
          symbol: "USDC",
          decimals: 6,
          inRange: inRange,
          tickLower: tl,
          plower: plower,
          pupper: pupper,
          liquidity: liq,
          amount: samt,
          quote: 1,
          usd: susd,
        },
      ];
      pos = pos.concat(newpos);
      if (liq > 0) {
        let { f0, f1 } = await unifees.getFees(walletAddress, pid);
        newpos = [
          {
            id: "fees-" + pid,
            chain: web3.chain,
            symbol: "ETH",
            amount: f0,
            usd: f0 * q,
          },
          {
            id: "fees-" + pid,
            chain: web3.chain,
            symbol: "USDC",
            amount: f1,
            usd: f1,
          },
        ];
        pos = pos.concat(newpos);
      }
    }
    //console.log("UNI V3 positions=",pos);
    return pos;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => univ3.getPositions() failed");
  }
}

/*
async function main()
{
  let wallet = await wall.init("lance","op");


  let q = await quote.oneFastQuote(ETH_ADDRESS,web.chain);
  await getPositions("lance",wallet.address);
  //console.log("liquidityMap",liquidityMap);
  //console.log("lowTickMap",lowTickMap);

  let c = await getContract();
  //await mint(c,wallet.address,10);
  //await removeLiquidity(wname,c,wallet.address,344383);
  await increaseLiquidity(wname,c,wallet.address,344939,10);

}

main();
*/

// TO DO
// add init() that inserts tokens into price map
// add maps to store pool info: tick spacing, pool name, tokens in pool, etc.
// change iterator on pool to use pid since that is unique across any pool type, lower tick number is not
module.exports = Object.assign({
  init,
  collect,
  getPositions,
  getContract,
  mint,
  increaseLiquidity,
  removeLiquidity,
  getTickPrice,
  getTickFromPrice,
  nearestTick,
  findTicks,
  lookupLiquidity,
  lookupLowTick,
  lookupPosition,
  getContract,
  slot0,
  ticks,
  feeGrowthGlobal0X128,
  feeGrowthGlobal1X128,
  positions,
  getPoolContract,
  removePositions,
});
