const pool = require("./poolMulti.js");
const multi = require("./multiswap.js");
const wall = require("./wallet.js");
const utils = require("./utils.js");

async function main() {
  let port = {
    email: "multi", // tag to lookup who you should email. false should not email
    uniswapV3: { chain: "op", wname: "lance" }, // where to create Uniswap V3 positions
    wallets: [
      { wname: "lance", chain: "op" }, // looking up wallet addresses on different chains
      { wname: "lance", chain: "poly" },
    ],
  };
  const start = parseInt(Date.now() / 1000);
  let now = parseInt(Date.now() / 1000);
  const TIMEOUT = 50;
  const SLEEP = 3;
  while (start + TIMEOUT > now) {
    try {
      let pos = await pool.adjust(port, false);
      console.log(
        "Checking time:",
        start + TIMEOUT,
        now,
        "Remaining time: ",
        start + TIMEOUT - now
      );
      console.log("Sleeping ...");
      await utils.sleep(3);
      now = parseInt(Date.now() / 1000);
    } catch (e) {
      console.log(e.message, " in main while{}");
      //unic.saveFile("update",wname,e.message + " => main while{} failed");
      if (!utils.shouldRetry(e.message)) {
        throw new Error(e.message + " => main.while() error failed");
      }
    }
  }
}

main();
