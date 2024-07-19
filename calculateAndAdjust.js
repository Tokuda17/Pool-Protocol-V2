const pool = require("./pool.js");
const wall = require("./wallet.js");
const user = require("./user.js");
const utils = require("./utils.js");
const nodemailer = require("./nodemailer.js");

async function main(retries = 0) {
  const maxretries = 3;
  try {
    var wname = "default";
    //nodemailer.sendMail("calculateAndAdjust","running");
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    let wallet = await wall.init(wname);
    nodemailer.init(wname);
    const init = user.getInit(wname);
    console.log("init", init);
    await pool.calculateAndAdjust(wname, wallet.address, false, init);
  } catch (e) {
    console.log(e.message);
    if (utils.shouldRetry(e.message) && retries < maxretries) {
      main(retries + 1);
    }
  }
}

main();
