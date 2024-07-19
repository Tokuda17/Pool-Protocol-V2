const aaveTokenAddresses = [
  "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", //Weth
  "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", //USDC
  "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", //USDT
  "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", //DAI
  "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", //WAVAX
];

const tokenMap = [];
async function init() {
  //creates the mapping from the list of ERC-20 balance
  for (let i = 0; i < aaveTokenAddresses.length; i++) {
    const erc20Contract = await erc20.getContract(aaveTokenAddresses[i]);
    const sym = await erc20.symbol(erc20Contract);
    const d = await erc20.decimals(erc20Contract);
    const token = {
      chain: "AVAX",
      symbol: sym,
      address: aaveTokenAddresses[i],
      decimals: d,
    };
    tokenMap.push(token);
  }
}

//Could copy and paste depending on implementation
function getATokenContract(Symbol) {
  //returns A Token Contract
}
function aTokenContractBalanceOf(aTokenContract, walletAddres) {
  //return the balance of aToken in aave
}

function getPoolContract() {
  //returns poolContract
}

function getPoolAddress() {
  //returns lending pool address
}

function borrow(aavePoolContract, SYMBOL, amount, walletAddress) {
  //from symbols gets: debtTokenAddress, address, decimals to convert amount,
  //executes borrow function as normal
}
function repay(aavePoolContract, erc20Contract, SYMBOL, amount, walletAddress) {
  //from symbols gets: address, decimals to convert amount,
  //execute as normal from there
}
function deposit(
  aavePoolContract,
  tokenContract,
  SYMBOL,
  amount,
  walletAddress
) {
  //from symbols gets: address, decimals to convert amount,
  //execute as normal from there
}
async function withdraw(aavePoolContract, SYMBOL, amount, walletAddress) {
  //from symbols gets: address, decimals to convert amount,
  //execute as normal from there
}
function getUserAccountData() {
  //no changes needed
}
function canBorrowMoney(SYMBOL, amount, walletAddress) {
  //from symbols gets: address, decimals to convert amount,
  //execute as normal from there
}
async function isDebtAvailableToRepay(
  SYMBOlfrom,
  amount,
  SYMBOLTO,
  walletAddress
) {
  //from SYMBOLfrom get: address, decimals to conver amount
  //from SYMBOLTO get: address
  //execute from there as normal
}
async function getPriceOfToken(aaveOracleContract, token, walletAddress) {
  //gets the price of each token
}
async function getPriceOfAllTokens(walletAddress) {
  // return price of all tokens
}
async function convertToUSD(address, amount, walletAddress) {
  //return the amount of tokens into a USD amount in 18 digits
}

async function convertFromTokentoToken(
  addressFrom,
  addressTo,
  amount,
  walletAddress
) {
  //converts one token to the price of another token
}

//Should be elimated and replaced with init function
async function getDebtByToken() {
  //returns the debt by token
}

//should be replaced with init function
async function getCollateralByToken() {
  //returns the collateral by token
}

async function getPosition(walletAddress) {
  //returns a list of positions on Aave
}

//Could copy and paste depending on implementation; currently takes address instead of symbol
function getDebtTokenContract(Symbol) {
  //returns debt token Contract
}
function debtTokenContractBalanceOf(dtContract, walletAddress) {
  //returns balance of debt token contract
}

//most likely will be able to remove this function with new system of symbols
function debtTokenUnderlyingAssetAddress() {
  //returns the address of the underlying token associated with a debt token
}
function debtTokenBorrowAllowance(
  debtTokenContract,
  aavePoolAddress,
  walletAddress
) {
  //allowance for borrowing tokens
  //this is where the debtToken Contract is needed
}
function getDebtTokenMap() {
  //creates the list of aave debt tokens with
  //multiple values: blockchain, symbol, address, decimals.
}
