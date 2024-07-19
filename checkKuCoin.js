const utils = require("./utils.js");
const pool = require("./pool.js");
const wall = require("./wallet.js");
const kucoin = require("./kucoin.js");
const nodemailer = require("./nodemailer.js");

async function main(retries = 0) {
  const maxretries = 5;
  try {
    var wname = "lance";
    let wallet = await wall.init(wname);
    nodemailer.init(wname);
    nodemailer.setSubjectStartOption("ACTION REQUIRED: ");
    await kucoin.init();
    const avax = await kucoin.getPosition("AVAX");
    const usdc = await kucoin.getPosition("USDC");
    console.log("AVAX", avax, "USDC", usdc);
    let subject;
    let body;
    if (usdc < 10000) {
      subject = "Deposit USDC in KuCoin";
      body =
        "You have $" + Math.floor(usdc) + " and you need at least $10,000\n";
      nodemailer.sendMail(subject, body);
    } else if (avax < 500) {
      subject = "Deposit AVAX in KuCoin";
      body =
        "You have " + Math.floor(avax) + " and you need at least 500 AVAX\n";
      nodemailer.sendMail(subject, body);
    }
  } catch (e) {
    console.log(e.message);
    if ((await utils.shouldRetry(e.message)) && retries < maxretries) {
      await utils.sleep(5);
      main(retries + 1);
    }
  }
}

main();
