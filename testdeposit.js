const alpha = require("./alpha.js");
const wall = require("./wallet.js");

async function main() {
  try {
    var wname = "default";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    let wallet = await wall.init(wname);
    await alpha.test(wallet.address);
    //const quote = await q.quote("pangolin");
    console.log(quote);
  } catch (e) {
    console.log(e.message);
  }
}

main();
