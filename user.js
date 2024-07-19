const multi = require("./userMulti.js");
const uOp = require("./userOp.js");
const uAvax = require("./userAvax.js");
const uPoly = require("./userPoly.js");
const web = require("./web3.js");
const web3 = web.web3;

function getInit(wname) {
  let ch = web3.chain;
  console.log("getInit chain=", ch);
  if (ch == "op") return uOp.getInit(wname);
  else if (ch == "avax") return uAvax.getInit(wname);
  else if (ch == "poly") return uPoly.getInit(wname);
  else throw new Error("Unrecognized chain " + ch + " in user.getInit()");
}

function getInitMulti() {
  return multi.getInit();
}

module.exports = Object.assign({
  getInitMulti,
  getInit,
});
