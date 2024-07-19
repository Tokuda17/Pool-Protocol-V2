const alchemy = require("alchemy-sdk");
const pool = require("./poolMulti.js");
const multi = require("./multiswap.js");
const unic = require("./unicache.js");
const wall = require("./wallet.js");
const portfolio = require("./portfolio.js");

function testmod(port) {
  port.testattribute = "here i am";
}
async function main() {
  let port = portfolio.get();
  //let q = await multi.getEthQuote();
  port.snapshot = await pool.getPositions(port);
  q = await multi.quoteEthSwap(port, "ETH", "USDC", 2);
  console.log("q=", q);
  //q = await multi.quoteEthSwap(port,"USDC","ETH",4000);
  //unic.saveObj("testtag", q);
  //console.log("q=",q);
  //await pool.init(port,"op");
  //await multi.swap(port, "USDC", "ETH", 2000);
  //await multi.swap(port, "ETH","USDC", 1.05);
  //await multi.swap(port, "USDC", "ETH", 1);
  //await multi.swap(port, "ETH","USDC", 0.0001);
  //let v = alchemy.Utils.parseEther("0.001");
  //console.log("value=",v);
  //console.log("value=",v.toString());
  //await wall.init("lance","eth");
  //let alc = web.getEthersAlchemy("eth");
  //let gasPrice = await alc.core.getGasPrice();
  //console.log("gasPrice=",gasPrice.toString());
  //await multi.adjustForGas(205853,"ETH",0,"poly",2000);
  //await multi.adjustForGas(205853,"ETH",0,"op",2000);
  //await multi.adjustForGas(9630079,"USDC",0,"arb",2000);
  /*
  let a = wall.getEthersAlchemy("poly");
  let g = await a.core.getGasPrice();
  console.log("gas=",g);
  console.log("gas=",g.toString());

  let v = alchemy.Utils.parseUnits("5","gwei"); 
  console.log("value=",v);
  console.log("value=",v.toString());
*/
}

main();
