const pool = require("./poolOp.js");
const wall = require("./wallet.js");

async function main() {
  const wname = "lance";
  let wallet = await wall.init(wname, "op");
  await pool.calculateNetPosition(wname, wallet.address);
}

main();
