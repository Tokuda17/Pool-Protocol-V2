const kc = require("./kucoin.js");
const inch = require("./1inch.js");

async function main() {
  await inch.initMaps();
  await kc.init();
  await kc.getOrderbook();
  const q = await kc.getQuote("AVAX-USDC", "AVAX", 309);
  console.log("Quote=", q);
}

main();
