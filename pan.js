require("dotenv").config();
var BigNumber = require("big-number");

const erc20 = require("./erc20.js");
const maps = require("./maps.js");
const web = require("./web3.js");
const web3 = web.web3;
const panPoolABI = require("./ABI/PangolinPool.json");
const spellABI = require("./ABI/PangolinSpellV2.json"); //pan = Pangolin
const wchefABI = require("./ABI/WMiniChefV2PNG.json");
const chefABI = require("./ABI/PangolinMiniChefV2.json");

wchefAddress = "0xa67CF61b0b9BC39c6df04095A118e53BFb9303c7";
spellAddress = "0x966bbec3ac35452133B5c236b4139C07b1e2c9b1";

const AVAX_USDCe_ADDRESS = "0xbd918Ed441767fe7924e99F6a0E0B568ac1970D9";
const AVAX_USDC_ADDRESS = "0x0e0100Ab771E9288e0Aa97e11557E6654C3a9665";
const AVAX_USDT_ADDRESS = "0xe3bA3d5e3F98eefF5e9EDdD5Bd20E476202770da";

//*********************************************************************
// Pangolin Alpha contract and methods
//*********************************************************************

function getChefContract(chefAddress) {
  const chefContract = new web3.obj.eth.Contract(chefABI, chefAddress);
  return chefContract;
}

function getWchefContract() {
  const chefContract = new web3.obj.eth.Contract(wchefABI, wchefAddress);
  return chefContract;
}

/*
function getSpellContract() {
  const spellContract = new web3.obj.eth.Contract(spellABI, spellAddress);
  return spellContract;
}

async function claimReward(spellContract,walletAddress) {
  const tx = await spellContract.methods
    .harvestWMiniChefRewards()
    .call({ from: walletAddress, gas: 1100000 })
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message+" => claimReward failed");
    });
  return tx;    
}

*/

//*********************************************************************
// Pangolin liquidity pool contract and methods
//*********************************************************************

const lpList = new Array("AVAX-USDC.e", "AVAX-USDT");

async function initMaps() {
  maps.addressMap.set("AVAX-USDC", AVAX_USDC_ADDRESS);
  maps.symbolMap.set(AVAX_USDC_ADDRESS, "AVAX-USDC");
  maps.decimalsMap.set("AVAX-USDC", 18);

  maps.addressMap.set("AVAX-USDC.e", AVAX_USDCe_ADDRESS);
  maps.symbolMap.set(AVAX_USDCe_ADDRESS, "AVAX-USDC.e");
  maps.decimalsMap.set("AVAX-USDC.e", 18);

  maps.addressMap.set("AVAX-USDT", AVAX_USDT_ADDRESS);
  maps.symbolMap.set(AVAX_USDT_ADDRESS, "AVAX-USDT");
  maps.decimalsMap.set("AVAX-USDT", 18);

  //console.log("addressMap in pool.js initMaps",maps.addressMap);
}

function getContract(pool) {
  try {
    const contract = new web3.obj.eth.Contract(panPoolABI, pool);
    return contract;
  } catch (e) {
    console.log("getContract failed");
    throw Error(e.message + " => getContract failed");
  }
}

async function vaultPendingReward(pid, walletAddress) {
  const addr = "0x1f806f7C8dED893fd3caE279191ad7Aa3798E928";
  const chefContract = new web3.obj.eth.Contract(chefABI, addr);
  const tx = await chefContract.methods
    .pendingReward(pid, walletAddress)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => pendingReward failed");
    });
  console.log("PENDING REWARD: " + tx);
  //let png = parseInt(BigNumber(tx).div(BigNumber(10).pow(18)).toString());
  let rewards = new Array();
  let pname;
  if (pid == 113) pname = "AVAX-USDT";
  else if (pid == 55) pname = "AVAX-USDC";
  else if (pid == 9) pname = "AVAX-USDC.e";
  let reward = { id: pname, symbol: "PNG", amount: tx, decimals: 18 };
  rewards.push(reward);
  console.log("REWARDS: ", rewards);
  return rewards;
}

