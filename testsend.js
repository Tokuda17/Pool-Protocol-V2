const quote = require("./quote.js");
const inch = require("./1inch.js");
const wall = require("./wallet.js");
const erc20 = require("./erc20.js");

async function main() {
  try {
    var wname = "lance";
    const u = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
    let wallet = await wall.init(wname);
    let c = await erc20.getContract(u);
    let s = await erc20.symbol(c);
    let amt = "100000";
    console.log("transferring", s, amt);
    await erc20.transfer(
      c,
      wallet.address,
      "0x09dD576a8Fd3F4Ab59E42E5a092695D5cC81b1F3",
      amt
    );
  } catch (e) {
    console.log(e.message);
  }
}

main();
