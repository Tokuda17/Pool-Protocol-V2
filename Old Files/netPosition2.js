const axios = require("axios");
require("dotenv").config();
var BigNumber = require("big-number");
nodemailer = require("../nodemailer.js");
erc20 = require("../erc20.js");
pan = require("../pan.js");
alpha = require("../alpha.js");
wall = require("../wallet.js");

const web3 = wall.web3;
const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL;
//const ALPHA_AVALANCHE_URL = process.env.ALPHA_AVALANCHE_URL;
var wallet;

//*********************************************************************
// ABI's
//*********************************************************************
//const bankABI = require("./ABI/HomoraBank.json");
//const panABI = require("./ABI/PangolinSpellV2.json"); //pan = Pangolin
//const chefABI = require("./ABI/WMiniChefV2PNG.json");
//const erc20ABI = require("./ABI/erc20.json");
//const panPoolABI = require("./ABI/PangolinPool.json");
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

//bankAddress = "0x376d16C7dE138B01455a51dA79AD65806E9cd694";
//panAddress = "0x966bbec3ac35452133B5c236b4139C07b1e2c9b1";
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

const addressMap = new Map();
const symbolMap = new Map();
const decimalsMap = new Map();
const priceMap = new Map();

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
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => getATokenContractBalanceOf failed");
    });
  //console.log("GETATOKENCONTRACT=",aTokenBalance);
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
  console.log("inside debtTokenContractBalanceOf");
  console.log("wallet", wallet);
  console.log("wallet.address", wallet.address);
  const debt = await debtTokenContract.methods
    .balanceOf(wallet.address)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => debtTokenContractBalanceOf failed");
    });
  console.log("debt=", debt);
  return debt;
}

//get underlying address of Atoken or Debt Token
async function debtTokenUnderlyingAssetAddress(tokenContract) {
  const address = await tokenContract.methods
    .UNDERLYING_ASSET_ADDRESS()
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => debtTokenUnderlyingAssetAddress failed");
    });
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
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => debtTokenBorrowAllowance failed");
    });

  if (tx.status) console.log(tx.status);
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
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => getAavePoolContract failed");
    });
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
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => getAavePoolAddress failed");
    });
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
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => aaveBorrow failed");
    });
}

async function aaveRepay(aavePoolContract, erc20Contract, token, amount) {
  const rateMode = 2; //variable debt
  const onBehalfOf = wallet.address;
  const poolAddress = await getAavePoolAddress();
  await erc20.approve(erc20Contract, onBehalfOf, poolAddress, amount);
  await aavePoolContract.methods
    .repay(token, amount, rateMode, onBehalfOf)
    .send({ from: wallet.address, gas: "400000" })
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => aaveRepay failed");
    });
}

async function aaveDeposit(aavePoolContract, tokenContract, token, amount) {
  const poolAddress = await getAavePoolAddress();
  await erc20.approve(tokenContract, wallet.address, poolAddress, amount);
  await aavePoolContract.methods
    .supply(token, amount, wallet.address, 0)
    .send({ from: wallet.address, gas: "400000" })
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => aaveDeposit failed");
    });
}

async function aaveWithdraw(aavePoolContract, token, amount) {
  await aavePoolContract.methods
    .withdraw(token, amount, wallet.address)
    .send({ from: wallet.address, gas: "500000" })
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => aaveWithdraw failed");
    });
}

async function getUserAccountData(poolContract) {
  const data = await poolContract.methods
    .getUserAccountData(wallet.address)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(e.message + " => getUserAccountData failed");
    });
  return data;
}

async function canBorrowMoney(token, amount) {
  try {
    const poolContract = await getAavePoolContract();
    const data = await getUserAccountData(poolContract);
    const availableBorrowBase = data.availableBorrowsBase * 10 ** 10;
    const borrowAmount = await convertToUSD(token, amount);
    return availableBorrowBase > borrowAmount;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => canBorrowMoney failed");
  }
}

