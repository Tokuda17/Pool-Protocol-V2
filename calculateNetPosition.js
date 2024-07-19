const user = require("./user.js");
const pool = require("./pool.js");
const utils = require("./utils.js");
const wall = require("./wallet.js");
const nodemailer = require("./nodemailer.js");

async function main(retries = 0) {
  const maxretries = 5;
  try {
    var wname = "default";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    console.log("main.1");
    const init = user.getInit(wname);
    console.log("main.2");
    let wallet = await wall.init(wname);
    console.log("main.3");
    nodemailer.init(wname);
    console.log("main.4");
    await pool.calculateNetPosition(wname, wallet.address, true, init);
  } catch (e) {
    console.log(e.message);
    if ((await utils.shouldRetry(e.message)) && retries < maxretries) {
      await utils.sleep(5);
      main(retries + 1);
    }
  }
}

main();
