function getInit(wname) {
  if (wname == "lance") {
    init = {
      timestamp: 1679372917,
      netValue: -87883,
      collateral: 2158000, //
    };
    /*
    init = {   
      timestamp: 1678094030,
      netValue:   -80819.07016599,
      collateral: 1660000, // 1.5 * [(Alpha net position) + (total outside position)/2.5]
    };
    */
  } else {
    init = {
      timestamp: 1676099813,
      netValue: 30.53561756,
      collateral: 7600,
    };
  }
  return init;
}

module.exports = Object.assign({
  getInit,
});
