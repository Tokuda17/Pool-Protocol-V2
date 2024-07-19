const pool = require("./poolMulti.js");
const multi = require("./multiswap.js");
const portfolio = require("./portfolio.js");
const utils = require("./utils.js");

async function main() {
  let port = portfolio.get();
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
      await utils.sleep(SLEEP);
    } catch (e) {
      console.log(e.message, " in main while{}");
      //unic.saveFile("update",wname,e.message + " => main while{} failed");
      if (!utils.shouldRetry(e.message)) {
        throw new Error(e.message + " => main.while() error failed");
      }
    }
    now = parseInt(Date.now() / 1000);
  }
}

main();
