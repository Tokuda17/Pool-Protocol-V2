const axios = require("axios");

async function getGas() {
  try {
    const url = "https://gasstation-mainnet.matic.network/v2";
    const response = await axios.get(url);
    //console.log(response.data);
    let priorityFee = Math.floor(
      1000000000 * response.data.fast.maxPriorityFee
    );
    //console.log("pfee=",priorityFee);
    return priorityFee;
  } catch (e) {
    console.log("Could not getGas() => gasPoly.getGas() failed");
    throw new Error("Could not getGas() => gasPoly.getGas() failed");
  }
}

module.exports = Object.assign({
  getGas,
});
