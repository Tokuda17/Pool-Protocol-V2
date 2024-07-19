const wall = require("./wallet.js");
const erc20 = require("./erc20.js");
const aave = require("./aave.js");

async function main() {
  try {
    var wname = "lance";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    let wallet = await wall.init(wname);
    let rewards = await aave.getUserRewards(wallet.address);
    console.log("rewards", rewards);
  } catch (e) {
    console.log(e.message);
  }
}

main();