async function isDebtAvailableToRepay(tokenFrom, amount, tokenTo) {
  try {
    //console.log("getting amount from");
    const amountFrom = await convertToUSD(tokenFrom, amount);
    const aaveOracleContract = await getAaveOracleContract();
    //console.log("c");
    const debtByToken = await getDebtByToken();
    //console.log("c");
    let debt;
    for (let i = 0; i < debtByToken.length; i++) {
      if (debtByToken[i].token == tokenTo) debt = -debtByToken[i].amount;
    }
    debt = await convertToUSD(tokenTo, debt);
    // console.log(`${debt} debt`);
    // console.log(`${amountFrom} from`);
    // console.log(amountFrom < debt);
    return amountFrom < debt;
  } catch (e) {
    console.log(e.message);
    throw new Error(e.message + " => isDebtAvailableToRepay failed");
  }
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
  } catch (e) {
    console.log("failed to approve" + err.message);
    throw new Error(e.message + " => oneInchApprove failed");
  }
}

async function swap(tokenContract, fromToken, toToken, amount) {
  console.log(`fromToken ${fromToken}, toToken${toToken}, amount ${amount} `);

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
    throw new Error(e.message + " => swap() failed");
  }
  return data.toTokenAmount;
}

//get collateral
async function getCollateralByToken() {
  try {
    var mypos = [];
    for (let i = 0; i < aTokenAddresses.length; i++) {
      const aTokenContract = await getATokenContract(aTokenAddresses[i]);
      //console.log("Getting balance of: " + aTokenAddresses[i]);
      const balance = await aTokenContractBalanceOf(aTokenContract);
      //console.log("GETCOLLATERBYTOKEN balance=",balance);
      const address = await debtTokenUnderlyingAssetAddress(aTokenContract);
      const erc20Contract = await erc20.getContract(address);
      //console.log("getCollateralByToken balance=",balance);
      if (balance > 0) {
        let sym = await erc20.symbol(erc20Contract);
        let d = await erc20.decimals(erc20Contract);
        decimalsMap.set(sym, d);
        const balanceOfToken = {
          id: "aave-avalanche",
          symbol: sym,
          token: address,
          amount: balance,
        };
        //console.log("getCollateralByToken end balance=",balanceOfToken.amount);
        mypos.push(balanceOfToken);
      }
    }
    return mypos;
  } catch (e) {
    console.log("getCollateralByToken " + e.message);
    throw new Error(e.message + " => getCollateralByToken failed");
  }
}

async function getDebtByToken() {
  try {
    var mypos = [];
    for (let i = 0; i < debtTokenAddresses.length; i++) {
      console.log("a");
      const debtTokenContract = await getDebtTokenContract(
        debtTokenAddresses[i]
      );
      console.log("getting debt of: " + debtTokenAddresses[i]);
      const debt = await debtTokenContractBalanceOf(debtTokenContract);
      console.log("b");
      const address = await debtTokenUnderlyingAssetAddress(debtTokenContract);
      console.log("ADDRESS=", address);
      const erc20Contract = await erc20.getContract(address);
      if (debt > 0) {
        console.log("address", address);
        let sym = await erc20.symbol(erc20Contract);
        let d = await erc20.decimals(erc20Contract);
        decimalsMap.set(sym, d);
        const debtOfToken = {
          id: "aave-avalanche",
          symbol: sym,
          token: address,
          amount: BigNumber(debt).mult(-1).toString(),
        };
        mypos.push(debtOfToken);
      }
    }
    return mypos;
  } catch (e) {
    console.log("getDebtByToken " + e.message);
    throw new Error(e.message + " => getDebtByToken failed");
  }
}

