require("dotenv").config();
const fs = require("fs");
const web = require("./web3.js");
const utils = require("./utils.js");
const axios = require("axios");
const pan = require("./pan.js");
const erc20 = require("./erc20.js");
var BigNumber = require("big-number");
const factory = require("./panFactory.js");
const maps = require("./maps.js");
const quote = require("./quote.js");

const web3 = web.web3;
const ALPHA_API_URL = process.env.ALPHA_API_URL;

panChefAddress = "0xa67CF61b0b9BC39c6df04095A118e53BFb9303c7";
panAddress = "0x966bbec3ac35452133B5c236b4139C07b1e2c9b1";

const bankAddressMap = new Map([
  ["avax", "0x376d16C7dE138B01455a51dA79AD65806E9cd694"],
  ["op", "0xFFa51a5EC855f8e38Dd867Ba503c454d8BBC5aB9"],
]);

const bankABI = require("./ABI/HomoraBank.json");
const chefABI = require("./ABI/WMiniChefV2PNG.json");
const panABI = require("./ABI/PangolinSpellV2.json");

let MAX_RETRIES = 5;
const path =
  "/Users/phdlance/Google Drive/My Documents/Finance/Crypto/DeFi Project/lance/alpha/";

//*********************************************************************
// alpha bank contract and methods
//*********************************************************************

function getBankContract() {
  console.log("web3.chain", bankAddressMap.get(web3.chain));
  const bankContract = new web3.obj.eth.Contract(
    bankABI,
    bankAddressMap.get(web3.chain)
  );
  return bankContract;
}

// deposit into Alpha bank
// xxx need to check all the params such as gas
async function bankDeposit(
  bankContract,
  walletAddress,
  token_a,
  amount_a_in,
  amount_a_borrow,
  min_amount_a,
  token_b,
  amount_b_in,
  amount_b_borrow,
  min_amount_b,
  amount_lp_in,
  amount_lp_borrow,
  pool_id
) {
  try {
    console.log(`token a: ${token_a}`);
    console.log(`token b: ${token_b}`);
    console.log(`amt a: ${amount_a_in}`);
    console.log(`amt b: ${amount_b_in}`);
    console.log(`min amt a: ${min_amount_a}`);
    console.log(`min amt b: ${min_amount_b}`);
    console.log(`amount_lp_in: ${amount_lp_in}`);
    console.log(`borrow A: ${amount_a_borrow}`);
    console.log(`borrow B: ${amount_b_borrow}`);

    console.log("Getting Deposit Data");
    let native = "0";
    // if (
    //   token_a == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ||
    //   token_a.toUpperCase() ==
    //     "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7".toUpperCase()
    // ) {
    //   native = amount_a_in;
    //   amount_a_in = "0";
    // }
    // if (
    //   token_b == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ||
    //   token_b.toUpperCase() ==
    //     "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7".toUpperCase()
    // ) {
    //   native = amount_b_in;
    //   amount_b_in = "0";
    // }
    console.log(native);
    if (BigNumber(amount_lp_in).gt(0)) {
      await approveLP(token_a, token_b, amount_lp_in, walletAddress);
    }
    const panContract = await getPanContract();
    const data = await getDepositData(
      panContract,
      token_a,
      token_b,
      amount_a_in,
      amount_b_in,
      amount_lp_in,
      amount_a_borrow,
      amount_b_borrow,
      min_amount_a,
      min_amount_b,
      pool_id
    );

    // console.log(
    //   token_a,
    //   amount_a_in,
    //   amount_a_borrow,
    //   min_amount_a,
    //   token_b,
    //   amount_b_in,
    //   amount_b_borrow,
    //   min_amount_b,
    //   amount_lp_in,
    //   amount_lp_borrow,
    //   pool_id
    // );

    console.log(data);
    //throw Error("pass");
    const tx = await bankContract.methods
      .execute(0, panAddress, data)
      .send({ from: walletAddress, gas: 2000000 });
    console.log("Success");
    return tx;
  } catch (e) {
    utils.sleep(5);
    throw new Error(e.message + " => bankDeposit failed");
  }
}

