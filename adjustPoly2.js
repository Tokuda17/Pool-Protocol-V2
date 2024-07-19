const utils = require("./utils.js");
const pool = require("./poolOp.js");
const wall = require("./wallet.js");
const unic = require("./unicache.js");

async function main() {
  const wname = "lance";
  try {
    let wallet = await wall.init(wname, "poly");
    const start = parseInt(Date.now() / 1000);
    let now = parseInt(Date.now() / 1000);
    const TIMEOUT = 50;
    const SLEEP = 3;
    while (start + TIMEOUT > now) {
      try {
        await pool.adjust(wname, wallet.address);
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
  } catch (e) {
    console.log(e.message, " in main()");
    //unic.saveFile("update",wname,e.message + " => main() failed");
  }
}

main();
