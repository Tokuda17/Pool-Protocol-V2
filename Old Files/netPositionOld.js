const Web3 = require("web3");
const axios = require("axios");
require("dotenv").config();

const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const web3 = new Web3(AVALANCHE_RPC_URL);
const wallet = web3.eth.accounts.wallet.add(PRIVATE_KEY);
const ALPHA_AVALANCHE_URL = process.env.ALPHA_AVALANCHE_URL;

//*********************************************************************
// ABI's
//*********************************************************************
const bankABI = require("../ABI/HomoraBank.json");
const panABI = require("../ABI/PangolinSpellV2.json"); //pan = Pangolin
const chefABI = require("../ABI/WMiniChefV2PNG.json");
const erc20ABI = require("../ABI/erc20.json");
const panPoolABI = require("../ABI/PangolinPool.json");
const AaveOracleABI = require("../ABI/AaveOracle.json");
const DebtTokenABI = require("../ABI/avaxDebtToken.json");
const ATokenAbi = require("../ABI/avaxAToken.json");
const aavePoolABI = require("../ABI/Pool.json");
const aavePoolAddressesProviderABI = require("../ABI/PoolAddressesProvider.json");

//*********************************************************************
// Special Addresses
//*********************************************************************
//Constant Address AVAX
const poolAddressesProviderAddress =
  "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
const aTokenAddresses = [
  "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8", //WETH
  "0x625E7708f30cA75bfd92586e17077590C60eb4cD", //USDC
];
const debtTokenAddresses = [
  "0x8619d80FB0141ba7F184CbF22fd724116D9f7ffC", //DAI
  "0xfb00AC187a8Eb5AFAE4eACE434F493Eb62672df7", //USDT
  "0x4a1c3aD6Ed28a636ee1751C69071f6be75DEb8B8", //WAVAX
  "0xFCCf3cAbbe80101232d343252614b6A3eE81C989", //USDC
];

const aaveTokenAddresses = [
  "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", //Weth
  "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", //USDC
  "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", //USDT
  "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", //DAI
  "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", //WAVAX
];

const avaxInWallet = 3;

bankAddress = "0x376d16C7dE138B01455a51dA79AD65806E9cd694";
panAddress = "0x966bbec3ac35452133B5c236b4139C07b1e2c9b1";
const aaveOarcleAddress = "0xEBd36016B3eD09D4693Ed4251c67Bd858c3c7C9C";
token_a = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"; //USDC.e
// token_b = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; //AVAX
token_b = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"; //WAVAX
//token_lp = "0xbd918Ed441767fe7924e99F6a0E0B568ac1970D9"; // lp token
amount_a_in = 0; // user's token_a provided amount
amount_b_in = "20000000000000000"; // user's token_b provided amount
amount_lp_in = 0; // # user's lp provided amount
amount_a_borrow = "20000"; // # token_a borrow amount
amount_a_borrow = 0; // # token_a borrow amount
amount_b_borrow = 0; // # token_b borrow amount
amount_lp_borrow = 0; //# LP borrow amount (always 0 since not support)
min_token_a_used = 0; //# minimum token_a used (slippage)
min_token_b_used = 0; //# minimum token_b used (slippage)
pool_id = 9; // lookup using https://api.homora.alphaventuredao.io/v2/43114/pools

//const panPoolAddress = "0xe54ca86531e17ef3616d22ca28b0d458b6c89106";

const symbolMap = new Map();
const decimalsMap = new Map();

//*********************************************************************
// aToken contract and methods
//*********************************************************************
async function getATokenContract(address) {
  const aTokenContract = await new web3.eth.Contract(ATokenAbi, address);
  return aTokenContract;
}
async function aTokenContractBalanceOf(aTokenContract) {
  const aTokenBalance = await aTokenContract.methods
    .balanceOf(wallet.address)
    .call()
    .catch((e) => console.log(e.message));
  return aTokenBalance;
}

