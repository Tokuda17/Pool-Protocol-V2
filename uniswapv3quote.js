// Mainnet, Polygon, Optimism, Arbitrum
const QUOTER_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
const FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

const univ3sdk = require("@uniswap/v3-sdk");
const unicore = require("@uniswap/sdk-core");

async function getQuoterContract() {
  try {
    const contract = await new web3.obj.eth.Contract(
      quoterInterface.abi,
      QUOTER_ADDRESS
    );
    return contract;
  } catch (e) {
    console.log(e.message + " getQuoterContract failed");
    throw Error(e.message + " => getQuoterContract failed");
  }
}

const WETH_TOKEN = new unicore.Token(
  69,
  "0x4200000000000000000000000000000000000006",
  18,
  "WETH",
  "Wrapped Ether"
);

const USDC_TOKEN = new unicore.Token(
  69,
  "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
  6,
  "USDC",
  "USD//C"
);

function getPool() {
  const poolAddress = univ3sdk.computePoolAddress({
    factoryAddress: FACTORY_ADDRESS,
    tokenA: WETH_TOKEN,
    tokenB: USDC_TOKEN,
    fee: 500,
  });
  console.log("poolAddress=", poolAddress);
  return poolAddress;
}

async function getPoolContract(pool) {
  try {
    const contract = await new web3.obj.eth.Contract(poolInterface.abi, pool);
    console.log("Pool Contract", contract);
    return contract;
  } catch (e) {
    console.log(e.message + " getPoolContract failed");
    throw Error(e.message + " => getPoolContract failed");
  }
}
