const BigNumber = require("big-number");
const web = require("./web3.js");
const web3 = web.web3;

function checkWallet(positions, sym, chin = false) {
  let ch = web3.chain;
  if (chin) ch = chin;
  for (let i = 0; i < positions.length; i++) {
    //console.log("Checking pos", i, positions[i]);
    if (positions[i].id == "wallet" && positions[i].chain == ch) {
      //console.log("Found wallet");
      if (positions[i].symbol.toUpperCase() == sym.toUpperCase()) {
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

function sleep(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

function parseGas(err) {
  let s1 = "at least tx.gasPrice = ";
  let s2 = " wei";
  let p1 = err.indexOf(s1);
  let p2 = err.indexOf(s2, p1);
  p1 += s1.length;
  let ss = err.substring(p1, p2);
  let price = parseInt(ss);
  return price;
}

function shouldRetry(msg) {
  if (msg.search("write EPROTO 8159035712") >= 0) return 1;
  else if (msg.search("429") >= 0)
    // alchemy rate limit error code
    return 1;
  else if (msg.search("read ECONNRESET") >= 0) return 1;
  else if (
    msg.search("Request failed with status code 400 getQuote failed") >= 0
  )
    return 1;
  else if (msg.search("Bad WETH wallet value") >= 0) return 1;
  else if (msg.search("erc20.balanceOf failed") >= 0) return 1;
  else if (msg.search("Request failed with status code 524") >= 0) return 1;
  else if (msg.search("Returned error: execution aborted") >= 0) return 1;
  else if (msg.search("Request failed with status code 503") >= 0) return 1;
  else if (msg.search("Request failed with status code 502") >= 0) return 1;
  else if (msg.search("Returned error: we can't execute this request") >= 0)
    return 1;
  else if (msg.search("Failed to check for transaction receipt") >= 0) return 1;
  else if (msg.search("connect ETIMEDOUT") >= 0) return 1;
  else if (msg.search("Request failed with status code 500") >= 0) return 1;
  else if (msg.search("getSwapQuote failed to execute") >= 0) return 1;
  else if (msg.search("nonce too low") >= 0) return 1;
  else if (msg.search("we can't execute this request") >= 0) return 1;
  else if (msg.search("Invalid JSON RPC response") >= 0) return 1;
  else if (msg.search("missing revert data in call exception") >= 0) return 1;
  else if (msg.search("Transaction has been reverted") >= 0) return 1;
  else if (msg.search("swap() failed") >= 0) return 1;
  else return 0;
}

module.exports = Object.assign({
  sleep,
  parseGas,
  checkWallet,
  shouldRetry,
});
