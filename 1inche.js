const gasPoly = require("./gasPoly.js");
const alchemy = require("alchemy-sdk");
const axios = require("axios");
const utils = require("./utils.js");
const unic = require("./unicache.js");
require("dotenv").config();
var BigNumber = require("big-number");
const chain = require("./chain.js");
const wall = require("./wallet.js");
const aave = require("./aave.js");
const gas = require("./gasPoly.js");
const erc20 = require("./erc20.js");
const maps = require("./maps.js");
const quote = require("./quote.js");
const web = require("./web3.js");
const web3 = web.web3;

async function resolveTransaction(alc, tx) {
  const start = parseInt(Date.now() / 1000);
  let now = parseInt(Date.now() / 1000);
  const TIMEOUT = 300;
  const SLEEP = 1;
  let status = false;
  while (start + TIMEOUT > now) {
    // console.log("h1");
    try {
      await alc.core.getTransactionReceipt(tx).then((tx) => {
        if (!tx) {
          console.log("Pending or Unknown Transaction");
        } else if (tx.status === 1) {
          console.log("Transaction was successful!");
          status = true;
          //console.log("h8 status = ",status);
        } else {
          console.log("Transaction failed!");
          throw new Error(
            "Transaction failed with status=" + tx.status + " tx=" + tx
          );
        }
        // console.log("h3 status = ",status);
      });
      // console.log("h4 status = ",status);
    } catch (e) {
      console.log(e.message, " in resolveTransaction()");
      throw new Error(e.message + " => resolveTransaction() failed");
    }
    // console.log("h5 status = ",status);
    if (status) {
      // console.log("h9 returning status = ",status);
      return true;
    }
    console.log("Sleeping ...");
    await utils.sleep(SLEEP);
    now = parseInt(Date.now() / 1000);
  }
  throw new Error("Transaction timed out => resolveTransaction() failed");
}

async function swapWithQuote(response, fromToken, amount, walletAddress) {
  try {
    unic.saveFile(
      "trade",
      "1inch.swapWithQuote()" + fromToken + " " + amount + " " + walletAddress
    );
    console.log(
      "swapWithQuote",
      response.data,
      fromToken,
      amount,
      walletAddress
    );
    let data;
    let provider = web.getEthersProvider(web3.chain);
    let alc = web.getEthersAlchemy(web3.chain);
    console.log("provider=", provider);
    let signer = provider.getSigner();
    if (response.data) {
      data = response.data;
      let gasPrice = await alc.core.getGasPrice();
      console.log("alchemy gasPrice=", gasPrice.toString());
      data.tx.gasPrice = gasPrice;
      if (web3.chain == "arb") {
        data.tx.type = 2;
        data.tx.maxFeePerGas = data.tx.gasPrice;
        let gas = data.tx.gas;
        delete data.tx.gas;
        data.tx.gasLimit = gas;
        delete data.tx.gasPrice;
      } else if (web3.chain == "poly") {
        data.tx.type = 2;
        let priorityFee = await gasPoly.getGas();
        data.tx.maxPriorityFeePerGas = priorityFee;
        data.tx.maxFeePerGas = data.tx.gasPrice.toString();
        let gas = data.tx.gas;
        delete data.tx.gas;
        data.tx.gasLimit = gas;
        delete data.tx.gasPrice;
      } else if (web3.chain == "op") {
        data.tx.gasLimit = data.tx.gas;
        delete data.tx.gas;
      }
      let w = web.getEthersWallet(web3.chain);
      data.tx.nonce = await alc.core.getTransactionCount(w.getAddress());
      data.tx.chainId = chain.chainId(web3.chain);
      let v = alchemy.Utils.parseEther(
        Math.floor(
          parseInt(
            BigNumber(data.tx.value)
              .div(BigNumber(10).pow(18 - 6))
              .toString()
          )
        ) /
          1000000 +
          ""
      );
      data.tx.value = v;
      console.log("value=", v);
      //console.log(data);
      console.log("data.tx=", data.tx);
      console.log(
        "1inche.swapWithQuote sending Transaction",
        data.tx,
        web3.chain
      );
      //      tx = await web3.obj.eth.sendTransaction(data.tx);
      //      tx = await provider.send('eth_sendTransaction', [data.tx])
      //      tx = await signer.sendTransaction(data.tx);
      console.log("calling signTransaction");
      let raw = await w.signTransaction(data.tx);
      console.log("raw=", raw);
      let a = web.getEthersAlchemy(web3.chain);
      let tx = await a.core.sendTransaction(raw);
      console.log("swapWithQuote transaction :", tx);

      await resolveTransaction(alc, tx.hash);
      return data.toTokenAmount;
    }
  } catch (e) {
    unic.saveFile("trade", "Error in 1inche.swapWithQuote() " + e.message);
    throw new Error(e.message + " => swapWithQuote() failed");
  }
}

module.exports = Object.assign({
  swapWithQuote,
});
