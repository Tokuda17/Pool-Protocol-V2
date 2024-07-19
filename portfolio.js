let portfolio = {
  email: "multi", // tag to lookup who you should email.  false should not email
  uniswapV3: {
    chain: "op",
    wname: "lance",
    pair: {
      vsym: "WETH",
      ssym: "USDC",
      //let THRESHOLD_RATIO = 0.04; // TS_SPAN = 64
      //THRESHOLD_RATIO = 0.022; // TS_SPAN = 128  for $250K, threshold at $5500
      //THRESHOLD_RATIO = 0.018; // TS_SPAN = 256  for $250K
      span: 256,
      threshRatio: 0.018,
      spacing: 10,
      fee: 0.005,
      value: 200000,
      optRatio: 0.5,
    },
  },
  wallets: [
    { wname: "lance", chain: "op" }, // looking up wallet addresses on different chains
    { wname: "lance", chain: "poly" },
    { wname: "lance", chain: "arb", includelist: ["ETH", "USDC", "WETH"] },
    { wname: "lance", chain: "eth", includelist: [] },
  ],
  start: {
    timestamp: 1684212040,
    susd: 263802.44184700004,
    vamt: 179.77377124256608,
    collateral: 199995.74157405004,
  },
};

function get() {
  return portfolio;
}

module.exports = Object.assign({
  get,
});