//*********************************************************************
// debtToken contract and methods
//*********************************************************************
async function getDebtTokenContract(address) {
  const debtTokenContract = await new web3.eth.Contract(DebtTokenABI, address);
  return debtTokenContract;
}

async function debtTokenContractBalanceOf(debtTokenContract) {
  const debt = await debtTokenContract.methods
    .balanceOf(wallet.address)
    .call()
    .catch((e) => console.log(e.message));
  return debt;
}

//get underlying address of Atoken or Debt Token
async function debtTokenUnderlyingAssetAddress(tokenContract) {
  const address = await tokenContract.methods
    .UNDERLYING_ASSET_ADDRESS()
    .call()
    .catch((e) => console.log(e.message));
  return address;
}

async function debtTokenBorrowAllowance(
  debtTokenContract,
  aavePoolAddress,
  owner
) {
  const tx = await debtTokenContract.methods
    .borrowAllowance(aavePoolAddress, owner)
    .send({ from: wallet.address, gas: "400000" })
    .catch((e) => console.log(e.message));

  if (tx.status) console.log(tx.status);
}

//*********************************************************************
// alpha bank contract and methods
//*********************************************************************
function getAlphaBankContract() {
  const bankContract = new web3.eth.Contract(bankABI, bankAddress);
  return bankContract;
}

// deposit into Alpha bank
// xxx need to check all the params such as gas
async function bankDeposit(bankContract, data) {
  try {
    console.log("Calling bankContract");
    const tx = await bankContract.methods
      .execute(0, panAddress, data)
      .send({ value: 20000000000000000, from: wallet.address, gas: 1000000 })
      .catch((e) => {
        throw Error("Error " + e.message);
      });
    console.log("Called bankContract");
    return tx;
  } catch (e) {
    console.log(e.message);
  }
}

async function bankGetPositionInfo(bankContract, positionId) {
  //console.log("inside getPositionInfo");
  const tx = await bankContract.methods
    .getPositionInfo(positionId)
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  return tx;
}

//*********************************************************************
// pangolin contract and methods
//*********************************************************************
function getPanContract() {
  const panContract = new web3.eth.Contract(panABI, panAddress);
  return panContract;
}

async function getData() {
  try {
    const panContract = await getPanContract();
    console.log("Calling panContract");
    const data = await panContract.methods
      .addLiquidityWMiniChef(
        token_a,
        token_b,
        {
          amtAUser: amount_a_in,
          amtBUser: 0,
          amtLPUser: amount_lp_in,
          amtABorrow: amount_a_borrow,
          amtBBorrow: amount_b_borrow,
          amtLPBorrow: amount_lp_borrow,
          amtAMin: min_token_a_used,
          amtBMin: min_token_b_used,
        },
        pool_id
      )
      .encodeABI();
    console.log("Called panContract");
    console.log(data);
    return data;
  } catch (e) {
    console.log(e.message);
  }
}

async function getUnderlyingAddress(token, id) {
  const chefContract = new web3.eth.Contract(chefABI, token);
  const addr = await chefContract.methods
    .getUnderlyingToken(id)
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  //console.log("getUnderlyingAddress ", addr);
  return addr;
}

//*********************************************************************
// erc20 contract and methods
//*********************************************************************
function getErc20Contract(erc) {
  const contract = new web3.eth.Contract(erc20ABI, erc);
  return contract;
}

async function erc20Decimals(contract, token) {
  const decimals = await contract.methods
    .decimals()
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  //console.log("decimals=", decimals);
  return decimals;
}

async function ercBalanceOf(ercContract) {
  const balance = await ercContract.methods
    .balanceOf(wallet.address)
    .call()
    .catch((e) => console.log(e.message));
  return balance;
}

async function erc20Symbol(contract, token) {
  const symbol = await contract.methods
    .symbol()
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  //console.log("symbol=", symbol);
  return symbol;
}