async function bankWithdraw(
  wname,
  bankContract,
  id,
  walletAddress,
  retries = 0
) {
  try {
    const panContract = await getPanContract();
    console.log("Getting Withdraw Data");
    const info = await bankGetPositionInfo(bankContract, id);
    const debt = await getPositionDebtsById(id);
    const amtLPTake = BigNumber(info.collateralSize).toString();
    //   console.log(debt);
    let token_a;
    let amtARepay;
    let token_b;
    let amtBRepay;
    if (debt == null) {
      token_a = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
      amtARepay = 0;
      token_b = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
      amtBRepay = 0;
    } else {
      token_a = debt[0].token;
      amtARepay = BigNumber(2).pow(256).minus(1).toString();
      token_b = debt[1].token;
      amtBRepay = BigNumber(2).pow(256).minus(1).toString();
    }
    const data = await getWithdrawData(
      panContract,
      amtARepay,
      0,
      0,
      token_a,
      amtARepay,
      0,
      token_b,
      amtBRepay,
      0
    );
    console.log("Withdrawing from Bank");
    await bankContract.methods
      .execute(id, panAddress, data)
      .send({ from: walletAddress, gas: "5000000" });
    positionRemoved(wname, id);
  } catch (e) {
    if (retries < MAX_RETRIES && utils.shouldRetry(e.message)) {
      retries++;
      await utils.sleep(3 ** retries);
      return await bankWithdraw(
        wname,
        bankContract,
        id,
        walletAddress,
        retries
      );
    }

    console.log(e.message);
    throw new Error(e.message + " => bankWithdraw failed");
  }
  console.log("Success");
}

async function bankNextPositionId(bankContract, walletAddress) {
  const tx = await bankContract.methods
    .nextPositionId()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => bankNextPositionId failed");
    });
  return tx;
}

async function bankGetPositionInfo(bankContract, positionId) {
  //console.log("inside getPositionInfo");
  const tx = await bankContract.methods
    .getPositionInfo(positionId)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => bankGetPositionInfo failed");
    });
  return tx;
}

async function borrowBalanceCurrent(
  bankContract,
  ID,
  borrowToken,
  walletAddress
) {
  try {
    const balance = await bankContract.methods
      .borrowBalanceCurrent(ID, borrowToken)
      .call();
    return balance;
  } catch (e) {
    console.log("borrowBalanceCurrentFailed");
    throw new Error(e.message + " => borrowBalanceCurrent Failed");
  }
}

function getClaimThreshold(wname) {
  var threshold = 100;
  if (wname == "lance") threshold = 10000;
  return threshold;
}

async function claimRewards(wname, walletAddress, rewards) {
  console.log("rewards", rewards);
  const bankContract = await getBankContract();
  const spellContract = await getSpellContract();
  const threshold = getClaimThreshold(wname);
  var claimed = false;
  for (let i = 0; i < rewards.length; i++) {
    if (rewards[i].reward > threshold) {
      await claimReward(
        bankContract,
        spellContract,
        rewards[i].poolId,
        walletAddress
      );
      claimed = true;
    }
  }
  //console.log("claimed",claimed);
  return claimed;
}

//*********************************************************************
// pangolin contract and methods
//*********************************************************************

async function getPanContract() {
  const panContract = await new web3.obj.eth.Contract(panABI, panAddress);
  return panContract;
}

async function getDepositData(
  spellContract,
  token_a,
  token_b,
  amount_a_in,
  amount_b_in,
  amount_lp_in,
  aBorrow,
  bBorrow,
  minA,
  minB,
  pool_id
) {
  try {
    console.log("Calling panContract");
    const data = await spellContract.methods
      .addLiquidityWMiniChef(
        token_a,
        token_b,
        {
          amtAUser: amount_a_in,
          amtBUser: amount_b_in,
          amtLPUser: amount_lp_in,
          amtABorrow: aBorrow,
          amtBBorrow: bBorrow,
          amtLPBorrow: 0,
          amtAMin: minA, //Math.floor(BigNumber(aBorrow).mult(95).div(100)).toString(),
          amtBMin: minB, //Math.floor(BigNumber(bBorrow).mult(995).div(1000)).toString(),
        },
        pool_id
      )
      .encodeABI();
    console.log("Called panContract");
    // console.log(data);
    return data;
  } catch (e) {
    console.log("getData Error: ", e.message);
    throw new Error(e.message + " => getData failed");
  }
}

