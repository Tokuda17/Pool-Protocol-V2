const BigNumber = require("big-number");
const portfolio = require("./portfolio.js");
const web = require("./web3.js");
const erc20 = require("./erc20.js");
const pool = require("./poolV2.js");
let uniPoolABI = require("@uniswap/v2-core/build/UniswapV2Pair.json");
uniPoolABI = uniPoolABI.abi;
web3 = web.web3;

//*********************************************************************
// Uniswap Pool Methods
//*********************************************************************
async function getPoolContract(addr) {
  try {
    //console.log("uniPoolABI=",uniPoolABI);
    //console.log("addr=",addr);
    const contract = await new web3.obj.eth.Contract(uniPoolABI, addr);
    return contract;
  } catch (e) {
    console.log(e.message + " getContract failed");
    throw Error(e.message + " => getContract failed");
  }
}

async function getReserves(c) {
  try {
    //console.log("allowance contract", c);
    const reserves = await c.methods
      .getReserves()
      .call()
      .catch(function (e) {
        console.log(e.message);
        throw new Error(e.message + " => getReserves failed");
      });
    console.log("reserves", reserves);
    return reserves;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => getReserves failed");
  }
}

async function token0(c) {
  try {
    const t = await c.methods
      .token0()
      .call()
      .catch(function (e) {
        console.log(e.message);
        throw new Error(e.message + " => token0 failed");
      });
    console.log("token0", t);
    return t;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => token0 failed");
  }
}

async function token1(c) {
  try {
    const t = await c.methods
      .token1()
      .call()
      .catch(function (e) {
        console.log(e.message);
        throw new Error(e.message + " => token1 failed");
      });
    console.log("token1", t);
    return t;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => token1 failed");
  }
}

async function getPositions(wname, walletAddress, q) {
  let poolAddress = "0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d";
  let ec = await erc20.getContract(poolAddress);
  let total = await erc20.totalSupply(ec);
  console.log("total=", total);
  let bal = await erc20.balanceOf(
    ec,
    "0x0fFeb87106910EEfc69c1902F411B431fFc424FF"
  );
  bal = BigNumber(Math.floor(0.000124058839102555 * 10000000000))
    .mult(BigNumber(10).pow(18 - 10))
    .toString();
  console.log("bal=", bal);
  let ownership =
    parseInt(BigNumber(bal).mult(100000000).div(total).toString()) / 100000000;
  console.log("ownership=", ownership);
  let c = await getPoolContract(poolAddress);
  console.log("getPoolContract");
  let r = await getReserves(c);
  console.log("reserves=", r);
  let samt =
    parseInt(
      BigNumber(r._reserve0)
        .mult(Math.floor(parseFloat(ownership) * 100000000))
        .div(100000000)
        .toString()
    ) / 1000000;
  let vamt =
    parseInt(
      BigNumber(r._reserve1)
        .mult(Math.floor(parseFloat(ownership) * 100000000))
        .div(BigNumber(10).pow(8 + 18 - 6))
        .toString()
    ) / 1000000;

  let vBig = BigNumber(Math.floor(vamt * 1000000))
    .mult(BigNumber(10).pow(18 - 6))
    .toString();
  let sBig = Math.floor(samt * 1000000);
  let pos = [
    {
      id: "quick-1",
      chain: "poly",
      symbol: "ETH",
      decimals: 18,
      liquidity: bal,
      amount: vBig,
      quote: q,
      usd: vamt * q,
    },
    {
      id: "quick-1",
      chain: "poly",
      symbol: "USDC",
      decimals: 6,
      liquidity: bal,
      amount: sBig,
      quote: 1,
      usd: samt,
    },
  ];
  return pos;
}

/*
async function main()
{
  let port = portfolio.get();
  await pool.init(port); 
  console.log("init completed");
  let poolAddress = "0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d";
  let ec = await erc20.getContract(poolAddress);
  let total = await erc20.totalSupply(ec);
  console.log("total=",total);
  let bal = await erc20.balanceOf(ec,"0x0fFeb87106910EEfc69c1902F411B431fFc424FF");
  console.log("bal=",bal);
  let ownership = parseInt(BigNumber(bal).mult(100000000).div(total).toString())/100000000;
  console.log("ownership=",ownership);
  let c = await getPoolContract(poolAddress);
  console.log("getPoolContract");
  let r = await getReserves(c);
  console.log("reserves=",r);
  let t0 = parseInt(BigNumber(r._reserve0).mult(Math.floor(parseFloat(ownership)*100000000)).div(100000000).toString())/1000000;
  console.log("t0=",t0);
  let t1 = parseInt(BigNumber(r._reserve1).mult(Math.floor(parseFloat(ownership)*100000000)).div(BigNumber(10).pow(8+18-6)).toString())/1000000;
  console.log("t1=",t1);
}

main();
*/

module.exports = Object.assign({
  getPositions,
});