// xxx this was an approve method for Alpha that is not called appropriately
async function erc20Approve(tokenContract, approveAddress, amount) {
  try {
    const tx = await tokenContract.methods
      .approve(approveAddress, amount)
      .send({ from: wallet.address, gasPrice: "100000000000", gas: "400000" })
      .catch((e) => {
        throw Error("Error depositing token allowance" + e.message);
      });

    if (tx.status) console.log(tx.status + " Approved");
  } catch (e) {
    console.log(e.message);
  }
}

//*********************************************************************
// Pangolin liquidity pool contract and methods
//*********************************************************************
function getPoolContract(pool) {
  const contract = new web3.eth.Contract(panPoolABI, pool);
  return contract;
}

async function poolToken0(contract) {
  const t0 = await contract.methods
    .token0()
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  return t0;
}
async function poolToken1(contract) {
  const t1 = await contract.methods
    .token1()
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  return t1;
}
async function poolGetReserves(contract) {
  const res = await contract.methods
    .getReserves()
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  return res;
}
async function poolTotalSupply(contract) {
  const total = await contract.methods
    .totalSupply()
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  return total;
}

//*********************************************************************
// Section for function calls that we write to process Alpha data
//*********************************************************************
async function getPositionDebtsById(positionId) {
  //console.log("inside getpositiondebts", positionId);
  const bankContract = new web3.eth.Contract(bankABI, bankAddress);
  const tx = await bankContract.methods
    .getPositionDebts(positionId)
    .call()
    .catch((e) => {
      console.log(e.message);
    });
  mydebts = [];
  //console.log ("tx=",tx);
  tokens = tx.tokens;
  //console.log ("tx.tokens=",tokens);
  debts = tx.debts;
  //console.log ("tx.debts=",debts);
  //console.log ("length=",tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    const c = await getErc20Contract(tokens[i]);
    const d = await erc20Decimals(c, tokens[i]);
    const sym = await erc20Symbol(c, tokens[i]);
    symbolMap.set(tokens[i], sym);
    decimalsMap.set(sym, d);
    mydebts.push({
      id: positionId,
      symbol: sym,
      token: tokens[i],
      amount: -debts[i],
    });
  }
  if (mydebts.length == 0) mydebts = null;
  return mydebts;
}

async function getPoolTokens(id, poolAddress, tokens) {
  const poolContract = getPoolContract(poolAddress);
  const t0 = await poolToken0(poolContract);
  const t1 = await poolToken1(poolContract);
  const res = await poolGetReserves(poolContract);
  const total = await poolTotalSupply(poolContract);
  const c0 = await getErc20Contract(t0);
  const d0 = await erc20Decimals(c0, t0);
  const c1 = await getErc20Contract(t1);
  const d1 = await erc20Decimals(c1, t1);
  const sym0 = await erc20Symbol(c0, t0);
  const sym1 = await erc20Symbol(c1, t1);
  symbolMap.set(t0, sym0);
  symbolMap.set(t1, sym1);
  decimalsMap.set(sym0, d0);
  decimalsMap.set(sym1, d1);
  const collateral = [
    {
      id: id,
      symbol: sym0,
      token: t0,
      amount: Math.trunc((tokens / total) * res._reserve0),
    },
    {
      id: id,
      symbol: sym1,
      token: t1,
      amount: Math.trunc((tokens / total) * res._reserve1),
    },
  ];
  return collateral;
}

// gets a list of position id's for an owner address
// xxx we should be storing the position_id's when the position
// was created.  the best would be to have the create go through
// a blockchain call and have that call store the position_id
// on the blockchain
async function getAlphaPositionIds(owner) {
  const res = await axios.get(ALPHA_AVALANCHE_URL);
  const data = res.data;
  var mypos = [];
  owner = owner.toLowerCase();
  for (let i = 0; i < data.length; i++) {
    let pos = data[i];
    if (pos.owner == owner) mypos.push(pos.id);
  }
  return mypos;
}