// private
async function getWithdrawData(
  panContract,
  amtLPTake,
  amtLPWithdraw,
  amtLPRepay,
  token_a,
  amtARepay,
  amtAMin,
  token_b,
  amtBRepay,
  amtBMin
) {
  try {
    console.log("getting withdraw data");
    // console.log(
    //   token_a,
    //   token_b,
    //   amtLPTake,
    //   amtLPWithdraw,
    //   amtARepay,
    //   amtBRepay,
    //   amtAMin,
    //   amtBMin
    // );
    const data = await panContract.methods
      .removeLiquidityWMiniChef(token_a, token_b, {
        amtLPTake: amtLPTake, //Should be all
        amtLPWithdraw: amtLPWithdraw, //should be all
        amtARepay: amtARepay,
        amtBRepay: amtBRepay,
        amtLPRepay: amtLPRepay,
        amtAMin: amtAMin,
        amtBMin: amtBMin,
      })
      .encodeABI();
    return data;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => getWithdrawData failed");
  }
}

async function test(wname) {
  const bankContract = await getBankContract();
  const spellContract = await getSpellContract();
  const data = await getData(
    spellContract,
    "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664",
    "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
    0,
    0,
    15844725987,
    9
  );
  console.log(data);
  tx = await bankDeposit(bankContract, data);
  console.log(tx);
}

// private
async function getUnderlyingAddress(token, id) {
  const chefContract = new web3.obj.eth.Contract(chefABI, token);
  const addr = await chefContract.methods
    .getUnderlyingToken(id)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => getUnderlyingAddress failed");
    });
  return addr;
}

async function getAvaxLiquidity(poolContract, lp) {
  const amt = await poolContract.methods.getAvaxLiquidity(lp).call();
  console.log(amt);
  return amt;
}

//*********************************************************************
// Section for function calls that we write to process Alpha data
//*********************************************************************

// private
async function getPositionDebtsById(positionId) {
  try {
    const bankAddress = bankAddressMap.get(web3.chain);
    console.log("getPositionDebtsById bankAddress=", bankAddress);
    const bankContract = new web3.obj.eth.Contract(bankABI, bankAddress);
    //console.log("bankContract",bankContract);
    const tx = await bankContract.methods
      .getPositionDebts(positionId)
      .call()
      .catch((e) => {
        console.log("getPositionDebtsById Error: ", e.message);
        throw new Error(e.message + " => bankContract.getPositionDebts failed");
      });
    mydebts = [];
    //console.log ("getPositionDebtsById tx=",tx);
    tokens = tx.tokens;
    //console.log ("tx.tokens=",tokens);
    debts = tx.debts;
    //console.log ("getPositionDebtsById tx.debts=",debts);
    //console.log ("length=",tokens.length);
    for (let i = 0; i < tokens.length; i++) {
      const c = await erc20.getContract(tokens[i]);
      const d = await erc20.decimals(c, tokens[i]);
      const sym = await erc20.symbol(c, tokens[i]);
      maps.addressMap.set(sym, tokens[i]);
      maps.symbolMap.set(tokens[i], sym);
      maps.decimalsMap.set(sym, d);
      mydebts.push({
        id: positionId,
        symbol: sym,
        token: tokens[i],
        amount: BigNumber(debts[i]).mult(-1).toString(),
        decimals: d,
      });
    }
    if (mydebts.length == 0) mydebts = null;
    return mydebts;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => getPositionDebtsById failed");
  }
}

function positionRemoved(wname, id) {
  console.log("removing position", id);
  fs.writeFile(path + wname + "/" + id, "", (err) => {
    if (err) {
      console.error(err);
      throw new Error(
        "Could not remove position " +
          wname +
          " " +
          id +
          " => positionRemoved()"
      );
    }
  });
}

function getRemovedPositions(wname) {
  const dir = fs.readdirSync(path + "/" + wname);
  let ids = [];
  dir.forEach((fname) => {
    if (!isNaN(fname)) ids.push(parseInt(fname));
  });
  console.log("removed id list=", ids);
  return ids;
}

// private
// gets a list of position id's for an owner address
// xxx we should be storing the position_id's when the position
// was created.  the best would be to have the create go through
// a blockchain call and have that call store the position_id
// on the blockchain
async function getPositionIds(wname, owner) {
  try {
    console.log("entering getPositionIds: ", owner);
    const url = ALPHA_API_URL + web3.chainid + "/positions";
    console.log("owner", owner);
    console.log("getPositionIds calling " + url);
    const res = await axios.get(url);
    const data = res.data;
    //console.log("id data: ",data);
    var mypos = [];
    const removed = getRemovedPositions(wname);
    console.log("removed ids : ", removed);
    for (let i = 0; i < data.length; i++) {
      let pos = data[i];
      //console.log ("compare owner getPositionIds", i, owner,pos.owner);
      if (pos.owner.toLowerCase() == owner.toLowerCase()) {
        if (!removed.includes(pos.id)) mypos.push(pos.id);
      }
    }
    if (mypos.length == 0) {
      console.log("calling getPositionIdsFromBlockchain: ", mypos);
      //xxx      mypos = await getPositionIdsFromBlockchain(owner);
    }
    //console.log("my positions: ", mypos);
    //throw Error("forcing getPositionId to call getPositionIdsFromBlockchain");
    return mypos;
  } catch (e) {
    console.log(e.message);
    //throw Error(e.message," => getPositionIds failed");
    let mypos = await getPositionIdsFromBlockchain(owner);
    return mypos;
  }
}