async function vaultHarvest(pid, walletAddress) {
  console.log("CALLING VAULT HARVEST");
  const addr = "0x1f806f7C8dED893fd3caE279191ad7Aa3798E928";
  const chefContract = new web3.obj.eth.Contract(chefABI, addr);
  const tx = await chefContract.methods
    .harvest(pid, walletAddress)
    .send({
      from: walletAddress,
      gas: 1100000,
      nonce: await web3.obj.eth.getTransactionCount(walletAddress),
    })
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => harvest failed");
    });
}

const HARVEST_THRESHOLD = 3000;
async function getPositions(walletAddress, pos) {
  /*
  for (let i=0; i < pos.length; i++)
  {
    if (lpList.includes(pos[i].symbol))
    {
      let poolTokens = await getPoolTokens(pos[i].symbol,maps.addressMap.get(pos[i].symbol),pos[i].amount);
      let lpPos = poolTokens.positions;
      pos = pos.concat(lpPos);
    }
  } 
*/
  let poolTokens = await getPoolTokens(
    "AVAX-USDC",
    maps.addressMap.get("AVAX-USDC"),
    "59930834814284153"
  );
  let pid;
  let lpPos;
  let pos2;

  pid = 55;
  lpPos = poolTokens.positions;
  pos = pos.concat(lpPos);
  pos2 = await vaultPendingReward(pid, walletAddress);
  if (
    pos2 &&
    pos2[0] &&
    BigNumber(pos2[0].amount).gt(
      BigNumber(HARVEST_THRESHOLD).mult(BigNumber(10).pow(18))
    )
  ) {
    await vaultHarvest(pid, walletAddress);
  } else pos = pos.concat(pos2);

  pid = 9;
  poolTokens = await getPoolTokens(
    "AVAX-USDC.e",
    maps.addressMap.get("AVAX-USDC.e"),
    "70635436980289715"
  );
  lpPos = poolTokens.positions;
  pos = pos.concat(lpPos);
  pos2 = await vaultPendingReward(pid, walletAddress);
  if (
    pos2 &&
    pos2[0] &&
    BigNumber(pos2[0].amount).gt(BigNumber(4000).mult(BigNumber(10).pow(18)))
  ) {
    await vaultHarvest(pid, walletAddress);
  } else pos = pos.concat(pos2);
  pid = 113;
  poolTokens = await getPoolTokens(
    "AVAX-USDT",
    maps.addressMap.get("AVAX-USDT"),
    "40560238448279731"
  );
  lpPos = poolTokens.positions;
  pos = pos.concat(lpPos);
  pos2 = await vaultPendingReward(pid, walletAddress);
  if (
    pos2 &&
    pos2[0] &&
    BigNumber(pos2[0].amount).gt(BigNumber(4000).mult(BigNumber(10).pow(18)))
  ) {
    await vaultHarvest(pid, walletAddress);
  } else pos = pos.concat(pos2);
  return pos;
}

async function token0(contract) {
  const t0 = await contract.methods
    .token0()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => poolToken0 failed");
    });
  return t0;
}

async function token1(contract) {
  const t1 = await contract.methods
    .token1()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => poolToken1 failed");
    });
  return t1;
}

async function getReserves(contract) {
  const res = await contract.methods
    .getReserves()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => poolGetReserves failed");
    });
  return res;
}

async function totalSupply(contract) {
  const total = await contract.methods
    .totalSupply()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => poolTotalSupply failed");
    });
  return total;
}

