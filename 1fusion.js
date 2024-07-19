//import {FusionSDK, NetworkEnum, QuoteParams} from '@1inch/fusion-sdk'
const fusion = require("@1inch/fusion-sdk");
const maps = require("./maps.js");
const unic = require("./unicache.js");
const utils = require("./utils.js");
const BigNumber = require("big-number");
const web = require("./web3.js");
web3 = web.web3;

function findOrder(orders, orderHash) {
  for (let i = 0; i < orders.items.length; i++) {
    if (orderHash == orders.items[i].orderHash) return orders.items[i];
  }
  throw new Error("Order " + orderHash + " not found => findOrder() failed");
}

async function printOrder(orderHash, walletAddress) {
  let sdk = web.getFusion(ch);
  let orders = await sdk.getOrdersByMaker({
    page: 1,
    limit: 50,
    address: walletAddress,
  });
  console.log("orders=", orders);
  let order = findOrder(orders, orderHash);
  console.log("order.fills=", order.fills);
}

async function monitorOrder(ch, orderHash, amount, walletAddress) {
  let sdk = web.getFusion(ch);
  const TIMEOUT = 181;
  const SLEEP = 1;
  const start = parseInt(Date.now() / 1000);
  let now = parseInt(Date.now() / 1000);
  let order;
  while (start + TIMEOUT > now) {
    let orders = await sdk.getOrdersByMaker({
      page: 1,
      limit: 5,
      address: walletAddress,
    });
    console.log("orders=", orders);
    order = findOrder(orders, orderHash);
    if (order.status == "filled") break;
    console.log("Sleeping .. elapsed=", now - start);
    await utils.sleep(SLEEP);
    now = parseInt(Date.now() / 1000);
  }
  if (order.status == "filled") {
    console.log("Order fully executed");
    return amount;
  } else if (order.fills.length > 0) {
    console.log("Order partially executed");
    return true;
  } else {
    console.log("Order not executed");
    return false;
  }
}

/*
Use orderHash to check if order was filled

place= {
  order: {
    salt: '45393745658702857851771123486834264472855496253510405582178360459108928275099',
    makerAsset: '0x4200000000000000000000000000000000000006',
    takerAsset: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
    maker: '0x0ffeb87106910eefc69c1902f411b431ffc424ff',
    receiver: '0x0000000000000000000000000000000000000000',
    allowedSender: '0xd89adc20c400b6c45086a7f6ab2dca19745b89c2',
    makingAmount: '1070000000000000000',
    takingAmount: '1966066347',
    offsets: '970558080243398695134547109586957793750899628853613079895592438595584',
    interactions: '0x63592c2b00000000000000000000000000000000000000000000000000000000645bf3ea000600c5e600000000f5ab9bf279284fb8e3de1c3bf0b0b4a6fb0bb53800000000c6c7565644ea1893ad29182f7b6961aab7edfed000000000000000000000000000000000000000000000000000000000f38fbc3f7484a28f8d6150b0f296b9d68c8bd9e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f486570051'
  },
  signature: '0xa3ef6ca0a9e9277048a3864f3f599762aa3eef6b53c03e1b3a43972c502535e9109e1ab1f9939be6dadef188c568f41567aa8f83c37023222a225dddf88626c61b',
  quoteId: '41d41878-870b-4a42-b1df-1e562eabe007',
  orderHash: '0x10dcd4c9607e48ce21124987c0a98de9ca589f16d2be9f5f48d2ae34aab308ac'
}

orders= {
  items: [
    {
      orderHash: '0x10dcd4c9607e48ce21124987c0a98de9ca589f16d2be9f5f48d2ae34aab308ac',
      signature: '0xa3ef6ca0a9e9277048a3864f3f599762aa3eef6b53c03e1b3a43972c502535e9109e1ab1f9939be6dadef188c568f41567aa8f83c37023222a225dddf88626c61b',
      deadline: '2023-05-10T19:43:38.000Z',
      auctionStartDate: '2023-05-10T19:40:06.000Z',
      auctionEndDate: '2023-05-10T19:43:06.000Z',
      order: [Object],
      remainingMakerAmount: '1070000000000000000'
    },
    {
      orderHash: '0x72fc3abd9e5322299b343ae15c5b30620bd5c12bcf80f6a1831b1d53df689205',
      signature: '0x107448f2955a153cc75dc0d528ce922e0b93309abf203278bb31f133fae954e04726c508545ee795924829bf539a6edebcd226fc193ef59489ba079aae31e6621b',
      deadline: '2023-05-10T19:42:57.000Z',
      auctionStartDate: '2023-05-10T19:40:06.000Z',
      auctionEndDate: '2023-05-10T19:43:06.000Z',
      order: [Object],
      remainingMakerAmount: '1000000000'
    }
  ],
  meta: { totalItems: 2, currentPage: 1, itemsPerPage: 2, totalPages: 1 }
}
*/

async function swap(ch, fromSym, toSym, amount, walletAddress) {
  console.log("swap", ch, fromSym, toSym, amount, walletAddress);
  const fromAddress = maps.getAddress(fromSym, ch);
  const toAddress = maps.getAddress(toSym, ch);
  const decimals = maps.getDecimals(fromSym, ch);
  const amt = BigNumber(Math.floor(amount * 1000000))
    .mult(BigNumber(10).pow(decimals - 6))
    .toString();
  let sdk = web.getFusion(ch);
  let params = {
    fromTokenAddress: fromAddress,
    toTokenAddress: toAddress,
    amount: amt,
    preset: "fast",
    walletAddress: walletAddress,
  };
  console.log("params=", params);
  let place = await sdk.placeOrder(params);

  console.log("place=", place);
  let orderHash = place.orderHash;
  unic.writeTagId("fusion", orderHash, place, ch);
  let swapAmt = await monitorOrder(ch, orderHash, amt, walletAddress);
  let result = { swapAmt: swapAmt };
  unic.writeTagId("fusion", orderHash + ".result", result, ch);
  if (swapAmt) return true;
  return false;
}
async function getQuote(ch, fromSym, toSym, amount) {
  try {
    const fromAddress = maps.getAddress(fromSym, ch);
    const toAddress = maps.getAddress(toSym, ch);
    const decimals = maps.getDecimals(fromSym, ch);
    const amt = BigNumber(Math.floor(amount * 1000000))
      .mult(BigNumber(10).pow(decimals - 6))
      .toString();
    const params = {
      fromTokenAddress: fromAddress,
      toTokenAddress: toAddress,
      amount: amt,
    };
    let sdk = web.getFusion(ch);
    console.log("params=", params);
    const quote = await sdk.getQuote(params);
    console.log("quote=", quote);
    return quote;
  } catch (e) {
    throw new Error(e.message + " => fusion.getQuote() failed");
  }
  //console.log("quote=",quote);
  //let toDecimals = maps.getDecimals(toSym,ch);
  //let toAmount = parseInt(BigNumber(quote.toTokenAmount).div(BigNumber(10).pow(toDecimals-6)).toString())/1000000;
  //console.log("toAmount=",toAmount);
  //return toAmount;
}

module.exports = Object.assign({
  getQuote,
  printOrder,
  swap,
});
