const axios = require("axios");

async function getGas() {
  let gasPrice = 100000000;
  try {
    const url =
      "https://arb-mainnet.g.alchemy.com/v2/-aIjTJiAjkaQVE7aJio0ew42h0b39iZf";
    const response = await axios.post(url, {
      id: 1,
      jsonrpc: "2.0",
      method: "eth_gasPrice",
    });
    if (response && response.data && response.data.result) {
      console.log("result=", response);
      gasPrice = parseInt(response.data.result, 16);
      //      if (gasPrice <= 100000000)
      //        gasPrice = 100000000;
    }
    console.log("Gas Price=", gasPrice);
    return gasPrice;
  } catch (e) {
    console.log(e.message + " => gasArb.getGas() failed");
    return gasPrice;
  }
}

getGas();

module.exports = Object.assign({
  getGas,
});