async function getAavePositions() {
  try {
    const debt = await getDebtByToken();
    const collateral = await getCollateralByToken();
    const pos = collateral.concat(debt);
    return pos;
  } catch (e) {
    console.log("getAavePositions " + e.message);
    throw new Error(e.message + " => getAavePositions failed");
  }
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

function isNativeEquivalent(sym) {
  return ["WAVAX", "AVAX"].includes(sym.toUpperCase());
}

function isNative(sym) {
  return ["AVAX"].includes(sym.toUpperCase());
}

function isStablecoin(sym) {
  return ["USDC", "USDT", "USDC.E", "DAI", "USDT.E", "DAI.E"].includes(
    sym.toUpperCase()
  );
}

async function convertFromTokenToToken(tokenFrom, tokenTo, amount) {
  try {
    const tokenToContract = await erc20.getContract(tokenTo); //gets token contract of token to
    const oracle = await getAaveOracleContract(); //gets oracle contract
    const tokenFromUSD = await convertToUSD(tokenFrom, amount); //converts the tokenFrom to USD
    const decimals = await erc20.decimals(tokenToContract, tokenTo); //gets the decimals of the token to
    const factor = 18 - decimals; //gets the factor amount
    const priceTo = await getPriceOfTokenAave(oracle, tokenTo); //gets the price of the token to.
    const convertedAmount = (await tokenFromUSD) / priceTo / 10 ** factor; //takes tokenFromUSD, divides it by the price per coin to, divides it by 18 - the number of decimals

    console.log(convertedAmount);

    return convertedAmount;
  } catch (e) {
    console.log("convertFromTokenToToken " + e.message);
    throw new Error(e.message + " => convertFromTokenToToken failed");
  }
}

async function convertToUSD(token, amount) {
  try {
    const tokenContract = await erc20.getContract(token); //gets token contract
    const decimals = await erc20.decimals(tokenContract, token); //gets decimals of token
    const factor = 18 - decimals; //gets the factor to reach 18 decimals
    const amountInDecimal = amount * 10 ** factor; //gets the amount in 18 decimals
    const aaveOracleContract = await getAaveOracleContract(); //gets the aave oracle
    const tokenPrice = await getPriceOfTokenAave(aaveOracleContract, token); //gets the token price
    const amountInUSD = tokenPrice * amountInDecimal; //multiples the 18 decimal amount by the token price
    return amountInUSD;
  } catch (e) {
    console.log("convertToUSD " + e.message);
    throw new Error(e.message + " => convertToUSD failed");
  }
}

async function getPriceOfTokenAave(aaveOracleContract, token) {
  const tokenPrice = await aaveOracleContract.methods
    .getAssetPrice(token)
    .call()
    .catch(function (e) {
      console.log(e.message);
      throw new Error(
        e.message +
          " => getPriceOfTokenAave failed, likey because you are not using a token native to the Aave platform"
      );
    });
  //This most likely happens because you are not using a token native to the AAVE platform
  return tokenPrice / 10 ** 8; //divides the amount by 10 ^ 8 because aave comes in 8 decimals
}

async function getPriceOfAllTokensAave(aaveOracleContract) {
  try {
    var tokenToPrice = [];
    for (let i = 0; i < aaveTokenAddresses.length; i++) {
      const price = await getPriceOfTokenAave(
        aaveOracleContract,
        aaveTokenAddresses[i]
      );
      let tcontract = await erc20.getContract(aaveTokenAddresses[i]);
      let sym = await erc20.symbol(tcontract);
      priceMap.set(sym, price);
      tokenToPrice.push({
        symbol: sym,
        token: aaveTokenAddresses[i],
        price: price,
      });
    }
    return tokenToPrice;
  } catch (e) {
    console.log("getPriceOfAllTokensAave " + e.message);
    throw new Error(e.message + " => getPriceOfAllTokensAave failed");
  }
}

// creates addressMap, symbolMap, and decimalsMap from an array of positions
// a position is { symbol: <sym>, token: <address>, decimals: <decimals> }
// xxx possibly remove the maps and just pass around the values in the positions
function createMaps(pos) {
  //console.log("CREATE MAPS",pos.length);
  for (let i = 0; i < pos.length; i++) {
    if (pos[i].symbol !== undefined) {
      if (pos[i].token !== undefined) {
        //console.log("sym",pos[i].symbol,"token",pos[i].token);
        addressMap.set(pos[i].symbol, pos[i].token);
        symbolMap.set(pos[i].token, pos[i].symbol);
      }
      if (pos[i].decimals !== undefined) {
        decimalsMap.set(pos[i].symbol, pos[i].decimals);
        //console.log("dec",pos[i].decimals);
      }
    }
  }
  //console.log ("MAPS CREATED");
}

// change so the only param it takes is owner
async function calculateNetPositions(owner) {
  try {
    //console.log("entering calculateNetPositions :",owner);
    var pos = await alpha.getPositions(owner);
    var pos2 = await getAavePositions();
    pos = pos.concat(pos2);
    createMaps(pos); // addressMap and other maps filled in here
    //console.log("Owner address",owner);
    var pos3 = await wall.getPositions(owner, addressMap);
    pos = pos.concat(pos3);
    let tokenMap = new Map();
    let usd = 0;
    let native = 0;
    for (let i = 0; i < pos.length; i++) {
      //console.log("i=",i);
      let sym = pos[i].symbol;
      let id = pos[i].id;
      //console.log("sym=",sym);
      if (isStablecoin(sym)) {
        usd = BigNumber(usd).add(pos[i].amount).toString();
      } else if (isNativeEquivalent(sym)) {
        native = BigNumber(native).add(pos[i].amount).toString();
      } else {
      }
    }
    let netpos = [
      { id: "net", symbol: "USD", amount: usd, decimals: 6 },
      { id: "net", symbol: "AVAX", amount: native, decimals: 18 },
    ];
    netpos = netpos.concat(pos);
    //console.log("POS=",netpos);

    return netpos;
  } catch (e) {
    console.log("calculateNetPositions " + e.message);
    throw new Error(e.message + " => calculateNetPositions failed");
  }
}

async function adjustDebt(debtTokenFrom, amount, tokenTo) {
  try {
    //getting contracts
    const debtTokenContract = await getDebtTokenContract(debtTokenFrom); //gets debt token contract
    const poolContract = await getAavePoolContract(); // gets pool contract
    const tokenFrom = await debtTokenUnderlyingAssetAddress(debtTokenContract); //gets the underlying address of the debt token
    const tokenFromContract = erc20.getContract(tokenFrom); //gets the token contract of the from token using the underlying address
    const tokenToContract = await erc20.getContract(tokenTo); //gets the token contract of the to address
    //check to see if Adjust Debt it possible
    const amountOfTokensFromInWallet = await erc20.balanceOf(
      tokenFromContract,
      wallet.address
    ); //get balance of tokens from in wallet
    let borrowAmount = Math.floor(amount - amountOfTokensFromInWallet); //subtract the balance of wallet from the amount that is needed to be borrowed.
    const amountOfTokensToInWallet = await erc20.balanceOf(
      tokenToContract,
      wallet.address
    ); //get balance of tokens to in wallet
    tokensToRepay = Math.floor(
      await convertFromTokenToToken(
        //convert the amount of tokensFrom we are spending to the amount of loan that is going to get repaid
        //Use math.floor to prevent decimal errors
        tokenFrom,
        tokenTo,
        amount
      )
    );
    const amountOfTokensNeededToRepay =
      tokensToRepay - amountOfTokensToInWallet; //get the remaining amount of tokens needed to repay
    const convertedToken = await convertFromTokenToToken(
      tokenTo,
      tokenFrom,
      amountOfTokensToInWallet
    );
    if (amountOfTokensNeededToRepay < 0) borrowAmount = -1;
    //if you already have enough tokens to repay then you do not need to borrow any
    else {
      borrowAmount -= convertedToken; //decreases the amount of tokens needed to borrow since you already have some
    }
    const repayAmount = Math.floor(
      Math.min((amount - convertedToken, amountOfTokensFromInWallet))
    );

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
    console.log(
      tokensToRepay + " tokensToRepay " + amountOfTokensNeededToRepay
    );
    console.log(tokenFrom);

    if (!borrowMoney || !availableDebtToRepay)
      throw "Not enough debt or collateral in wallet"; //change to throwing error, im not sure how to do this.
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
      await swap(tokenFromContract, tokenFrom, tokenTo, repayAmount);
    }
    console.log("repaying");
    tokensToRepay = Math.floor(
      //Math.floor to prevent decimal errors inside of solidity
      Math.min(
        await erc20.balanceOf(tokenToContract, wallet.address),
        tokensToRepay
      ) //incase there are not enough tokens in the wallet due to slippage, i take the minimum of the two
    );
    await aaveRepay(poolContract, tokenToContract, tokenTo, tokensToRepay);
  } catch (e) {
    console.log("Error Adjusting debt: " + e.message);
    throw new Error(e.message + " => adjustDebt failed");
  }
}

