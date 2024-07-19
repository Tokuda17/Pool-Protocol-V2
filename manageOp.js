const utils = require("./utils.js");
const pool = require("./poolOp2.js");
const BigNumber = require("big-number");
const wall = require("./wallet.js");
const unic = require("./unicache.js");
const inch = require("./1inch.js");
const nodemailer = require("./nodemailer.js");

function checkPositions(pos) {
  let positions = pos.positions;
  for (let i = 0; i < positions.length; i++) {
    //console.log("Checking pos", i, positions[i]);
    if (!isNaN(positions[i].id)) {
      console.log("FOUND number id", positions[i].id);
    }
  }
  return 0;
}

function checkWallet(pos, sym) {
  let positions = pos.positions;
  for (let i = 0; i < positions.length; i++) {
    //console.log("Checking pos", i, positions[i]);
    if (positions[i].id == "wallet") {
      //console.log("Found wallet");
      if (positions[i].symbol == sym) {
        //console.log("Found sym");
        return (
          parseInt(
            BigNumber(positions[i].amount)
              .mult(100)
              .div(BigNumber(10).pow(positions[i].decimals))
              .toString()
          ) / 100
        );
      }
    }
  }
  return 0;
}

const THRESHOLD = 10000;
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const BUFFER = 2;

async function manageOp(wname, walletAddress) {
  try {
    //nodemailer.setToOption("phdlance@gmail.com,6505204994@vtext.com");
    let pos = await pool.getPositions(wname, walletAddress);
    //await pool.defundPosition(wname,walletAddress,pos);
    let c = checkWallet(pos, "ETH");
    let wc = checkWallet(pos, "WETH");
    let u = checkWallet(pos, "USDC");
    console.log("ETH", c);
    console.log("WETH", wc);
    console.log("USDC", u);
    if (c * parseFloat(pos.quote) < THRESHOLD) {
      console.log("ETH less than threshold");
      if ((c + wc) * parseFloat(pos.quote) >= 2 * THRESHOLD) {
        console.log("WETH available");
        let amt =
          (THRESHOLD - (c - BUFFER) * parseFloat(pos.quote)) /
          parseFloat(pos.quote);
        console.log("amt from weth to eth", amt);
        amt = BigNumber(Math.floor(amt * 1000000))
          .mult(BigNumber(10).pow(18 - 6))
          .toString();
        console.log("amt from weth to eth", amt);
        await inch.swap(WETH_ADDRESS, ETH_ADDRESS, amt, walletAddress);
        nodemailer.sendMail("Swapping WETH for ETH", "ETH total increasing\n");
      } else {
        let tid = await pool.defundPosition(wname, walletAddress, pos);
        if (tid) {
          nodemailer.sendMail("Defunding position", "Defunding=" + tid + "\n");
        } else {
          nodemailer.setSubjectStartOption("Pool V2: ");
          nodemailer.sendMail("Add ETH", "ETH total is " + c + "\n");
        }
      }
    } else if (wc * parseFloat(pos.quote) < THRESHOLD) {
      console.log("WETH less than threshold");
      if ((c + wc) * parseFloat(pos.quote) >= 2 * THRESHOLD) {
        console.log("ETH available");
        let amt =
          (THRESHOLD - (wc - BUFFER) * parseFloat(pos.quote)) /
          parseFloat(pos.quote);
        console.log("amt from eth to weth", amt);
        amt = BigNumber(Math.floor(amt * 1000000))
          .mult(BigNumber(10).pow(18 - 6))
          .toString();
        console.log("amt from weth to eth", amt);
        await inch.swap(ETH_ADDRESS, WETH_ADDRESS, amt, walletAddress);
        nodemailer.sendMail("Swapping ETH for WETH", "WETH total increasing\n");
      } else {
        let tid = await pool.defundPosition(wname, walletAddress, pos);
        if (tid) {
          nodemailer.sendMail("Defunding position", "Defunding=" + tid + "\n");
        } else {
          nodemailer.setSubjectStartOption("Pool V2: ");
          nodemailer.sendMail("Add WETH", "WETH total is " + wc + "\n");
        }
      }
    } else if (u < THRESHOLD) {
      let tid = await pool.defundPosition(wname, walletAddress, pos);
      if (tid) {
        nodemailer.sendMail("Defunding position", "Defunding=" + tid + "\n");
      } else nodemailer.sendMail("Add USDC", "USDC total is " + u + "\n");
    }
    checkPositions(pos);
  } catch (e) {
    console.log(e.message, " in main()");
  }
}

async function main() {
  const wname = "lance";
  let wallet = await wall.init(wname, "op");
  await manageOp(wname, wallet.address);
}

main();
