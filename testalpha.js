const alpha = require("./alpha.js");
const wall = require("./wallet.js");

function multireturn() {
  const pos = { a: 1, b: 2, z: 3 };
  return pos;
}
async function main() {
  try {
    var wname = "default";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    let wallet = await wall.init(wname, "op");
    let ids = await alpha.getPositions(wallet.address);
    const { a, b, c } = multireturn();
    console.log("returned", a, b, c);
    console.log(ids);
  } catch (e) {
    console.log(e.message);
  }
}

main();