function getSymbolFromArray(sym, a) {
  for (let i = 0; i < a.length; i++) {
    if (a[i].symbol.toUpperCase() == sym.toUpperCase()) return a[i];
  }
  throw Error(e.message + " => getSymbolFromArray ", sym, " not found");
}

function getIdSymbolFromArray(id, sym, a) {
  for (let i = 0; i < a.length; i++) {
    if (a[i].id == id) {
      if (a[i].symbol.toUpperCase() == sym.toUpperCase()) return a[i];
    }
  }
  throw Error(e.message + " => getSymbolFromArray ", sym, " not found");
}

// divides two number and returns a decimal with decimal places of precision
function getDecimalDivision(numerator, denominator, decimal) {
  let n = BigNumber(numerator)
    .mult(10 ** decimal)
    .div(denominator)
    .toString();
  n = parseInt(n) / 10 ** decimal;
  return n;
}

function addCommas(n, dollar) {
  if (dollar === true) dollar = "$";
  else dollar = "";
  if (n < 0) {
    minus = "-";
    n = -n;
  } else minus = "";
  return minus + dollar + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function calculateNetPosition(wname, addr) {
  try {
    const netPos = await calculateNetPositions(addr);
    console.log(netPos);

    const oracle = await getAaveOracleContract();
    const tokenToPrice = await getPriceOfAllTokensAave(oracle);

    const avaxTokenToPrice = getSymbolFromArray("WAVAX", tokenToPrice);
    let avaxPrice = avaxTokenToPrice.price * 100000000;

    let av = getIdSymbolFromArray("net", "AVAX", netPos);
    let avVal = BigNumber(av.amount)
      .mult(avaxPrice)
      .div(BigNumber(10).power(av.decimals))
      .div(BigNumber(10).power(8))
      .toString();
    // avTokens is the number of AVAX tokens to two decimal places
    let avTokens = getDecimalDivision(
      av.amount,
      BigNumber(10).power(av.decimals).toString(),
      2
    );

    let u = getSymbolFromArray("usd", netPos);
    // uVal = net dollar value of all stablecoin positions
    let uVal = BigNumber(u.amount)
      .div(BigNumber(10).power(u.decimals))
      .toString();

    let ad = getIdSymbolFromArray("aave-avalanche", "WAVAX", netPos);
    // adVal = value of AVAX debt from Aave
    let adVal = BigNumber(ad.amount)
      .mult(-1)
      .mult(avaxPrice)
      .div(BigNumber(10).power(8))
      .div(BigNumber(10).power(18))
      .toString();

    // spread is a % of Aave AVAX debt used to determine if a trade should be executed
    let spread = BigNumber(adVal).mult(12).div(1000).toString();

    // netVal is the sum of the net AVAX and USD positions
    let netVal = BigNumber(avVal).add(uVal).toString();
    netVal = addCommas(netVal, true);

    if (parseInt(avVal) > spread) {
      avTokens = addCommas(avTokens);
      avVal = addCommas(avVal, true);
      //console.log("You are LONG, SELL", avTokens, "AVAX = $", avVal);
      //console.log("USD=$", uVal);
      nodemailer.sendMail(
        "SELL " + avTokens + " AVAX",
        "You are LONG, SELL " +
          avTokens +
          " AVAX = " +
          avVal +
          ". Net Value = " +
          netVal
      );
    } else if (parseInt(avVal) < -spread) {
      avTokens = addCommas(-avTokens);
      avVal = addCommas(-avVal, true);
      //console.log("You are SHORT", avTokens, "AVAX, BUY", avVal, "of AVAX");
      //console.log("USD=$", uVal);
      nodemailer.sendMail(
        "BUY " + avVal + " of AVAX",
        "You are SHORT, BUY " +
          parseInt(avTokens) +
          " AVAX = " +
          avVal +
          ". Net Value = " +
          netVal
      );
    } else {
      avTokens = addCommas(avTokens);
      avVal = addCommas(avVal, true);
      //console.log("Spread=",spread);
      spread = addCommas(spread, true);
      //console.log("Spread=",spread);
      //console.log("Your AVAX postion is", avTokens);
      nodemailer.sendMail(
        "Your AVAX postion is " + avTokens,
        "Your AVAX postion is " +
          avTokens +
          " = " +
          avVal +
          " and the spread is " +
          spread +
          ". Net Value = " +
          netVal
      );
    }
  } catch (e) {
    console.log(e.message);
    nodemailer.sendMail("calculateNetPosition() failed", e.message);
  }
}

async function initNetPosition(wname, mailResults) {
  if (mailResults === false) mailResults = false;
  else mailResults = true;
  wallet = wall.initWallet(wname);
  nodemailer.initEmailTo(wname);
  calculateNetPosition(wname, wallet.address, mailResults);
}

async function main() {
  try {
    var wname = "default";
    if (process.argv.length >= 3) {
      wname = process.argv[2];
    }
    wallet = wall.initWallet(wname);
    nodemailer.initEmailTo(wname);
    calculateNetPosition(wname, wallet.address);

    //let v = getDecimalDivision(BigNumber(2).mult(BigNumber(10).pow(18)),BigNumber(3).mult(BigNumber(10).pow(18)),3);
    //console.log(v);
    //const txa1 = await approve(token_b,bankAddress,1000000000);
    //const txa0 = await approve(token_a,bankAddress,1000000000000);
    //const txc0 = await approve(token_lp,bankAddress,1000000000000);
    //const txa2 = await approve('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',bankAddress,1000000000000);
    //const txa0 = await approve(token_a,panPoolAddress,1000000000000);
    //const txa1 = await approve(token_b,panPoolAddress,1000000000);
    //const txa2 = await approve('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',panPoolAddress,1000000000000);
    //const data = await alpha.getData();
    //console.log("Calling alpha.getData");
    //console.log(data);
    //const bankContract = await getBankContract();
    //const tx2 = await alpha.bankDeposit(bankContract,data);
    //console.log(tx2);
    //const tx3 = await getPositionInfo(11801);
    //console.log(tx3);
    //const tx = await getPositionDebtsById(11792);
    //console.log(tx);
    //const tx4 = await getAllPositions();
    //console.log(tx4);

    // printMap("MAP sym", addressMap);
    // printMap("MAP decimals", decimalsMap);
    //const poolContract = await getAavePoolContract();
    //const USDCcontract = await erc20.getContract(
    //  "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
    //);

    //console.log("addressMap: ", addressMap);
    //console.log("symbolMap: ", symbolMap);
    //console.log("priceMap: ", priceMap);

    //sendMail("first status update", tokenToPrice[0].token);

    //const debt = await convertFromTokenToToken(
    //  "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    //  "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    //  "400000"
    //);
    //console.log(debt);
    //await adjustDebt(
    //  "0x4a1c3aD6Ed28a636ee1751C69071f6be75DEb8B8",
    //  debt,
    //  "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7"
    //);

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

    //const bal = await getSpendableBalance(wallet.address);
    //console.log("balance=",bal);
  } catch (e) {
    console.log(e.message);
  }
}

//main()

module.exports = Object.assign(
  {
    initNetPosition,
    calculateNetPosition,
    symbolMap,
    addressMap,
    decimalsMap,
    priceMap,
  },
  nodemailer,
  wall,
  wallet
);
