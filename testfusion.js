let portfolio = require("./portfolio.js");
let multi = require("./multiswap.js");
let fusion = require("./1fusion.js");
let pool = require("./poolMulti.js");

async function main() {
  let port = portfolio.get();
  let ch = "op";
  let walletAddress = "0x0fFeb87106910EEfc69c1902F411B431fFc424FF";
  port.snapshot = await pool.getPositions(port);
  //await pool.init(port,ch);
  await fusion.getQuote(ch, "USDC", "WETH", 2000);
  // await fusion.swap(ch,"USDC","WETH",2000,walletAddress);
  // await fusion.getQuote(ch,"WETH","USDC",1.2);
  // await fusion.swap(ch,"WETH","USDC",1.2,walletAddress);
  // await fusion.getQuote(ch,"WETH","USDC", 1.074412);
  //await multi.quoteEthSwap(port,"ETH","USDC",1);
  //await multi.swap(port,"ETH","USDC",1);
  //  await multi.swap(port,"USDC","ETH",1786.611962);
  //  await multi.quoteEthSwap(port,"USDC", "ETH",1000);
  //  fusion.printOrder("0x55e18a012c8f9a54aec4c521a5e2e4161146344ccdd2b848a34553ca4fd807b9",walletAddress);
}

main();
