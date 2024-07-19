const alpha = require("./alpha.js");
const wall = require("./wallet.js");
factory = require("./panFactory.js");
erc20 = require("./erc20.js");

async function main() {
  try {
    var wname = "default";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    let wallet = await wall.init(wname);

    const bankAddress = "0x376d16C7dE138B01455a51dA79AD65806E9cd694";
    const amt = "8000000000000";
    const factoryContract = await factory.getFactoryContract();
    const tokenA = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
    const tokenB = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
    const lp = await factory.getPanPair(factoryContract, tokenA, tokenB);
    console.log("lp", lp);
    const lpContract = await erc20.getContract(lp);
    const tokenAContract = await erc20.getContract(tokenA);
    let allow = await erc20.allowance(
      tokenAContract,
      "0x0fFeb87106910EEfc69c1902F411B431fFc424FF",
      bankAddress
    );
    let approve = await erc20.approve(
      tokenAContract,
      "0x0fFeb87106910EEfc69c1902F411B431fFc424FF",
      bankAddress,
      amt
    );
    console.log("allowance A", allow);

    const tokenBContract = await erc20.getContract(tokenB);
    console.log("checking token B");
    allow = await erc20.allowance(tokenBContract, wallet.address, bankAddress);
    approve = await erc20.approve(
      tokenBContract,
      wallet.address,
      bankAddress,
      amt
    );
    console.log("allowance B", allow);
  } catch (e) {
    console.log(e.message);
  }
}

main();
