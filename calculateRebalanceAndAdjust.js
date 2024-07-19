const pool = require("./pool.js");
const user = require("./userAvax.js");
const wall = require("./wallet.js");
const utils = require("./utils.js");
const nodemailer = require("./nodemailer.js");

async function main(retries = 0) {
  const maxretries = 5;
  try {
    var wname = "default";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    let wallet = await wall.init(wname);
    nodemailer.init(wname);
    const init = user.getInit(wname);
    await pool.calculateRebalanceAndAdjust(wname, wallet.address, false, init);
  } catch (e) {
    console.log(e.message);
    if ((await utils.shouldRetry(e.message)) && retries < maxretries) {
      await utils.sleep(5);
      main(retries + 1);
    }
  }
}

main();
