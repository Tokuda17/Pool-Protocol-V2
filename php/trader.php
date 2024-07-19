<?php

require_once(__DIR__ . "/swapper.php");
require_once(__DIR__ . "/data.php");

$SHORT= 0.012;
$PRICE_THRESHOLD=0.012;
$VOL_THRESHOLD=10000;
$LIQUIDITY = (float) 200000;

$tradeHistory=[];

function initTradeHistory()
{
  global $tradeHistory;
  $tradeHistory = [];
}

function addTradeHistory($l,$debt0,$debt1,$numtrades,$myTrades,$buysell,$amount,$price)
{
  global $tradeHistory;
  $tradeHistory[] = [ 
    "volume" => getVolume(),
    "l" => liquidityTotal(), 
    "tj0" => getLiquidityToken($l,0), 
    "tj1" => getLiquidityToken($l,1), 
    "debt0" => $debt0,
    "debt1" => $debt1,
    "numtrades" => $numtrades,
    "myTrades" => $myTrades,
    "buysell" => $buysell,
    "amount" => $amount,
    "price" => $price,
    "net" => (getLiquidityToken($l,0)+$debt0)*quote(0) + (getLiquidityToken($l,1)+$debt1)*quote(1)
  ];
}

function printTradeHistory()
{
  global $tradeHistory;
  var_dump($tradeHistory);
}

function printTotalPosition($l,$debt0, $debt1,$numtrades)
{
  global $LIQUIDITY;
  $l0 = getLiquidityToken($l,0);
  $l1 = getLiquidityToken($l,1);
  $v0 = $l0 * quote(0);
  $v1 = $l1 * quote(1);
  $b0 = $debt0 * quote(0);
  $b1 = $debt1 * quote(1);
  echo "\n";
  echo "TraderJoe AVAX($l0)=$v0 USDC($l1)=$v1 total=" . ($v0+$v1) . "\n";
  echo "Aave debt AVAX($debt0)=$b0 USDC($debt1)=$b1 total=" . ($b0+$b1) . "\n";
  echo "Net AVAX=" . ($b0+$v0) . " USDC=" . ($b1+$v1) . " Price=" . quote(0) . "\n";
  echo "NET=" . $v0+$v1+$b0+$b1 . " numtrades=$numtrades volume= " . getVolume() . "\n";
  echo "\n";
  return $v0+$v1+$b0+$b1;
}

function checkStrategy2($l,&$debt0,&$debt1,$numtrades,&$lastTradeVolume,&$myTrades)
{
  global $SHORT, $PRICE_THRESHOLD, $VOL_THRESHOLD;
  $t0 = getLiquidityToken($l,0) * quote(0)*(1+$SHORT);
  $t1 = getLiquidityToken($l,1) * quote(1);
  $b0 = $debt0 * quote(0);
  $b1 = $debt1 * quote(1);
  echo "Strategy: 1 t0=$t0 t1=$t1 b0=$b0 b1=$b1\n";
  printTotalPosition($l, $debt0, $debt1,$numtrades);
  if (getVolume() - $lastTradeVolume > $VOL_THRESHOLD)
  {
    if ($t0 > -$b0 * ($PRICE_THRESHOLD + 1))
    {
      echo 'You are long AVAX $' . $t0+$b0 . "\n";
      $num=($t0 + $b0)/quote(0);
      $debt0 -= $num;
      $debt1 += swap(0,1,$num);
      $myTrades++;
      echo "Selling AVAX " . $num . " tokens myTrades=$myTrades\n";
      $lastTradeVolume=getVolume();
//function addTradeHistory($l,$debt0,$debt1,$numtrades,$myTrades,$buysell,$amount,$price)
      addTradeHistory($l,$debt0,$debt1,$numtrades,$myTrades,"SELL",$num,quote(0));
//readline();
    }
    else if (-$b0 > $t0 * ($PRICE_THRESHOLD + 1))
    {
      echo "You are short AVAX $" . -$b0-$t0 . "\n";
      $num=(-$b0-$t0)/quote(1);
      $debt1 -= $num;
      $debt0 += swap(1,0,$num);
      $myTrades++;
      echo "Buying AVAX " . $num . " tokens myTrades=$myTrades\n";
      $lastTradeVolume=getVolume();
      addTradeHistory($l,$debt0,$debt1,$numtrades,$myTrades,"BUY",$num,quote(0));
//readline();
    }
  }
  //echo "You own $debt0 token 0 and $debt1 token 1 = " . ($debt0*quote(0)+$debt1*quote(1)) . "\n";
  $t0 = getLiquidityToken($l,0) * quote(0)*(1+$SHORT);
  $t1 = getLiquidityToken($l,1) * quote(1);
  $b0 = $debt0 * quote(0);
  $b1 = $debt1 * quote(1);
  echo "Strategy 2: t0=$t0 t1=$t1 b0=$b0 b1=$b1\n";

  printTotalPosition($l, $debt0, $debt1,$numtrades);
}

