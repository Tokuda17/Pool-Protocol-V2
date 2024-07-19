<?php

// $numToken[1] = $1.00 stablecoin
// $8.5M liquidity based on TraderJoe USDC.e-AVAX pool with $2M traded daily
$numToken=[];
$totalVolume=0;
$INITIAL_LIQUIDITY = 4250000;
$FEE = 0.0030;

function getLiquidity($amount)
{
  global $numToken;

echo "numToken0 = $numToken[0] numToken[1] = $numToken[1]\n";
  return $amount/($numToken[0]*quote(0)+$numToken[1]*quote(1));
}
function getLiquidityToken($liq,$token)
{
  global $numToken;
  return $numToken[$token] * $liq;
}

function initSwap()
{
  global $totalVolume, $numToken, $INITIAL_LIQUIDITY;
  $totalVolume = 0;
  $numToken = [0 => $INITIAL_LIQUIDITY, 1 => $INITIAL_LIQUIDITY];
echo "numToken0 = $numToken[0] numToken[1] = $numToken[1]\n";
}

function liquidityTotal()
{
  global $numToken, $totalVolume;
  $total = quote(0) * $numToken[0] + quote(1) * $numToken[1];
  echo "AVAX tokens = " . $numToken[0] . " AVAX price = " . quote(0) . "\n";
  echo "USDC = " . $numToken[1] . " USDC price = " . quote(1) . "\n";
  echo 'Total liquidity = ' . $total . ' Total volume = ' . $totalVolume . "\n";
  return $total;
}

function quote($token)
{
  global $numToken;
  $tokens = $numToken[$token];
  if ($token == 0)
    $price = $numToken[1]/$numToken[0];
  else
    $price = 1.0;
  return $price;
}

function getVolume()
{
  global $totalVolume;
  return $totalVolume;
}

function swap($fromToken, $toToken, $amount)
{
  global $FEE;
  if ($amount < 0) 
  {
    echo "**** AMOUNT = " . $amount . "\n";
    exit(1);
  }
  global $numToken;
  global $totalVolume;
  if ($fromToken == 0)
  {
    echo "SELLING AVAX=$amount\n";
    $toToken == 1;
  }
  else
  {
    echo "BUYING AVAX=$amount\n";
    $toToken = 0;
  }
  $toTokens = (float) $numToken[$toToken] - $numToken[0]*$numToken[1] / ($numToken[$fromToken]+$amount);
  $toTokens *= (float) (1.0 - $FEE);
  $numToken[$fromToken] += (float) $amount;
  $numToken[$toToken] -= (float) $toTokens;
  $totalVolume += $amount * quote($fromToken);
  //echo "fromTokens = " . $numToken[$fromToken] . "\n";
  //echo "fromToken price = " . quote($fromToken) . "\n";
  //echo "toTokens = " . $numToken[$toToken] . "\n";
  //echo "toToken price = " . quote($toToken) . "\n";
  //echo "LIQUIDITY AVAX=" . quote(0)*$numToken[0] . " USDC=" . quote(1)*$numToken[1] . "\n";
  return $toTokens;
}