// Gets a list of collateral and debt positions by owner address
// Returns and array of structures:
//   [{id: 344,token: '0x...', amount:451111},{id: 345: ...}]
// Id is the position id
// Debts are stored as negtive numbers
// For each position, there will usually be 4 structures in an
//   array: 2 for each collateral with a positive amount
//   and 2 for each debt with a negative amount
async function getAlphaPositions(owner) {
  const ids = await getAlphaPositionIds(owner);

  const bankContract = await getAlphaBankContract(owner);
  var mypos = [];
  //console.log("owner id length=",ids.length);
  for (let i = 0; i < ids.length; i++) {
    let pos = await getPositionDebtsById(ids[i]);
    //console.log("Getting position debts ", ids[i]);
    //console.log("Debt ", pos);
    if (pos != null) {
      //mypos.push(pos);
      mypos = mypos.concat(pos);
    }
    pos = await bankGetPositionInfo(bankContract, ids[i]);
    //console.log("Getting position ", ids[i]);
    //console.log("CollToken", pos.collToken);
    const poolAddress = await getUnderlyingAddress(pos.collToken, pos.collId);
    //console.log("Pool address ", poolAddress);
    const poolTokens = await getPoolTokens(
      ids[i],
      poolAddress,
      pos.collateralSize
    );
    //console.log("poolTokens ", poolTokens);
    mypos = mypos.concat(poolTokens);
  }
  return mypos;
}

//*********************************************************************
// Section for function calls that we write to process Aave data
//*********************************************************************

//Getting aave Pool Contract
async function getAavePoolContract() {
  const poolAddressesProviderContract = await new web3.eth.Contract(
    aavePoolAddressesProviderABI,
    poolAddressesProviderAddress
  );

  const poolAddress = await poolAddressesProviderContract.methods
    .getPool()
    .call()
    .catch((e) => console.log("error getting pool contract"));
  const poolContract = await new web3.eth.Contract(aavePoolABI, poolAddress);
  return poolContract;
}

async function getAavePoolAddress() {
  const poolAddressesProviderContract = await new web3.eth.Contract(
    aavePoolAddressesProviderABI,
    poolAddressesProviderAddress
  );
  const poolAddress = poolAddressesProviderContract.methods
    .getPool()
    .call()
    .catch((e) => console.log("error getting pool contract"));
  return poolAddress;
}

//Calling Aave pool methods
async function aaveBorrow(aavePoolContract, debtToken, amount) {
  const interestRateMode = 2; //variable debt
  const referralCode = 0; //must be 0 right now
  const onBehalfOf = wallet.address;
  //check to see if borrow is possible

  //approve borrow
  const debtTokenContract = await getDebtTokenContract(debtToken);
  const poolAddress = await getAavePoolAddress();
  const token = await debtTokenUnderlyingAssetAddress(debtTokenContract);
  await debtTokenBorrowAllowance(
    debtTokenContract,
    poolAddress,
    wallet.address
  );
  await aavePoolContract.methods
    .borrow(token, amount, interestRateMode, referralCode, onBehalfOf)
    .send({ from: wallet.address, gas: "4000000" })
    .catch((e) => console.log("Error Borrowing Money " + e.message));
}

async function aaveRepay(aavePoolContract, erc20Contract, token, amount) {
  const rateMode = 2; //variable debt
  const onBehalfOf = wallet.address;
  const poolAddress = await getAavePoolAddress();
  await erc20Approve(erc20Contract, poolAddress, amount);
  await aavePoolContract.methods
    .repay(token, amount, rateMode, onBehalfOf)
    .send({ from: wallet.address, gas: "400000" })
    .catch((e) => console.log("Error repaying: " + e.message));
}

