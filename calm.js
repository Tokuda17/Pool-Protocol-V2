const pool = require("./poolMulti.js");
const portfolio = require("./portfolio.js");

async function main() {
  let port = portfolio.get();
  port.email = false;
  console.log("port=", port);
  let pos = await pool.calculate(port, false);
}

main();
