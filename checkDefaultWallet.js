const utils = require("./utils.js");
const wall = require("./wallet.js");
const nodemailer = require("./nodemailer.js");
let BigNumber = require("big-number");
const web = require("./web3.js");
let web3 = web.web3;

const lanceAddress = "0x0fFeb87106910EEfc69c1902F411B431fFc424FF";
const defaultAddress = "0x09dD576a8Fd3F4Ab59E42E5a092695D5cC81b1F3";

/* HOW TO SEND ETHEREUM
web3.eth.sendTransaction({from: acct1, to:acct2, value: web3.toWei(1, 'ether'), gasLimit: 21000, gasPrice: 20000000000})
*/

async function main(retries = 0) {
  const maxretries = 5;
  try {
    var wname = "lance";
    let wallet = await wall.init(wname);
    nodemailer.init(wname);
    nodemailer.setSubjectStartOption("ACTION REQUIRED: ");
    let def = await wall.getBalance(defaultAddress);
    def = Math.floor(BigNumber(def).div(BigNumber(10).pow(15))) / 1000;
    let lan = await wall.getBalance(lanceAddress);
    lan = Math.floor(BigNumber(lan).div(BigNumber(10).pow(15))) / 1000;
    console.log("def=", def, "lan=", lan);
    let transfer = 0;
    if (def < 1) {
      if (lan > 3 - def + 0.5) {
        transfer = 3 - def;
      } else if (lan > 1) {
        transfer = lan - 0.5;
      }
    }
    if (transfer > 0) {
      transfer = BigNumber(Math.floor(transfer * 1000))
        .mult(BigNumber(10).pow(15))
        .toString();
      console.log("transfer=", transfer);
      await web3.obj.eth.sendTransaction({
        from: lanceAddress,
        to: defaultAddress,
        value: transfer,
        gasLimit: 21000,
        gasPrice: 25000000000,
      });
    }
  } catch (e) {
    console.log(e.message);
    if ((await utils.shouldRetry(e.message)) && retries < maxretries) {
      await utils.sleep(5);
      main(retries + 1);
    }
  }
}

main();