async function aaveDeposit(aavePoolContract, tokenContract, token, amount) {
  const poolAddress = await getAavePoolAddress();
  await erc20Approve(tokenContract, poolAddress, amount);
  await aavePoolContract.methods
    .supply(token, amount, wallet.address, 0)
    .send({ from: wallet.address, gas: "400000" })
    .catch((e) => {
      console.log("Deposit Failed: " + e.message);
    });
}

async function aaveWithdraw(aavePoolContract, token, amount) {
  await aavePoolContract.methods
    .withdraw(token, amount, wallet.address)
    .send({ from: wallet.address, gas: "500000" })
    .catch((e) => {
      console.log("Failed to Withdraw: " + e.message);
    });
}

async function getUserAccountData(poolContract) {
  const data = await poolContract.methods
    .getUserAccountData(wallet.address)
    .call()
    .catch((e) => console.log("error getting user data" + e.message));
  return data;
}

async function canBorrowMoney(token, amount) {
  const poolContract = await getAavePoolContract();
  const data = await getUserAccountData(poolContract);
  const availableBorrowBase = data.availableBorrowsBase * 10 ** 10;
  const borrowAmount = await convertToUSD(token, amount);
  return availableBorrowBase > borrowAmount;
}

async function isDebtAvailableToRepay(tokenFrom, amount, tokenTo) {
  //console.log("getting amount from");
  const amountFrom = await convertToUSD(tokenFrom, amount);
  const aaveOracleContract = await getAaveOracleContract();
  const debtByToken = await getDebtByToken();
  let debt;
  for (let i = 0; i < debtByToken.length; i++) {
    if (debtByToken[i].token == tokenTo) debt = -debtByToken[i].amount;
  }
  debt = await convertToUSD(tokenTo, debt);
  // console.log(`${debt} debt`);
  // console.log(`${amountFrom} from`);
  // console.log(amountFrom < debt);
  return amountFrom < debt;
}

async function getAaveOracleContract() {
  const aaveOracleContract = new web3.eth.Contract(
    AaveOracleABI,
    aaveOarcleAddress
  );
  return aaveOracleContract;
}

async function oneInchApprove(tokenAddress, amount) {
  try {
    console.log("Approving...");
    const response = await axios.get(
      `https://api.1inch.io/v4.0/43114/approve/transaction?tokenAddress=${tokenAddress}&amount=${amount}`
    );
    //console.log(response);
    if (response.data) {
      data = response.data;
      data.gas = "400000";
      data.gasPrice = "100000000000";
      data.from = wallet.address;
      tx = await web3.eth.sendTransaction(data);
      if (tx.status) {
        console.log("success");
      }
    }
  } catch (err) {
    console.log("failed to approve" + err.message);
  }
}

async function swap(tokenContract, fromToken, toToken, amount) {
  try {
    if (fromToken != "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
      await oneInchApprove(fromToken, amount);
    }
    const response = await axios.get(
      `https://api.1inch.io/v4.0/43114/swap?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}&fromAddress=${wallet.address}&slippage=1`
    );
    console.log("sending");
    if (response.data) {
      data = response.data;
      data.tx.gas = "1000000";
      tx = await web3.eth.sendTransaction(data.tx);
      console.log(tx.status);
    }
  } catch (e) {
    console.log("failed to swap: " + e.message);
  }
  return data.toTokenAmount;
}

//get collateral
async function getCollateralByToken() {
  var mypos = [];
  for (let i = 0; i < aTokenAddresses.length; i++) {
    const aTokenContract = await getATokenContract(aTokenAddresses[i]);
    //console.log("Getting balance of: " + aTokenAddresses[i]);
    const balance = await aTokenContractBalanceOf(aTokenContract);
    const address = await debtTokenUnderlyingAssetAddress(aTokenContract);
    const erc20Contract = await getErc20Contract(address);
    if (balance > 0) {
      let sym = await erc20Symbol(erc20Contract);
      let d = await erc20Decimals(erc20Contract);
      decimalsMap.set(sym, d);
      const balanceOfToken = {
        id: "aave-avalanche",
        symbol: sym,
        token: address,
        amount: balance,
      };
      mypos.push(balanceOfToken);
    }
  }
  return mypos;
}

