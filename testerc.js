erc20e = require("./erc20e.js");
wall = require("./wallet.js");

async function main() {
  let w = "0x4200000000000000000000000000000000000006";
  let wallet = await wall.init("lance", "op");
  let addr = "0x0fFeb87106910EEfc69c1902F411B431fFc424FF";
  let target = "0x1111111254760F7ab3F16433eea9304126DCd199";
  let c = await erc20e.getContract(w, "op");
  //console.log("c=",c);
  let a = await erc20e.allowance(c, addr, target);
  console.log("a=", a);
  let d = await erc20e.decimals(c);
  console.log("d=", d);
  let s = await erc20e.symbol(c);
  console.log("s=", s);
  let b = await erc20e.balanceOf(c, addr);
  console.log("b=", b);
  let sb = await wall.getSpendableBalancee(addr, "op");
  console.log("sb=", sb);
}

main();