// day volume for TraderJoe USDC.e/AVAX pool is ~$2m
function trade()
{
  global $SHORT, $LIQUIDITY, $TARGET;

  srand(1);
  $myTrades=0;
  $dayVolumeTarget=2000000;
  $volume = 2000000*365;
  initSwap();
  $directions = 1;
  $numtrades=0;
  $myTrades=0;
  $maxtrades=1000000;
  initTradeHistory();

  $l = getLiquidity($LIQUIDITY);

  $debt0 = -getLiquidityToken($l,0);
  $debt1 = -getLiquidityToken($l,1);
  $c=0;
  $lastTradeVolume=0;

  printTotalPosition($l, $debt0, $debt1,$numtrades);
  //readline();

  $AVAXTokens = (float) -$debt0*$SHORT;
echo "Selling $AVAXTokens shorted AVAX tokens\n";
  $USDCTokens = swap(0,1,$AVAXTokens);
echo "debt0=$debt0 AVAXTokens=$AVAXTokens USDCTokens=$USDCTokens\n";
  $debt0 -= $AVAXTokens;
  $debt1 += $USDCTokens;
  printTotalPosition($l, $debt0, $debt1,$numtrades);

  initData("AVAXneutral.csv");


  $targets=0;
  for($data=getOneData();$data;$data=getOneData())
  {
    $targets++;
    //var_dump($data);
    $TARGET = $data['price'];
    if (quote(0) > $TARGET)
    {
      echo "DIRECTION is DOWN, TARGET=$TARGET\n";
      $direction = -1;
    }
    else
    {
      echo "DIRECTION is UP, TARGET=$TARGET\n";
      $direction = 1;
    }
    $volume=$data['vol'];
    $v = 0;
    while(1)
    { 
      $r = rand(0,30);
      if (quote(0) < $TARGET)
      {
        $r -= 24;
//  echo "** quote is LESS " . quote(0) . " than target $TARGET\n";
        //$r=-14;
      }
      else
      {
        $r -= 6;
//  echo "** quote is GREATER " . quote(0) . " than target $TARGET\n";
        //$r=10;
      }
      if ($r < 0)
      {
        $value = -$r * 1000;
        $v+=$value/quote(1);
        swap(1,0,$value/quote(1));
      }
      else if ($r > 0)
      {
        $value = $r * 1000;
        $v+=$value/quote(0);
        swap(0,1,$value/quote(0));
      }
      else
        $value=0;
      echo "volume=$v VOLUME=$volume\n";
  
      checkStrategy2($l,$debt0,$debt1,$numtrades,$lastTradeVolume,$myTrades);

      $numtrades++;
 //     printTotalPosition($l, $debt0, $debt1,$numtrades);
      if ($numtrades > $maxtrades) break;

      if (($direction ==  1 && quote(0) > $TARGET ||
           $direction == -1 && quote(0) < $TARGET) &&
          ($v>=$volume))
      {
        break;
      }
  
    } 
    echo "TARGETS=$targets\n";
    echo "TRADES=" . $numtrades . " MY TRADES=$myTrades \n";
    echo "DIRECTIONS=" . $directions . " \n";
  }
  $net=printTotalPosition($l, $debt0, $debt1,$numtrades);
  echo "net=$net LIQUIDITY=$LIQUIDITY TARGETS=$targets\n";
  echo "NET = " . round(pow((1+$net/$LIQUIDITY), 365/$targets)*100)-100 . "% APY\n";
  //printTradeHistory();
}

trade();

?>