let err =
  "Returned error: gas price too low: 1250000 wei, use at least tx.gasPrice = 1797420 wei";

let s1 = "at least tx.gasPrice = ";
let s2 = " wei";
let p1 = err.indexOf(s1);
let p2 = err.indexOf(s2, p1);
p1 += s1.length;
let ss = err.substring(p1, p2);
let price = Math.floor(parseInt(ss) * 1.5);
console.log("substring=(" + price + ")");
