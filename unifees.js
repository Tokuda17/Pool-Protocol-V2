const ethers = require("ethers");
const web = require("./web3.js");
const unic = require("./unicache.js");
web3 = web.web3;
const BigNumber = require("big-number");
const feesMap = new Map();

const providerOp = new ethers.providers.JsonRpcProvider(
  "https://opt-mainnet.g.alchemy.com/v2/rHtq3eFE7jm_xUmUNJOOOg4LR9wngukb"
);
const providerPoly = new ethers.providers.JsonRpcProvider(
  "https://polygon-mainnet.g.alchemy.com/v2/AmllS7MVSHEnkL8dxIWD0QiDQhMWe5Ry"
);

const NF_POSITION_MANAGER_ADDRESS =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const uniABI = require("./ABI/UniswapV3.json");

async function getFees(walletAddress, tid) {
  try {
    let fmap = feesMap.get(parseInt(tid));
    if (fmap) {
      console.log("FOUND FEES", fmap);
      let f0 = fmap["f0"];
      let f1 = fmap["f1"];
      return { f0, f1 };
    }
    //let f = unic.readTagId("unifees",tid);
    //  console.log("cached FEES=",f);
    //console.log("Getting fees for ", walletAddress, tid);
    //throw new Error("test error");
    let provider;
    let m0, m1;
    if (web3.chain == "op") {
      provider = providerOp;
      m0 = "100000000000000000000000";
      m1 = "1000000000000";
    } else if (web3.chain == "poly") {
      provider = providerPoly;
      m0 = "1000000000000";
      m1 = "100000000000000000000000";
    } else throw new Error("No provider for chain => unifees.getFees() failed");
    let c = new ethers.Contract(NF_POSITION_MANAGER_ADDRESS, uniABI, provider);
    let results = await c.callStatic.collect(
      {
        tokenId: tid,
        recipient: walletAddress,
        amount0Max: m0,
        amount1Max: m1,
      },
      { from: walletAddress }
    );
    //console.log("collect fees result", results);
    let a0 = results.amount0.toString();
    let a1 = results.amount1.toString();
    if (web3.chain == "poly") {
      let atmp = a0;
      a0 = a1;
      a1 = atmp;
    }
    let f0 = parseInt(BigNumber(a0).div(BigNumber(10).pow(18 - 6))) / 1000000;
    let f1 = Math.floor(parseInt(a1) / 10000) / 100;
    unic.writeTagId("unifees", tid, { f0: f0, f1: f1 });
    feesMap.set(parseInt(tid), { f0: f0, f1: f1 });
    return { f0, f1 };
  } catch (e) {
    console.log(e.message);
    let f = unic.readTagId("unifees", tid);
    if (f) {
      console.log("RETURNING f=", f, f["f0"], f["f1"]);
      let f0 = f["f0"];
      let f1 = f["f1"];
      return { f0, f1 };
    }
    throw new Error(e.message + " => getFees failed");
  }
}

/*
async function main()
{
  const {f0,f1} = await getFees("0x0fFeb87106910EEfc69c1902F411B431fFc424FF",352079);
console.log("Fee0:",f0);
console.log("Fee1:",f1);
}
*/

module.exports = Object.assign({
  getFees,
});
