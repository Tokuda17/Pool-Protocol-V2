const sol = require("./solend.js");

async function main() {
  try {
    const walletAddress = "34YcosnBuCDvBKRNGXsxWiobivi2Vg1FDwJKpZaTGTvJ";
    await sol.calculateNetPosition(walletAddress);
  } catch (e) {
    console.log(e.message);
  }
}

main();
