const pool = require("./poolOp.js");
const wall = require("./wallet.js");

async function main() {
  const wname = "lance";
  let wallet = await wall.init(wname, "poly");
  await pool.calculate(wname, wallet.address, true);
}

main();