function getMinPositionId() {
  if (web3.chain == "avax") return 12586;
  else if (web3.chain == "op") return 260;
  else throw new Error("getMinPositionId bad chain");
}

// gets position id's that you own from blockchain in the case when
// the alpha endpoint fails
// xxx hard coded 11790 to reduce the runtime but this is different
// for Fantom and other chains
async function getPositionIdsFromBlockchain(owner) {
  try {
    const bankContract = await getBankContract();

    console.log("Position owner=", owner);
    let nextPosId = await bankNextPositionId(bankContract, owner);
    console.log("nextPosId=", nextPosId);
    var mypos = [];
    const minPosId = getMinPositionId();
    //console.log("minPosId",minPosId);
    for (let i = --nextPosId; i >= minPosId; i--) {
      const pos = await bankGetPositionInfo(bankContract, i);
      console.log("Look at position:", i);
      console.log(
        "compare owner getPositionIdsFromBlockchain",
        i,
        owner,
        pos.owner
      );
      if (
        pos.owner.toLowerCase() == owner.toLowerCase() &&
        BigNumber(pos.collateralSize).gt(0)
      ) {
        mypos.push(i);
        console.log("Found owned position:", i);
        //console.log ("Collateral:", pos.collateralSize);
        console.log("mypos:", mypos);
      }
    }
    return mypos;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => getPositionIdsFromBlockchain failed");
  }
}

async function approveLP(tokenA, tokenB, amt, walletAddress) {
  try {
    const factoryContract = await factory.getFactoryContract();
    const lp = await factory.getPanPair(factoryContract, tokenA, tokenB);
    const lpContract = await erc20.getContract(lp);
    await erc20.approve(
      lpContract,
      walletAddress,
      bankAddressMap.get(web3.chain),
      amt
    );
    console.log("Success");
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => approveLP failed");
  }
}

async function getPositionValue(wname, bankContract, walletAddress) {
  try {
    const ids = await getPositionIds(wname, walletAddress);
    var mypos = [];
    for (let i = 0; i < ids.length; i++) {
      const info = await bankGetPositionInfo(bankContract, ids[i]);
      if (BigNumber(info.collateralSize).gt(BigNumber(500000000000))) {
        mypos.push({ id: ids[i], value: info.collateralSize });
      }
    }
    return mypos;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => getPositionValue failed");
  }
}

async function getChef(chefContract) {
  const chef = await chefContract.methods
    .chef()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => getChef failed");
    });
  return chef;
}
async function decodeId(chefContract, collateralId) {
  const decodedCollateral = await chefContract.methods
    .decodeId(collateralId)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => decodeId failed");
    });
  return decodedCollateral;
}
async function poolInfo(chefContract, pid) {
  const pInfo = await chefContract.methods
    .poolInfo(pid)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => poolInfo failed");
    });
  return pInfo;
}

function getSpellContract() {
  const spellABI = require("./ABI/PangolinSpellV2.json"); //pan = Pangolin
  spellAddress = "0x966bbec3ac35452133B5c236b4139C07b1e2c9b1";
  const spellContract = new web3.obj.eth.Contract(spellABI, spellAddress);
  return spellContract;
}

async function claimReward(bankContract, spellContract, posId, walletAddress) {
  try {
    spellAddress = "0x966bbec3ac35452133B5c236b4139C07b1e2c9b1";
    //console.log("spell contract", spellContract);
    //console.log("getting data");
    const data = await spellContract.methods
      .harvestWMiniChefRewards()
      .encodeABI();
    //console.log("data=",data);
    const tx = await bankContract.methods
      .execute(posId, spellAddress, data)
      .send({ from: walletAddress, gas: 1100000 })
      .catch(function (e) {
        console.log(e.message);
        throw new Error(e.message + " => harvestWMiniChefRewards failed");
      });
    console.log("Claiming reward for position:", posId);
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => claimReward() failed");
  }
}