async function getDebtByToken() {
  var mypos = [];
  for (let i = 0; i < debtTokenAddresses.length; i++) {
    const debtTokenContract = await getDebtTokenContract(debtTokenAddresses[i]);
    //console.log("getting debt of: " + debtTokenAddresses[i]);
    const debt = await debtTokenContractBalanceOf(debtTokenContract);
    const address = await debtTokenUnderlyingAssetAddress(debtTokenContract);
    const erc20Contract = await getErc20Contract(address);
    if (debt > 0) {
      let sym = await erc20Symbol(erc20Contract);
      let d = await erc20Decimals(erc20Contract);
      decimalsMap.set(sym, d);
      const debtOfToken = {
        id: "aave-avalanche",
        symbol: sym,
        token: address,
        amount: debt * -1,
      };
      mypos.push(debtOfToken);
    }
  }
  return mypos;
}

async function getAavePositions() {
  const debt = await getDebtByToken();
  const collateral = await getCollateralByToken();
  const pos = collateral.concat(debt);
  return pos;
}
//Check functions for adjustDebt()

//*********************************************************************
// Misc support functions
//*********************************************************************
function printMap(name, map) {
  console.log(name);
  map.forEach((value, key) => {
    console.log(key, value); // 👉️ Chile country, 30 age
  });
}

function isStablecoin(sym) {
  return ["USDC", "USDT", "USDC.e", "DAI", "USDT.e", "DAI.e"].includes(sym);
}

async function convertFromTokenToToken(tokenFrom, tokenTo, amount) {
  const tokenToContract = await getErc20Contract(tokenTo); //gets token contract of token to
  const oracle = await getAaveOracleContract(); //gets oracle contract
  const tokenFromUSD = await convertToUSD(tokenFrom, amount); //converts the tokenFrom to USD
  const decimals = await erc20Decimals(tokenToContract, tokenTo); //gets the decimals of the token to
  const factor = 18 - decimals; //gets the factor amount
  const priceTo = await getPriceOfTokenAave(oracle, tokenTo); //gets the price of the token to.
  const convertedAmount = (await tokenFromUSD) / priceTo / 10 ** factor; //takes tokenFromUSD, divides it by the price per coin to, divides it by 18 - the number of decimals

  console.log(convertedAmount);

  return convertedAmount;
}

async function convertToUSD(token, amount) {
  const tokenContract = await getErc20Contract(token); //gets token contract
  const decimals = await erc20Decimals(tokenContract, token); //gets decimals of token
  const factor = 18 - decimals; //gets the factor to reach 18 decimals
  const amountInDecimal = amount * 10 ** factor; //gets the amount in 18 decimals
  const aaveOracleContract = await getAaveOracleContract(); //gets the aave oracle
  const tokenPrice = await getPriceOfTokenAave(aaveOracleContract, token); //gets the token price
  const amountInUSD = tokenPrice * amountInDecimal; //multiples the 18 decimal amount by the token price
  return amountInUSD;
}

async function getPriceOfTokenAave(aaveOracleContract, token) {
  const tokenPrice = await aaveOracleContract.methods
    .getAssetPrice(token)
    .call()
    .catch((e) => {
      console.log("error getting price"); //This most likely happens because you are not using a token native to the AAVE platform
    });
  return tokenPrice / 10 ** 8; //divides the amount by 10 ^ 8 because aave comes in 8 decimals
}

async function getPriceOfAllTokensAave(aaveOracleContract) {
  var tokenToPrice = [];
  for (let i = 0; i < aaveTokenAddresses.length; i++) {
    const price = await getPriceOfTokenAave(
      aaveOracleContract,
      aaveTokenAddresses[i]
    );
    tokenToPrice.push({ token: aaveTokenAddresses[i], price: price });
  }
  return tokenToPrice;
}

