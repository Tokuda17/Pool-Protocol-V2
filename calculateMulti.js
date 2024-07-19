const pool = require("./poolMulti.js");
const wall = require("./wallet.js");

async function main() {
  let port = {
    email: "multi", // tag to lookup who you should email.  false should not email
    uniswapV3: { chain: "op", wname: "lance" }, // where to create Uniswap V3 positions
    wallets: [
      { wname: "lance", chain: "op" }, // looking up wallet addresses on different chains
      { wname: "lance", chain: "poly" },
    ],
  };
  console.log("port=", port);
  let pos = await pool.calculate(port, false);
}

main();
