//Imports

require("dotenv").config();
//const ch = require("./chain.js");
//ch.setChain("eth");
const web = require("./web3.js");
//console.log("web.chain=",web.chain);
//console.log("web.chain=",web.chain);
//console.log("web.chain=",web.chain);
var BigNumber = require("big-number");
const mirrorABI = require("./ABI/Mirror.json");
const maps = require("./maps.js");
const erc20 = require("./erc20.js");
const erc20ABI = require("./ABI/erc20.json");
const wall = require("./wallet.js");
const nodemailer = require("./nodemailer.js");
const inch = require("./1inch.js");

const mirAddress = "0x09a3EcAFa817268f77BE1283176B946C4ff2E608";
const ustAddress = "0xa47c8bf37f92aBed4A126BDA807A7b7498661acD";

var web3 = web.web3;

poolAddresses = [
  "0x735659c8576d88a2eb5c810415ea51cb06931696",
  "0x5b64BB4f69c8C03250Ac560AaC4C7401d78A1c32",
  "0x43dfb87a26ba812b0988ebdf44e3e341144722ab",
  "0x29cf719d134c1c18dab61c2f4c0529c4895ecf44",
  "0xc1d2ca26a59e201814bf6af633c3b3478180e91f",
  "0x2221518288af8c5d5a87fd32717fab154240d942",
  "0xdb278fb5f7d4a7c3b83f80d18198d872bbf7b923",
  "0x769325e8498bf2c2c3cfd6464a60fa213f26afcc",
  "0x1fabef2c2dab77f01053e9600f70be1f3f657f51",
  "0x27a14c03c364d3265e0788f536ad8d7afb0695f7",
  "0x99d737ab0df10cdc99c6f64d0384acd5c03aef7f",
];

//*********************************************************************
//
//*********************************************************************

async function getContract(address) {
  //console.log("inside getcontract", address);
  const mirrorContract = new web3.obj.eth.Contract(mirrorABI, address);
  //console.log("contract=", mirrorContract);
  return mirrorContract;
}

async function claim(contract, walletAddress) {
  console.log("claiming", walletAddress);
  const nonce = await web3.obj.eth.getTransactionCount(walletAddress);
  const tx = await contract.methods
    .getReward()
    .send({ from: walletAddress, gas: 1000000, nonce: nonce })
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => claim failed");
    });
  return tx;
}

async function getMIR(walletAddress) {
  const c = await new web3.obj.eth.Contract(erc20ABI, mirAddress);

  let bal = await c.methods
    .balanceOf(walletAddress)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => balanceOf failed");
    });
  //console.log("balanceOf", bal);
  bal = parseInt(BigNumber(bal).div(BigNumber(10).pow(18)).toString());
  //console.log("balanceOf", bal);
  return bal;
}

async function check(poolAddress, walletAddress) {
  console.log("checking address", poolAddress);
  const c = await getContract(poolAddress);
  //console.log("got contract",c);
  e = await earned(c, walletAddress);
  //console.log("got earned");
  console.log("poolAddress=", poolAddress, e);
  if (e > 1000) {
    console.log("rewards=", e);
    await claim(c, walletAddress);
  }
  //console.log("earned",poolAddress,e);
}

async function checkAll(walletAddress) {
  console.log("checkAll");
  for (let i = 0; i < poolAddresses.length; i++) {
    await check(poolAddresses[i], walletAddress);
  }
}

async function earned(c, walletAddress) {
  //console.log("inside earned", walletAddress);
  var e = await c.methods
    .earned(walletAddress)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => earned failed");
    });
  // console.log(tx);
  e = BigNumber(e).mult(100).div(BigNumber(10).pow(18)) / 100;
  return e;
}

async function main(retries = 0) {
  const maxretries = 3;
  kucoinMirAddress = "0xac721C0B1023F6A7583FcD60FDE45C97814AfF0e";
  try {
    nodemailer.init("lance");
    nodemailer.setSubjectStartOption("ATTENTION: ");
    var wname = "lance";
    //console.log("init wallet", wname);
    let wallet = await wall.init(wname, "eth");
    //console.log("checking all", wallet.address);
    await checkAll(wallet.address);
    console.log("getting MIR");
    const mir = await getMIR(wallet.address);
    console.log("MIR=", mir);

    const c = await new web3.obj.eth.Contract(erc20ABI, mirAddress);
    const d = await erc20.decimals(c);
    if (mir > 10000) {
      //     const amt = BigNumber(Math.floor(mir)).mult(BigNumber(10).pow(d)).toString();
      //      console.log("transferring",amt,"to KuCoin");
      //      await erc20.transfer(c,wallet.address, kucoinMirAddress,amt);
      //console.log("sending email");
    }
    const amount = BigNumber(5000).mult(BigNumber(10).pow(18)).toString();
    if (mir > 5000) {
      await inch.swap(
        mirAddress,
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        amount,
        wallet.address
      );
      //await inch.swap(mirAddress,ustAddress,amount,wallet.address);
      await nodemailer.sendMail("Swapping 5000 MIR", "current MIR " + mir);
    }
  } catch (e) {
    console.log(e.message);
    if (shouldRetry(e.message) && retries < maxretries) {
      main(retries + 1);
    }
  }
}

function shouldRetry(msg) {
  if (msg.search("Request failed with status code 400") >= 0) return 1;
  else if (msg.search("Request failed with status code 500") >= 0) return 1;
  else if (msg.search("nonce too low") >= 0) return 1;
  else if (msg.search("we can't execute this request") >= 0) return 1;
  else if (msg.search("Invalid JSON RPC response") >= 0) return 1;
  else if (msg.search("swap() failed") >= 0) return 1;
  else return 0;
}

main();
