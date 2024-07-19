const quote = require("./quote.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  while (1) {
    try {
      const pngAddr = "0x60781c2586d68229fde47564546784ab3faca982";
      const usdcAddr = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

      //await quote.oneLoadQuotes();
      q = await quote.oneFastQuote(usdcAddr);
      console.log("1inch AVAX=", q);
      //cgq = await quote.cgQuote("avalanche-2");
      //console.log("Coingecko AVAX=",cgq);
    } catch (e) {
      console.log(e.message);
    }
    await sleep(5000);
  }
}

main();