async function getPendingRewards(wname, walletAddress) {
  try {
    const ids = await getPositionIds(wname, walletAddress);
    console.log("position ids", ids);

    const bankContract = await getBankContract();
    const wchefContract = await pan.getWchefContract();
    const chefAddress = await getChef(wchefContract);
    const chefContract = await pan.getChefContract(chefAddress);
    // xxx reward type is hard coded here
    const rewardQuote = await quote.oneFastQuote(maps.addressMap.get("PNG"));
    console.log("rewardQuote PNG", rewardQuote);
    var pendingRewards = [];

    var mypos = [];
    //console.log("owner id length=",ids.length);
    for (let i = 0; i < ids.length; i++) {
      pos = await bankGetPositionInfo(bankContract, ids[i]);
      pendingReward = await getPendingReward(
        wchefContract,
        chefContract,
        ids[i],
        pos,
        rewardQuote
      );
      pendingRewards = pendingRewards.concat(pendingReward);
      //console.log("PENDING REWARDS:", pendingRewards);
    }
    return pendingRewards;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => getPendingRewards() failed");
  }
}

// pos is the getBankPositionInfo from alpha
async function getPendingReward(
  wchefContract,
  chefContract,
  poolId,
  pos,
  rquote
) {
  var pendingRewards = [];
  const decodedCollateral = await decodeId(wchefContract, pos.collId);
  //console.log ("Decoded collateral:", decodedCollateral);
  const pInfo = await poolInfo(chefContract, decodedCollateral.pid);
  //console.log ("pool info:", pInfo);
  const poolAddress = await getUnderlyingAddress(pos.collToken, pos.collId);
  //console.log("collateral size ", pos.collateralSize);
  //console.log("accrewardpershare ", pInfo.accRewardPerShare);
  //console.log("pngpershare ", decodedCollateral.pngPerShare);
  const pendingReward =
    parseInt(
      BigNumber(pos.collateralSize)
        .mult(
          BigNumber(pInfo.accRewardPerShare).subtract(
            decodedCollateral.pngPerShare
          )
        )
        .div(BigNumber(10).pow(36 - 10))
        .toString()
    ) / 10000;
  console.log("PENDING REWARD", pendingReward);
  if (pendingReward > 0) {
    pendingRewards.push({
      poolId: poolId,
      reward: pendingReward,
      usd: parseFloat(pendingReward) * rquote,
    });
    console.log("PENDING rewards", pendingRewards);
  }
  return pendingRewards;
}

function getTickPrice(ticks) {
  const p = 1000000000000 / 1.0001 ** -ticks;
  return p;
}
async function getUniswapPosition(pid, posInfo) {
  const lower = posInfo.tickLower;
  const upper = posInfo.tickUpper;
  const liq = posInfo.liquidity;
  const plower = getTickPrice(lower);
  const pupper = getTickPrice(upper);
  // need to update this to use 1inch quotes
  const p = 1352;
  var vamt =
    (liq * (Math.sqrt(pupper) - Math.sqrt(p))) /
    Math.sqrt(p) /
    Math.sqrt(pupper);
  vamt = BigNumber(Math.floor(vamt)).mult(1000000).toString();
  var samt = liq * (Math.sqrt(p) - Math.sqrt(plower));
  samt = Math.floor(samt / 10 ** 6);
  console.log(
    "lower",
    lower,
    "upper",
    upper,
    "liq",
    liq,
    "plower",
    plower,
    "pupper",
    pupper,
    "price",
    p
  );
  var pos = [
    { id: pid, symbol: "ETH", decimals: 18, amount: vamt },
    { id: pid, symbol: "USDC", decimals: 6, amount: samt },
  ];
  return pos;
}

async function getPositionsOp(owner) {
  try {
    console.log("getPositionsOp");
    const url =
      "https://api.homora.alphaventuredao.io/v2/10/uniswapv3/positions?userAddress=" +
      owner;
    console.log("url", url);
    var posData = await axios.get(url);
    var positions = [];
    posData = posData.data;
    console.log("posData", posData);
    for (var pid in posData) {
      console.log(pid, posData[pid]);
      const pos = await getUniswapPosition(pid, posData[pid]);
      positions = positions.concat(pos);
    }
    return positions;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => alpha.getPositionsOp failed");
  }
}

