require("dotenv").config();
var BigNumber = require("big-number");

const erc20 = require("./erc20.js");
const web = require("./web3.js");
const web3 = web.web3;
const factoryABI = require("./ABI/PangolinFactory.json");
const routerABI = require("./ABI/PanRouter.json");
const poolABI = require("./ABI/PanPool.json");
const pool = require("./pool.js");

const factoryAddress = "0xefa94DE7a4656D787667C749f7E1223D71E9FD88";
const routerAddress = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";
const poolAddress = "0x912b5D41656048Ef681eFa9D32488a3fFE397994";
function getFactoryContract() {
  const contract = new web3.obj.eth.Contract(factoryABI, factoryAddress);
  return contract;
}
function getRouterContract() {
  const contract = new web3.obj.eth.Contract(routerABI, routerAddress);
  return contract;
}

function getPoolContract() {
  const contract = new web3.obj.eth.Contract(poolABI, poolAddress);
  return contract;
}

async function panAddLiquidity(
  routerContract,
  tokenA,
  tokenB,
  amtA,
  amtB,
  minA,
  minB,
  walletAddress
) {
  try {
    console.log(walletAddress);
    const tokenACon = await erc20.getContract(tokenA);
    const tokenBCon = await erc20.getContract(tokenB);
    await erc20.approve(tokenACon, walletAddress, routerAddress, amtA);
    await erc20.approve(tokenBCon, walletAddress, routerAddress, amtB);

    // await factoryContract.methods.createPair(tokenA, tokenB);
    const blockNumber = await web3.obj.eth.getBlockNumber();
    const block = await web3.obj.eth.getBlock(blockNumber);
    const deadline = BigNumber(block.timestamp).add(10).toString();
    await routerContract.methods
      .addLiquidity(
        tokenA,
        tokenB,
        amtA,
        amtB,
        minA,
        minB,
        walletAddress,
        deadline
      )
      .send({ from: walletAddress, gas: "400000" });
  } catch (e) {
    // console.log(e.message);
    throw new Error(e.message + " => panAddLiquidity failed");
  }
}

async function addPanLiquidityAVAX(
  router,
  tokenA,
  amtA,
  minA,
  amtAVAX,
  minAVAX,
  walletAddress
) {
  try {
    const tokenACon = await erc20.getContract(tokenA);
    await erc20.approve(tokenACon, walletAddress, routerAddress, amtA);
    const blockNumber = await web3.obj.eth.getBlockNumber();
    const block = await web3.obj.eth.getBlock(blockNumber);
    const deadline = await BigNumber(block.timestamp).add(10).toString();
    console.log("Create Liquidity Pair");
    await router.methods
      .addLiquidityAVAX(tokenA, amtA, minA, minAVAX, walletAddress, deadline)
      .send({ value: amtAVAX, from: walletAddress, gas: "500000" });
  } catch (e) {
    throw new Error(e.message + " => addPanLiquidityAVAX failed");
  }
}

async function getPanPair(factoryContract, tokenA, tokenB) {
  const lp = await factoryContract.methods.getPair(tokenA, tokenB).call();
  console.log(lp);
  return lp;
}

async function getAvaxLiquidity(poolContract, lp) {
  const amt = await poolContract.methods.getAvaxLiquidity(lp).call();
  return amt;
}

module.exports = Object.assign({
  getFactoryContract,
  getRouterContract,
  getPoolContract,
  panAddLiquidity,
  addPanLiquidityAVAX,
  getPanPair,
  getAvaxLiquidity,
});
