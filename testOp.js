const pool = require("./poolOp.js");
const univ3 = require("./univ3.js");
const chain = require("./chain.js");
const maps = require("./maps.js");
const wall = require("./wallet.js");
const erc = require("./erc20.js");
const quote = require("./quote.js");

async function main() {
  const wname = "lance";
  let wallet = await wall.init(wname, "op");
  let WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
  let c = await erc.getContract(WETH_ADDRESS);
  let pos = await pool.getPositions(wname, wallet.address);
  console.log(pos);
  let tid = await pool.defundPosition(wname, wallet.address, pos, true);
  console.log("tid", tid);
  /*
  let q = await quote.oneFastQuote(chain.getAddress("WETH"),"poly");
  maps.priceMap.set("ETH",q);
  let {lowerNut,upperNut} = univ3.findTicks(q);
  console.log("lower=",lowerNut,"upper=",upperNut);
  let c = await univ3.getContract();
  await univ3.init();
  await univ3.mint(c,wallet.address,lowerNut,10);
*/
  /*
  let params = {a: "a", b: "b"};
  console.log(params);
  params.c = "c";
  console.log(params);
*/
}

main();