async function getPositions(wname, owner) {
  var pos = [];
  if (web3.chain == "avax") {
    pos = await getPositionsAvax(wname, owner);
  } else if (web3.chain == "op") {
    pos = await getPositionsOp(owner);
  } else
    throw new Error(
      "unsupported chain " + web3.chain + " in alpha.getPositions()"
    );
  return pos;
}

function isStablecoin(sym) {
  //console.log("is stablecoin");
  //console.log(sym);
  return ["USDC", "USDT", "USDC.E", "DAI", "USDT.E", "DAI.E"].includes(
    sym.toUpperCase()
  );
}

// Gets a list of collateral and debt positions by owner address
// Returns and array of structures:
//   [{id: 344,token: '0x...', amount:451111},{id: 345: ...}]
// Id is the position id
// Debts are stored as negtive numbers
// For each position, there will usually be 4 structures in an
//   array: 2 for each collateral with a positive amount
//   and 2 for each debt with a negative amount
async function getPositionsAvax(wname, owner, retries = 0) {
  try {
    const ids = await getPositionIds(wname, owner);
    console.log("position ids", ids);

    var wchefContract;
    var chefAddress;
    var chefContract;
    const bankContract = await getBankContract();
    wchefContract = await pan.getWchefContract();
    chefAddress = await getChef(wchefContract);
    chefContract = await pan.getChefContract(chefAddress);
    var pendingRewards = [];
    var rewardsUsd = 0;

    var mypos = [];
    let nativeExposure = 0;
    let lastPoolAddress = 0;
    let panResult;
    let poolNativePrice = null;
    console.log("owner id length=", ids.length);
    for (let i = 0; i < ids.length; i++) {
      let pos = await getPositionDebtsById(ids[i]);
      //console.log("Getting position debts ", ids[i]);
      //console.log("Debt ", pos);
      if (pos != null) {
        //mypos.push(pos);
        mypos = mypos.concat(pos);
      }
      console.log("1");
      pos = await bankGetPositionInfo(bankContract, ids[i]);
      console.log("bankGetPositionInfo", pos);
      console.log("png address", maps.addressMap.get("PNG"));
      console.log("addressMap", maps.addressMap);
      // xxx special case rewards collection for avax
      const rquote = await quote.oneFastQuote(maps.addressMap.get("PNG"));
      const pendingReward = await getPendingReward(
        wchefContract,
        chefContract,
        ids[i],
        pos,
        rquote
      );
      if (pendingReward.length > 0) {
        rewardsUsd += pendingReward[0]["usd"];
      }
      pendingRewards = pendingRewards.concat(pendingReward);
      const poolAddress = await getUnderlyingAddress(pos.collToken, pos.collId);
      lastPoolAddress = poolAddress;
      console.log("Pool address ", poolAddress);
      // xxx special case for chain to get collateral, uniswap v3 requires a different calculation
      panResult = await pan.getPoolTokens(
        ids[i],
        poolAddress,
        pos.collateralSize
      );
      console.log("panResult=", panResult);
      let poolTokens = panResult.positions;
      let stable;
      if (isStablecoin(poolTokens[0].symbol)) stable = 0;
      else stable = 1;
      nativeExposure = BigNumber(nativeExposure)
        .add(poolTokens[stable].amount)
        .toString();
      mypos = mypos.concat(poolTokens);
      poolNativePrice = panResult.poolNativePrice;
    }
    //mypos.push({id: "rewards", pendingRewards})
    //const poolPrice = await pan.getPriceFromPool(lastPoolAddress);
    const result = {
      positions: mypos,
      rewards: pendingRewards,
      rewardsUsd: rewardsUsd,
      positionIds: ids,
      numPositions: ids.length,
      nativeExposure: nativeExposure,
      poolNativePrice: poolNativePrice,
    };
    return result;
  } catch (e) {
    if (retries < MAX_RETRIES && utils.shouldRetry(e.message)) {
      retries++;
      await utils.sleep(3 ** retries);
      return await getPositionsAvax(wname, owner, retries);
    }
    console.log(e.message);
    throw new Error(
      e.message + " retries=" + retries + " => alpha.getPositions failed"
    );
  }
}

module.exports = Object.assign({
  test,
  getClaimThreshold,
  claimRewards,
  getBankContract,
  bankGetPositionInfo,
  bankDeposit,
  bankWithdraw,
  getPositionValue,
  getPanContract,
  getPositionIds,
  getPositions,
});
