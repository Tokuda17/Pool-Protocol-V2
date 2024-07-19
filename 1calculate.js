sdk = require("@1inch/fusion-sdk");

const now = Math.floor(Date.now() / 1000);

const salt = new sdk.AuctionSalt({
  duration: 180,
  auctionStartTime: now,
  initialRateBump: 50000,
  bankFee: "0",
});

let s = salt.build();
console.log("salt=", s);

const walletAddress = "0x0fFeb87106910EEfc69c1902F411B431fFc424FF";

const order = new sdk.LimitOrder({
  makerAsset: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
  takerAsset: "0x4200000000000000000000000000000000000006",
  makingAmount: "10000000000",
  takingAmount: "5561735000000000000",
  maker: walletAddress,
});

console.log("order=", order);

const ord = order.build();

console.log("ord=", ord);

const limitOrderStruct = {
  allowedSender: "0x0000000000000000000000000000000000000000",
  interactions:
    "0x000c004e200000000000000000219ab540356cbb839cbe05303d7705faf486570009",
  maker: "0x00000000219ab540356cbb839cbe05303d7705fa",
  makerAsset: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
  makingAmount: "10000000000",
  offsets: "0",
  receiver: "0x0000000000000000000000000000000000000000",
  salt: s,
  takerAsset: "0x4200000000000000000000000000000000000006",
  takingAmount: "5561735000000000000",
};

//const calculator = sdk.AuctionCalculator.fromLimitOrderV3Struct(limitOrderStruct);
const calculator = sdk.AuctionCalculator.fromLimitOrderV3Struct(ord);
// #=> AuctionCalculator instance

const rate = calculator.calcRateBump(now);

const auctionTakingAmount = calculator.calcAuctionTakingAmount(
  "5561735000000000000",
  rate
);
console.log("auctionTakingAmount=", auctionTakingAmount);
