const addressMap = new Map();
const symbolMap = new Map();
const decimalsMap = new Map();
const priceMap = new Map();

const addressMaps = new Map();
const symbolMaps = new Map();
const decimalsMaps = new Map();

function oldInit(ch) {
  addressMap.clear();
  symbolMap.clear();
  decimalsMap.clear();
}

function init(ch) {
  if (!addressMaps.get(ch)) {
    addressMaps.set(ch, new Map());
  }
  if (!symbolMaps.get(ch)) {
    symbolMaps.set(ch, new Map());
  }
  if (!decimalsMaps.get(ch)) {
    decimalsMaps.set(ch, new Map());
  }
}

function setSymbol(addr, sym, ch) {
  let m = symbolMaps.get(ch);
  if (!m) {
    init(ch);
    m = symbolMaps.get(ch);
  }
  m.set(addr.toLowerCase(), sym.toUpperCase());
}

function getSymbol(addr, ch) {
  let m = symbolMaps.get(ch);
  if (!m) throw new Error("symbolMaps not initialized in maps.js");
  return m.get(addr.toLowerCase());
}

function setDecimals(sym, decimals, ch) {
  let m = decimalsMaps.get(ch);
  if (!m) {
    init(ch);
    m = decimalsMaps.get(ch);
  }
  m.set(sym.toUpperCase(), parseInt(decimals));
}

function getDecimals(sym, ch) {
  let m = decimalsMaps.get(ch);
  if (!m) throw new Error("decimalsMaps not initialized in maps.js");
  return m.get(sym.toUpperCase());
}

function getAddressMap(ch) {
  console.log("getAddressMap", ch, addressMaps);
  let m = addressMaps.get(ch);
  if (!m)
    throw new Error("addressMaps not initialized in maps.getAddressMap()");
  return m;
}

function setAddress(sym, addr, ch) {
  let m = addressMaps.get(ch);
  if (!m) {
    init(ch);
    m = addressMaps.get(ch);
  }
  m.set(sym.toUpperCase(), addr.toLowerCase());
}

function getAddress(sym, ch) {
  let m = addressMaps.get(ch);
  if (!m) throw new Error("addressMaps not initialized in maps.js");
  return m.get(sym.toUpperCase());
}

module.exports = Object.assign({
  oldInit,
  addressMap,
  symbolMap,
  decimalsMap,
  priceMap,
  setAddress,
  getAddress,
  setSymbol,
  getSymbol,
  setDecimals,
  getDecimals,
  getAddressMap,
});
