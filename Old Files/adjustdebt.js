//Imports

require("dotenv").config();
var BigNumber = require("big-number");
const erc = require("../erc20");
const aave = require("../aave");
const inch = require("../1inch");
const np = require("./netPosition");

async function adjustDebt(debtTokenSym, amount, tokenToSym, walletAddress) {
  try {
    //getting contracts
    const debtTokenMap = await aave.getDebtTokenMap();
    let decimals;
    let debtTokenFrom;

    amount = Math.floor(amount * 1000000);
    const tokenTo = np.addressMap.get(tokenToSym);
    for (let i = 0; i < debtTokenMap.length; i++) {
      if (debtTokenMap[i].symbol == debtTokenSym) {
        debtTokenFrom = debtTokenMap[i].token;
        decimals = debtTokenMap[i].decimals - 6;
        break;
      }
    }
    const minimum = BigNumber(10)
      .pow(decimals + 6)
      .toString();

    amount = BigNumber(amount).mult(BigNumber(10).pow(decimals)).toString();
    console.log(debtTokenFrom);
    console.log(amount);
    console.log(tokenTo);
    const debtTokenContract = await aave.getDebtTokenContract(debtTokenFrom); //gets debt token contract
    const poolContract = await aave.getPoolContract(); // gets pool contract
    const tokenFrom = await aave.debtTokenUnderlyingAssetAddress(
      debtTokenContract
    );
    //gets the underlying address of the debt token
    const tokenFromContract = await erc.getContract(tokenFrom); //gets the token contract of the from token using the underlying address
    const tokenToContract = await erc.getContract(tokenTo); //gets the token contract of the to address
    //check to see if Adjust Debt it possible
    const amountOfTokensFromInWallet = await erc.balanceOf(
      tokenFromContract,
      walletAddress
    ); //get balance of tokens from in wallet

    let borrowAmount = await Math.floor(
      BigNumber(amount).minus(BigNumber(amountOfTokensFromInWallet)).toString()
    );
    //subtract the balance of wallet from the amount that is needed to be borrowed.
    const amountOfTokensToInWallet = await erc.balanceOf(
      tokenToContract,
      walletAddress
    ); //get balance of tokens to in wallet
    tokensToRepay = await Math.floor(
      await aave.convertFromTokenToToken(tokenFrom, tokenTo, amount)
    );
    const amountOfTokensNeededToRepay = await BigNumber(tokensToRepay)
      .minus(BigNumber(amountOfTokensToInWallet))
      .toString(); //get the remaining amount of tokens needed to repay
    const convertedToken = await aave.convertFromTokenToToken(
      tokenTo,
      tokenFrom,
      amountOfTokensToInWallet
    );

    if (amountOfTokensNeededToRepay < minimum) borrowAmount = -1;
    //if you already have enough tokens to repay then you do not need to borrow any
    else {
      borrowAmount = await BigNumber(borrowAmount)
        .minus(BigNumber(convertedToken))
        .toString(); //decreases the amount of tokens needed to borrow since you already have some
    }
    const borrowMoney = await aave.canBorrowMoney(
      tokenFrom,
      borrowAmount,
      walletAddress
    ); //checks if borrowing money is allowed based on liquidation
    const availableDebtToRepay = await aave.isDebtAvailableToRepay(
      //checks if there is enough debt to repay
      tokenFrom,
      amount,
      tokenTo,
      walletAddress
    );
    console.log(borrowMoney);
    console.log(availableDebtToRepay);
    //if repayAmount < 0 set borrow amount to -1, ignore swap, convert amountFrom to AmountTo, repay that
    if (!borrowMoney) throw Error("Not enough collateral in wallet"); //change to throwing error, im not sure how to do this.
    if (!availableDebtToRepay) throw Error("Not enough debt in wallet");
    if (borrowAmount > minimum) {
      //execute adjustDebt
      //if borrow amount is less than 0 we skip this step
      console.log("Borrowing from aave");
      await aave.borrow(
        poolContract,
        debtTokenFrom,
        borrowAmount,
        walletAddress
      );
    }
    if (amountOfTokensNeededToRepay > minimum) {
      //if amount needed to repay is less than 0 we skip this step
      console.log("swapping on Uniswap");
      const repayAmount = await Math.floor(
        Math.min(
          (BigNumber(amount).minus(BigNumber(convertedToken)).toString(),
          await erc.balanceOf(tokenFromContract, walletAddress))
        )
      );
      await inch.swap(
        tokenFromContract,
        tokenFrom,
        tokenTo,
        repayAmount,
        walletAddress
      );
    }
    console.log("repaying on aave");
    tokensToRepay = Math.floor(
      //Math.floor to prevent decimal errors inside of solidity
      Math.min(
        await erc.balanceOf(tokenToContract, walletAddress),
        tokensToRepay
      ).toString() //incase there are not enough tokens in the wallet due to slippage, i take the minimum of the two
    );
    await aave.repay(
      poolContract,
      tokenToContract,
      tokenTo,
      tokensToRepay,
      walletAddress
    );
    console.log("DEBT ADJUSTED!!!");
  } catch (e) {
    console.log("Error Adjusting debt: " + e.message);
    throw new Error("calculateNetPositions failed");
  }
}

module.exports = Object.assign({
  adjustDebt,
});
