//getWalletFro; //const alpha = require("./alpha.js");
const wall = require("./wallet.js");
const aave = require("./aave.js");
const pool = require("./pool.js");
//const q = require("./quote.js");

/*

adjustDebt(from,to,amt)
getWalletFrom
if (walletFrom > amt) // within threshold
  amtTo=swap(from,to,amt)
repay(amtTo);

*/
async function main() {
  try {
    var wname = "default";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    let wallet = await wall.init(wname);
    //await nodemailer.init(wname);
    //  await calculateAndAdjust(wname, wallet.address, false);
    await pool.calculateNetPosition(wname, wallet.address);
    //await adjustDebt("USDC", 25.7, "WAVAX", wallet.address);
    //const bankContract = await alpha.getBankContract();
    await pool.adjustPosition(
      wallet.address,
      "12121",
      "USDC",
      "WAVAX",
      "USDC.e",
      "AVAX"
    );
    //console.log (quote);
  } catch (e) {
    console.log(e.message);
  }
}

main();
