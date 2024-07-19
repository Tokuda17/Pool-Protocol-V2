const uniABI = require("./ABI/UniswapV3.json");
var BigNumber = require("big-number");
const wall = require("./wallet.js");
const web = require("./web3.js");
const web3 = web.web3;
const erc = require("./erc20.js");
const quote = require("./quote.js");
const maps = require("./maps.js");
poolInterface = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
quoterInterface = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json");

const NF_POSITION_MANAGER_ADDRESS =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const OP_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const OP_USDC_ADDRESS = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";
const SUBGRAPH_URL =
  "http://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";

const MAX_ETH_IN = "100000000000000000000";
const MAX_USD_IN = "1000000000000";
const TS_SPAN = 8;
const TICK_SPACING = 10;

const lowTickMap = new Map();
const liquidityMap = new Map();

async function checkTokenId(c, tid) {
  let posInfo = await positions(c, tid);
  let tickUpper = parseInt(posInfo.tickUpper);
  let tickLower = parseInt(posInfo.tickLower);
  let mod = tickLower % (10 * TS_SPAN);
  mod = (mod + 10 * TS_SPAN) % (10 * TS_SPAN);
  //console.log("tickLower",tickLower,"tickUpper",tickUpper,"mod",mod);
  if (tickLower + 10 * TS_SPAN == tickUpper && mod == 0) {
    if (lowTickMap.get(parseInt(tickLower)) !== undefined) return false;
    console.log("FOUND SPAN", tid, tickLower);
    lowTickMap.set(parseInt(tickLower), parseInt(tid));
    liquidityMap.set(parseInt(tickLower), parseInt(posInfo.liquidity));
    console.log(
      "Setting liquidity ",
      posInfo.liquidity,
      "tickLower",
      tickLower
    );
    return true;
  }
  return false;
}