async function getPoolTokens(id, poolAddress, tokens) {
  try {
    const poolContract = getContract(poolAddress);
    const t0 = await token0(poolContract);
    const t1 = await token1(poolContract);
    const res = await getReserves(poolContract);
    const total = await totalSupply(poolContract);
    const c0 = await erc20.getContract(t0);
    const d0 = await erc20.decimals(c0, t0);
    const c1 = await erc20.getContract(t1);
    const d1 = await erc20.decimals(c1, t1);
    const sym0 = await erc20.symbol(c0);
    const sym1 = await erc20.symbol(c1);
    //addressMap.set(sym0, t0);
    //addressMap.set(sym1, t1);
    //decimalsMap.set(sym0, d0);
    //decimalsMap.set(sym1, d1);
    //symbolMap.set(t0,sym0);
    //symbolMap.set(t1,sym1);
    //console.log("tokens=",tokens);
    //console.log("total=",total);
    //console.log("res._reserve0=",res._reserve0);
    //console.log("res._reserve1=",res._reserve1);
    let amt0 = BigNumber(tokens).mult(res._reserve0).divide(total).toString();
    let amt1 = BigNumber(tokens).mult(res._reserve1).divide(total).toString();
    //console.log("amt0=",amt0);
    //console.log("amt1=",amt1);
    let price;
    if (isStablecoin(sym0))
      price =
        parseInt(
          BigNumber(res._reserve0)
            .mult(BigNumber(10).pow(d1))
            .mult(1000000)
            .div(res._reserve1)
            .div(BigNumber(10).pow(d0))
            .toString()
        ) / 1000000;
    else
      price =
        parseInt(
          BigNumber(res._reserve1)
            .mult(BigNumber(10).pow(d0))
            .mult(1000000)
            .div(res._reserve0)
            .div(BigNumber(10).pow(d1))
            .toString()
        ) / 1000000;
    const collateral = {
      poolNativePrice: price,
      positions: [
        {
          id: id,
          symbol: sym0,
          token: t0,
          amount: amt0,
          decimals: d0,
        },
        {
          id: id,
          symbol: sym1,
          token: t1,
          amount: amt1,
          decimals: d1,
        },
      ],
    };
    //console.log("getPoolTokens collateral=",collateral);
    return collateral;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => getPoolTokens failed");
  }
}
function isStablecoin(sym) {
  //console.log("is stablecoin");
  //console.log(sym);
  return ["USDC", "USDT", "USDC.E", "DAI", "USDT.E", "DAI.E"].includes(
    sym.toUpperCase()
  );
}

async function getPriceFromPool(poolAddress) {
  try {
    console.log("getPriceFromPool poolAddress=", poolAddress);
    const poolContract = getContract(poolAddress);
    const t0 = await token0(poolContract);
    const t1 = await token1(poolContract);
    const res = await getReserves(poolContract);
    const total = await totalSupply(poolContract);
    const c0 = await erc20.getContract(t0);
    const d0 = await erc20.decimals(c0, t0);
    const c1 = await erc20.getContract(t1);
    const d1 = await erc20.decimals(c1, t1);
    const sym0 = await erc20.symbol(c0);
    const sym1 = await erc20.symbol(c1);
    //addressMap.set(sym0, t0);
    //addressMap.set(sym1, t1);
    //decimalsMap.set(sym0, d0);
    //decimalsMap.set(sym1, d1);
    //symbolMap.set(t0,sym0);
    //symbolMap.set(t1,sym1);
    //console.log("tokens=",tokens);
    //console.log("total=",total);
    //console.log("res._reserve0=",res._reserve0);
    //console.log("res._reserve1=",res._reserve1);
    let price;
    if (isStablecoin(sym0))
      price =
        parseInt(
          BigNumber(res._reserve0)
            .mult(BigNumber(10).pow(d1))
            .mult(1000000)
            .div(res._reserve1)
            .div(BigNumber(10).pow(d0))
            .toString()
        ) / 1000000;
    else
      price =
        parseInt(
          BigNumber(res._reserve1)
            .mult(BigNumber(10).pow(d0))
            .mult(1000000)
            .div(res._reserve0)
            .div(BigNumber(10).pow(d1))
            .toString()
        ) / 1000000;
    console.log("getPriceFromPool price=", price, sym0);
    return price;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => getPriceFromPool failed");
  }
}

module.exports = Object.assign({
  initMaps,
  getPositions,
  getPriceFromPool,
  getWchefContract,
  getChefContract,
  getPoolTokens,
  getContract,
  token0,
  token1,
  getReserves,
  totalSupply,
});