// change so the only param it takes is owner
async function calculateNetPositions(owner) {
  var pos = await getAlphaPositions(owner);
  var pos2 = await getAavePositions();
  pos = pos.concat(pos2);
  //console.log(pos);
  let tokenMap = new Map();
  let usd = 0;
  for (let i = 0; i < pos.length; i++) {
    let sym = pos[i].symbol;
    if (isStablecoin(sym)) {
      //console.log("STABLE=",sym);
      usd += pos[i].amount;
    } else {
      //console.log("NOT STABLE=",sym);
    }
    if (!tokenMap.has(sym)) {
      //console.log("New entry ", pos[i].amount);
      tokenMap.set(sym, pos[i].amount);
    } else {
      //console.log("Updating entry ",pos[i].amount);
      tokenMap.set(sym, tokenMap.get(sym) + pos[i].amount);
    }
  }
  let netpos = [{ symbol: "USD", amount: usd, decimals: 6 }];
  tokenMap.forEach((a, s) => {
    netpos = netpos.concat({
      symbol: s,
      amount: a,
      decimals: decimalsMap.get(s),
    });
  });
  return netpos;
}

async function adjustDebt(debtTokenFrom, amount, tokenTo) {
  //getting contracts
  const debtTokenContract = await getDebtTokenContract(debtTokenFrom); //gets debt token contract
  const poolContract = await getAavePoolContract(); // gets pool contract
  const tokenFrom = await debtTokenUnderlyingAssetAddress(debtTokenContract); //gets the underlying address of the debt token
  const tokenFromContract = getErc20Contract(tokenFrom); //gets the token contract of the from token using the underlying address
  const tokenToContract = await getErc20Contract(tokenTo); //gets the token contract of the to address
  //check to see if Adjust Debt it possible
  const amountOfTokensFromInWallet = await ercBalanceOf(tokenFromContract); //get balance of tokens from in wallet
  let borrowAmount = Math.floor(amount - amountOfTokensFromInWallet); //subtract the balance of wallet from the amount that is needed to be borrowed.
  const amountOfTokensToInWallet = await ercBalanceOf(tokenToContract); //get balance of tokens to in wallet
  tokensToRepay = Math.floor(
    await convertFromTokenToToken(
      //convert the amount of tokensFrom we are spending to the amount of loan that is going to get repaid
      //Use math.floor to prevent decimal errors
      tokenFrom,
      tokenTo,
      amount
    )
  );
  const amountOfTokensNeededToRepay = tokensToRepay - amountOfTokensToInWallet; //get the remaining amount of tokens needed to repay
  if (amountOfTokensNeededToRepay < 0) borrowAmount = -1;
  //if you already have enough tokens to repay then you do not need to borrow any
  else {
    const convertedToken = await convertFromTokenToToken(
      tokenTo,
      tokenFrom,
      amountOfTokensToInWallet
    );
    borrowAmount -= convertedToken; //decreases the amount of tokens needed to borrow since you already have some
  }
  const borrowMoney = await canBorrowMoney(tokenFrom, borrowAmount); //checks if borrowing money is allowed based on liquidation
  const availableDebtToRepay = await isDebtAvailableToRepay(
    //checks if there is enough debt to repay
    tokenFrom,
    amount,
    tokenTo
  );

  //if repayAmount < 0 set borrow amount to -1, ignore swap, convert amountFrom to AmountTo, repay that
  console.log(amountOfTokensFromInWallet + " amountOfTokensFromInWallet");
  console.log(amountOfTokensToInWallet + " amountOfTokensToInWallet");
  console.log(borrowMoney + " borrowMoney");
  console.log(availableDebtToRepay + " availableDebtToRepay");
  console.log(borrowAmount + " borrowAmount");
  console.log(tokensToRepay + " tokensToRepay");

  try {
    if (!borrowMoney || !availableDebtToRepay) return; //change to throwing error, im not sure how to do this.
    //execute adjustDebt
    //*************** CHANGE TO borrowAmount **************
    if (borrowAmount > 0) {
      //if borrow amount is less than 0 we skip this step
      console.log("Borrowing from aave");
      await aaveBorrow(poolContract, debtTokenFrom, borrowAmount);
    }

    if (amountOfTokensNeededToRepay > 0) {
      //if amount needed to repay is less than 0 we skip this step
      console.log("swapping");
      await swap(tokenFromContract, tokenFrom, tokenTo, amount);
    }
    console.log("repaying");
    tokensToRepay = Math.floor(
      //Math.floor to prevent decimal errors inside of solidity
      Math.min(await ercBalanceOf(tokenToContract), tokensToRepay) //incase there are not enough tokens in the wallet due to slippage, i take the minimum of the two
    );
    await aaveRepay(poolContract, tokenToContract, tokenTo, tokensToRepay);
  } catch (e) {
    console.log("Error Adjusting debt: " + e.message);
  }
}