async function getTokenIds(c, walletAddress) {
  try {
    for (i = 0; ; i++) {
      try {
        const tid = await c.methods
          .tokenOfOwnerByIndex(walletAddress, i)
          .call();
        if (!(await checkTokenId(c, tid))) {
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
  const p = 1000000000000 / 1.0001 ** -ticks;
  return p;
}

function getTickFromPrice(price) {
  tick = -Math.round(Math.log(1000000000000 / price) / Math.log(1.0001));
  return tick;
}

async function getPoolContract(pool) {
  try {
    const contract = await new web3.obj.eth.Contract(poolInterface.abi, pool);
    return contract;
  } catch (e) {
    console.log(e.message + " getContract failed");
    throw Error(e.message + " => getContract failed");
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
    console.log("positions completed");
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
  q = 1800.5;
  if (q < plower) q = plower;
  else if (q > pupper) q = pupper;
  // need to update this to use 1inch quotes
  let vamt =
    (liq * (Math.sqrt(pupper) - Math.sqrt(q))) /
    Math.sqrt(q) /
    Math.sqrt(pupper);
  vamt = BigNumber(Math.floor(vamt)).mult(1000000).toString();
  console.log("q=", q, "plower=", plower, "liq", liq);
  let samt = liq * (Math.sqrt(q) - Math.sqrt(plower));
  console.log("samt=", samt);
  samt = Math.floor(samt / 10 ** 6);
  console.log(
    "lower",
    lower,
    "upper",
    upper,
    "liq",
    liq,
    "plower",
    plower,
    "pupper",
    pupper,
    "price",
    q
  );
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

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const USDC_ADDRESS = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";

const WETH_TOKEN = new unicore.Token(
  69,
  WETH_ADDRESS,
  18,
  "WETH",
  "Wrapped Ether"
);

const USDC_TOKEN = new unicore.Token(69, USDC_ADDRESS, 6, "USDC", "USD//C");

function getPool() {
  const poolAddress = univ3sdk.computePoolAddress({
    factoryAddress: FACTORY_ADDRESS,
    tokenA: WETH_TOKEN,
    tokenB: USDC_TOKEN,
    fee: 500,
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

async function ticks(c, tick) {
  const t = await c.methods
    .ticks(tick)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => tickUpper() failed");
    });
  return t;
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

async function slot0(c) {
  const s0 = await c.methods
    .slot0()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => s0() failed");
    });
  return s0;
}

const TARGET_TRADE_SIZE = 100; // in dollars
const POOL_FEE = 500;

function calculateAmounts(tick, lower, upper, value) {
  if (tick < lower) tick = lower;
  else if (tick > upper) tick = upper;
  let p = getTickPrice(tick);
  let plow = getTickPrice(lower);
  let pup = getTickPrice(upper);
  console.log("price=", p, "low=", plow, "pup=", pup);
  let v = (Math.sqrt(pup) - Math.sqrt(p)) / Math.sqrt(p) / Math.sqrt(pup);
  let s = (Math.sqrt(p) - Math.sqrt(plow)) / Math.sqrt(p) / Math.sqrt(plow);
  console.log("v=", v, "s=", s);
  let vr = v / (s + v);
  let sr = s / (s + v);
  console.log("vr=", vr, "sr=", sr);
  return { vr, sr };
}

async function mint(contract, walletAddress, lowerNut, value) {
  try {
    let calls = [];
    let c = await erc.getContract(OP_WETH_ADDRESS);
    await erc.approve(c, walletAddress, NF_POSITION_MANAGER_ADDRESS, 1);
    c = await erc.getContract(OP_USDC_ADDRESS);
    await erc.approve(c, walletAddress, NF_POSITION_MANAGER_ADDRESS, 1);
    let p = await getPool();
    console.log("Pool=", p);
    let pc = await getPoolContract(p);
    //console.log("PoolContract=",pc);
    let s0 = await slot0(pc);
    let ts = parseInt(await tickSpacing(pc));
    let tick = parseInt(s0[1]);
    let upperNut = lowerNut + TICK_SPACING * TS_SPAN;
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
    let params = [
      WETH_ADDRESS,
      USDC_ADDRESS,
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
    calls.push(mintEncode);
    calls.push(refundEncode);
    let tx = await contract.methods.multicall(calls).send({
      from: walletAddress,
      value: vin,
      gas: 800000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    });
    console.log("tx=", tx);
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => mint failed");
  }
}

function nearestTick(tick) {
  let nut = univ3sdk.nearestUsableTick(tick, TICK_SPACING);
  return nut;
}

function findTicks(tick) {
  let ts = TICK_SPACING;
  let nut = univ3sdk.nearestUsableTick(tick, ts);
  let lowSpace = nut % (ts * TS_SPAN);
  lowSpace = (lowSpace + ts * TS_SPAN) % (ts * TS_SPAN);
  console.log("tick", tick, "nut", nut, "low", lowSpace);
  let lowerNut = nut - lowSpace;
  let upperNut = lowerNut + ts * TS_SPAN;
  console.log("initial lowerNut=", lowerNut, "upperNut=", upperNut);
  if (tick < lowerNut) {
    lowerNut -= TS_SPAN * ts;
    upperNut -= TS_SPAN * ts;
  } else if (tick > upperNut) {
    lowerNut += TS_SPAN * ts;
    upperNut += TS_SPAN * ts;
  }
  console.log("final lowerNut=", lowerNut, "upperNut=", upperNut);
  return { lowerNut, upperNut };
}

async function increaseLiquidity(c, walletAddress, tokenid, value) {
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
    params = [tokenid, vin, sin, 0, 0, Math.floor(Date.now() / 1000) + 60 * 20];
    console.log("increaseLiquidity params=", params);
    let increaseEncode = await c.methods.increaseLiquidity(params).encodeABI();
    let refundEncode = await c.methods.refundETH().encodeABI();
    calls.push(increaseEncode);
    calls.push(refundEncode);
    let tx = await c.methods.multicall(calls).send({
      from: walletAddress,
      value: vin,
      gas: 800000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    });
    console.log("tx=", tx);
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => increaseLiquidity and refund failed");
  }
}

async function removeLiquidity(c, walletAddress, tokenid) {
  try {
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
    let removeEncode = await c.methods.decreaseLiquidity(params).encodeABI();
    let cparams = {
      tokenid: tokenid,
      recipient: walletAddress,
      amount0Max: MAX_ETH_IN,
      amount1Max: MAX_USD_IN,
    };
    cparams = [tokenid, walletAddress, MAX_ETH_IN, MAX_USD_IN];
    let collectEncode = await c.methods.collect(cparams).encodeABI();
    calls.push(removeEncode);
    calls.push(collectEncode);
    await c.methods.multicall(calls).send({
      from: walletAddress,
      gas: 800000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    });
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => removeLiquidity and collect failed");
  }
}

async function getPositions(wname, walletAddress) {
  let c = await getContract();
  await getTokenIds(c, walletAddress);
  let pos = [];
  if (wname != "lance") return pos;
  let q = maps.priceMap.get("ETH");
  console.log("liquidityMap=");
  liquidityMap.forEach((value, key) => {
    console.log(key, value);
    let p = q;
    let tl = parseInt(key);
    let pid = lowTickMap.get(parseInt(key));
    let plower = getTickPrice(tl);
    let pupper = getTickPrice(tl + TICK_SPACING * TS_SPAN);
    if (p < plower) p = plower;
    else if (p > pupper) p = pupper;
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
    var newpos = [
      {
        id: pid,
        symbol: "ETH",
        decimals: 18,
        tickLower: tl,
        liquidity: liq,
        amount: vamt,
        quote: q,
        usd: vusd,
      },
      {
        id: pid,
        symbol: "USDC",
        decimals: 6,
        tickLower: tl,
        liquidity: liq,
        amount: samt,
        quote: 1,
        usd: susd,
      },
    ];
    pos = pos.concat(newpos);
  });
  console.log("UNI V3 positions=", pos);
  return pos;
}

async function main() {
  let wallet = await wall.init("lance", "op");

  const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  let q = await quote.oneFastQuote(ETH_ADDRESS, 10);
  maps.priceMap.set("ETH", q);
  //await getPositions("lance",wallet.address);
  //console.log("liquidityMap",liquidityMap);
  //console.log("lowTickMap",lowTickMap);

  let c = await getContract();
  let pos = await positions(c, 345369);
  console.log("POSITION", pos);
  //await mint(c,wallet.address,10);
  //await removeLiquidity(c,wallet.address,344383);
  //await increaseLiquidity(c,wallet.address,344939,10);
}

main();

// TO DO
// add init() that inserts tokens into price map
// add maps to store pool info: tick spacing, pool name, tokens in pool, etc.
// change iterator on pool to use pid since that is unique across any pool type, lower tick number is not
module.exports = Object.assign({
  getPositions,
  getContract,
  mint,
  increaseLiquidity,
  removeLiquidity,
  getTickPrice,
  getTickFromPrice,
  nearestTick,
  findTicks,
  lowTickMap,
  liquidityMap,
  getContract,
  slot0,
  ticks,
  feeGrowthGlobal0X128,
  feeGrowthGlobal1X128,
  positions,
  getPoolContract,
});
