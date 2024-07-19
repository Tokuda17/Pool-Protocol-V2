function isStablecoin(sym) {
  return ["USDC", "USDT"].includes(sym.toUpperCase());
}

function isNativeEquivalent(sym) {
  return ["ETH", "WETH"].includes(sym.toUpperCase());
}

function isNative(sym) {
  return ["ETH"].includes(sym.toUpperCase());
}

module.exports = Object.assign({
  isNative,
  isNativeEquivalent,
  isStablecoin,
});
