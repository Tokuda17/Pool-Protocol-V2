const Web3 = require("web3");
const axios = require("axios");
require("dotenv").config();

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const web3 = new Web3(POLYGON_RPC_URL);
const wallet = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY);

const poolABI = require("../ABI/Pool.json");
const ERC20_ABI = require("../ABI/ERC20.json");
const poolAddressesProviderABI = require("../ABI/PoolAddressesProvider.json");
const AaveOracleABI = require("../ABI/AaveOracle.json");
const USDTDebtABI = require("../ABI/USDTDebt.json");

const aaveOracleContract = new web3.eth.Contract(
  AaveOracleABI,
  "0xb023e699F5a33916Ea823A16485e259257cA8Bd1"
);

const poolAddressesProviderAddress =
  "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
const USDTDebtAddress = "0xfb00AC187a8Eb5AFAE4eACE434F493Eb62672df7";

function getPoolAddressProviderContract() {
  const poolAddressProviderContract = new web3.eth.Contract(
    poolAddressesProviderABI,
    poolAddressesProviderAddress
  );
  return poolAddressProviderContract;
}
async function getPoolAddress() {
  const poolAddress = await getPoolAddressProviderContract()
    .methods.getPool()
    .call()
    .catch((e) => {
      throw Error("Error getting pool Address");
    });

  return poolAddress;
}
async function deposit(tokenAddress, AMOUNT) {
  try {
    const poolAddress = await getPoolAddress();
    const tokenContract = await new web3.eth.Contract(ERC20_ABI, tokenAddress);
    const gasPrice = await tokenContract.methods
      .approve(poolAddress, AMOUNT)
      .estimateGas();
    console.log(gasPrice);
    throw Error("Passed");
    await tokenContract.methods
      .approve(poolAddress, AMOUNT)
      .send({ from: wallet.address, gasPrice: "100000000000", gas: "400000" })
      .catch((e) => {
        throw Error("Error depositing token allowance" + e.message);
      });

    console.log("approve");
    const poolContract = new web3.eth.Contract(poolABI, poolAddress);
    console.log("Depositing...");
    const tx = await poolContract.methods
      .supply(tokenAddress, AMOUNT, wallet.address, 0)
      .send({
        from: wallet.address,
        gasPrice: "100000000000",
        gas: "400000",
      })
      .catch((e) => {
        throw Error("Error depositing token" + e.message);
      });

    console.log(tx.status);
  } catch (e) {
    console.log(e.message);
  }
}
async function withdraw(tokenAddress, AMOUNT) {
  try {
    const poolAddress = await getPoolAddress();
    const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
    const poolContract = new web3.eth.Contract(poolABI, poolAddress);
    console.log("withdrawing...");
    const gasPrice = await poolContract.methods
      .withdraw(
        "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
        AMOUNT,
        wallet.address
      )
      .estimateGas();

    console.log(gasPrice);
    throw Error("passed");
    const tx = await poolContract.methods
      .withdraw(tokenAddress, AMOUNT, wallet.address)
      .send({ from: wallet.address, gasPrice: "100000000000", gas: "400000" })
      .catch((e) => {
        throw Error("Error withdrawing token" + e.message);
      });
    console.log(tx.status);
    const tx1 = await poolContract.methods.borrow(
      tokenAddress,
      AMOUNT,
      2,
      0,
      wallet.address
    );
  } catch (e) {
    console.log(e.message);
  }
}
async function approve(tokenAddress, amount) {
  try {
    console.log("Approving...");
    const response = await axios.get(
      `https://api.1inch.io/v4.0/137/approve/transaction?tokenAddress=${tokenAddress}&amount=${amount}`
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
async function swapper(fromTokenAddress, toTokenAddress, amount) {
  try {
    if (fromTokenAddress != "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
      await approve(fromTokenAddress, amount);
    }
    console.log("swapping...");
    const response = await axios.get(
      `https://api.1inch.io/v4.0/137/swap?fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}&fromAddress=${wallet.address}&slippage=1`
    ); //put in address connected to wallet
    if (response.data) {
      data = response.data;
      data.tx.gas = 1000000;

      tx = await web3.eth.sendTransaction(data.tx);
      console.log(tx.status);
    }
  } catch (err) {
    console.log("failed");
    console.log(err);
  }
}
async function getUserAccountData() {
  const poolAddress = await getPoolAddress();
  const poolContract = await new web3.eth.Contract(poolABI, poolAddress);
  const data = await poolContract.methods
    .getUserAccountData(wallet.address)
    .call()
    .catch((e) => {
      console.log("Error getting data");
    });

  console.log(data.totalCollateralBase / 10 ** 8);
}
async function getAlphaDebt(owner) {
  const USDTDebtContract = await new web3.eth.Contract(
    USDTDebtABI,
    "0xFCCf3cAbbe80101232d343252614b6A3eE81C989"
  );
  console.log(await USDTDebtContract.methods.UNDERLYING_ASSET_ADDRESS().call());
  const USDTDebt = await USDTDebtContract.methods
    .balanceOf(owner)
    .call()
    .catch((e) => console.log(e.message));
  return USDTDebt;
}
async function main() {
  await withdraw("0xc2132D05D31c914a87C6611C10748AEb04B58e8F", "1000000");
  // await withdraw("0xc2132D05D31c914a87C6611C10748AEb04B58e8F", 1000000);
  // await swapper(
  //   "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  //   "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  //   1000000
  // );
  // const USDTPrice = await aaveOracleContract.methods
  //   .getAssetPrice("0xc2132D05D31c914a87C6611C10748AEb04B58e8F")
  //   .call()
  //   .catch((e) => console.log(e.message));
  // console.log(USDTPrice / 10 ** 8);
  // getUserAccountData();
  // const poolAddress = await getPoolAddress();
  // const poolContract = new web3.eth.Contract(poolABI, poolAddress);
  // const test = await poolContract.methods.getReservesList().call();
  // console.log(test);
  // debt = await getAlphaDebt(wallet.address);
  // console.log(debt / 10 ** 6);
}

main();
