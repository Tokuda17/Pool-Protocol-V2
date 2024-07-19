const quote = require("./quote.js");
const chain = require("./chain.js");
const utils = require("./utils.js");
const unic = require("./unicache.js");

async function getQuotes() {
  let ch;
  ch = "eth";
  chain.init(ch);
  let qeth = await quote.oneFastQuote(chain.getAddress("WETH"), ch);
  //console.log("qeth=",qeth);
  ch = "avax";
  chain.init(ch);
  let qavax = await quote.oneFastQuote(chain.getAddress("WETH"), ch);
  //console.log("qavax=",qavax);
  ch = "op";
  chain.init(ch);
  let qop = await quote.oneFastQuote(chain.getAddress("WETH"), ch);
  //console.log("qop=",qop);
  ch = "poly";
  chain.init(ch);
  let qpoly = await quote.oneFastQuote(chain.getAddress("WETH"), ch);
  //console.log("qpoly=",qpoly);
  let qs = { qeth: qeth, qavax: qavax, qop: qop, qpoly: qpoly };
  return qs;
}

async function main() {
  try {
    const start = parseInt(Date.now() / 1000);
    let now = parseInt(Date.now() / 1000);
    const TIMEOUT = 50;
    const SLEEP = 6;
    while (start + TIMEOUT > now) {
      try {
        let qs = await getQuotes();
        console.log("qs=", qs);
        let json = JSON.stringify(qs);
        //unic.saveFile("ethquotes",".",json);
        console.log("Sleeping ...");
        await utils.sleep(3);
        now = parseInt(Date.now() / 1000);
      } catch (e) {
        console.log(e.message, " in main while{}");
        break;
      }
    }
  } catch (e) {
    console.log(e.message, " in main()");
  }
}

main();
