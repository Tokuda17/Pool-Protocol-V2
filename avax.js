function isNativeEquivalent(sym) {
  return ["WAVAX", "AVAX"].includes(sym.toUpperCase());
}

function isNative(sym) {
  return ["AVAX"].includes(sym.toUpperCase());
}

function isStablecoin(sym) {
  sym = sym.toUpperCase();
  console.log("is avax stablecoin");
  console.log(sym);
  return ["USDC", "USDT", "USDC.E", "DAI", "USDT.E", "DAI.E"].includes(sym);
}

module.exports = Object.assign({
  isNative,
  isNativeEquivalent,
  isStablecoin,
});
