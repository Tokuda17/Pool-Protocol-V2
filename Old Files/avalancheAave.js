const Web3 = require("web3");
const axios = require("axios");
require("dotenv").config();

const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const web3 = new Web3(AVALANCHE_RPC_URL);
const wallet = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY);

//Import ABIs
const poolABI = require("../ABI/Pool.json");
const ERC20_ABI = require("../ABI/ERC20.json");
const poolAddressesProviderABI = require("../ABI/PoolAddressesProvider.json");
const AaveOracleABI = require("../ABI/AaveOracle.json");
const DebtTokenABI = require("../ABI/avaxDebtToken.json");
const ATokenAbi = require("../ABI/avaxAToken.json");
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
//Get Contract
async function getPoolAddressProviderContract() {
  const poolAddressesProviderContract = await new web3.eth.Contract(
    poolAddressesProviderABI,
    poolAddressesProviderAddress
  );
  return poolAddressesProviderContract;
}
async function getPoolContract(poolAddressesProviderContract) {
  const poolAddress = await poolAddressesProviderContract.methods
    .getPool()
    .call()
    .catch((e) => console.log("Failed to get Pool Contract" + e.message));

  const poolContract = await new web3.eth.Contract(poolABI, poolAddress);
  return poolContract;
}
async function getATokenContract(address) {
  const aTokenContract = await new web3.eth.Contract(ATokenAbi, address);
  return aTokenContract;
}
async function getDebtTokenContract(address) {
  const debtTokenContract = await new web3.eth.Contract(DebtTokenABI, address);
  return debtTokenContract;
}

//aTokenMethods
async function aTokenContractBalanceOf(aTokenContract) {
  const aTokenBalance = await aTokenContract.methods
    .balanceOf(wallet.address)
    .call()
    .catch((e) => console.log(e.message));
  return aTokenBalance;
}
//debtTokenMethods
async function debtTokenContractBalanceOf(debtTokenContract) {
  const debt = await debtTokenContract.methods
    .balanceOf(wallet.address)
    .call()
    .catch((e) => console.log(e.message));
  return debt;
}

//get underlying address
async function getUnderlyingAssetAddress(tokenContract) {
  const address = await tokenContract.methods
    .UNDERLYING_ASSET_ADDRESS()
    .call()
    .catch((e) => console.log(e.message));
  return address;
}

//get collateral
async function getCollateralByToken() {
  var mypos = [];
  for (let i = 0; i < aTokenAddresses.length; i++) {
    const aTokenContract = await getATokenContract(aTokenAddresses[i]);
    console.log("Getting balance of: " + aTokenAddresses[i]);
    const balance = await aTokenContractBalanceOf(aTokenContract);
    const address = await getUnderlyingAssetAddress(aTokenContract);
    const balanceOfToken = { token: address, amount: balance };
    mypos.push(balanceOfToken);
  }
  return mypos;
}

async function getDebtByToken() {
  var mypos = [];
  for (let i = 0; i < debtTokenAddresses.length; i++) {
    const debtTokenContract = await getDebtTokenContract(debtTokenAddresses[i]);
    console.log("getting debt of: " + debtTokenAddresses[i]);
    const debt = await debtTokenContractBalanceOf(debtTokenContract);
    const address = await getUnderlyingAssetAddress(debtTokenContract);
    const debtOfToken = { token: address, amount: debt * -1 };
    //console.log(debtOfToken.debt);
    //console.log(debtOfToken.address);
    mypos.push(debtOfToken);
  }
  return mypos;
}

async function main() {
  const collateral = await getCollateralByToken();
  const debt = await getDebtByToken();
  const pos = collateral.concat(debt);
  for (let i = 0; i < pos.length; i++) {
    console.log(pos[i]);
  }
}

main();