async function main() {
  try {
    //const txa1 = await approve(token_b,bankAddress,1000000000);
    //const txa0 = await approve(token_a,bankAddress,1000000000000);
    //const txc0 = await approve(token_lp,bankAddress,1000000000000);
    //const txa2 = await approve('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',bankAddress,1000000000000);
    //const txa0 = await approve(token_a,panPoolAddress,1000000000000);
    //const txa1 = await approve(token_b,panPoolAddress,1000000000);
    //const txa2 = await approve('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',panPoolAddress,1000000000000);
    //const data = await getData();
    //console.log("Calling getData");
    //console.log(data);
    //const bankContract = await getBankContract();
    //const tx2 = await bankDeposit(bankContract,data);
    //console.log(tx2);
    //const tx3 = await getPositionInfo(11801);
    //console.log(tx3);
    //const tx = await getPositionDebtsById(11792);
    //console.log(tx);
    //const tx4 = await getAllPositions();
    //console.log(tx4);

    // const netPos = await calculateNetPositions(wallet.address);

    // console.log(netPos);
    // printMap("MAP sym", symbolMap);
    // printMap("MAP decimals", decimalsMap);
    const poolContract = await getAavePoolContract();
    const USDCcontract = await getErc20Contract(
      "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
    );
    const oracle = await getAaveOracleContract();

    const tokenToPrice = await getPriceOfAllTokensAave(oracle);
    console.log(tokenToPrice);

    // await adjustDebt(
    //   "0xfb00AC187a8Eb5AFAE4eACE434F493Eb62672df7",
    //   "1000",
    //   "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
    // );

    // await canBorrowMoney(
    //   "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    //   "10000000000000000"
    // );
    //console.log(usdcPrice > price);
    // console.log(price);

    // await adjustDebt(
    //   "0xfb00AC187a8Eb5AFAE4eACE434F493Eb62672df7",
    //   "1000",
    //   "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
    // );

    // await aaveBorrow(
    //   poolContract,
    //   "0xfb00AC187a8Eb5AFAE4eACE434F493Eb62672df7",
    //   "1000"
    // );

    // await aaveContractRepay(
    //   poolContract,
    //   USDCcontract,
    //   "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    //   "1000"
    // );

    // await aaveDeposit(
    //   poolContract,
    //   USDCcontract,
    //   "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    //   "1000"
    // );

    // await aaveWithdraw(
    //   poolContract,
    //   "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    //   "1000"
    // );

    //console.log(poolContract);
    // const test = await aaveContractBorrow(
    //   poolContract,
    //   "0xfb00AC187a8Eb5AFAE4eACE434F493Eb62672df7",
    //   "1000"
    // );
  } catch (e) {
    console.log(e.message);
  }
}

main();
