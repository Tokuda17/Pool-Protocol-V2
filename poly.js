function isStablecoin(sym) {
  return ["USDC", "USDT"].includes(sym.toUpperCase());
}

function isNativeEquivalent(sym) {
  return ["MATIC", "WMATIC"].includes(sym.toUpperCase());
}

function isNative(sym) {
  return ["MATIC"].includes(sym.toUpperCase());
}

module.exports = Object.assign({
  isNative,
  isNativeEquivalent,
  isStablecoin,
});
