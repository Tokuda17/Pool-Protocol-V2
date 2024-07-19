<?php

$DATA=[];
$COUNTER;
$TARGET_DAILY_VOL=2000000;


function getOneData()
{
  global $DATA, $COUNTER;
  if ($COUNTER>=0)
  {
    $data= $DATA[$COUNTER--];
//echo "\ngetOneData COUNTER=$COUNTER\n\n";
    return $data;
  }
  else
  {
//echo "\ngetOneData=false\n\n";
    $COUNTER--;
    return false;
  }
}

function initData($fname,$offset=0)
{
  global $DATA,$COUNTER,$TARGET_DAILY_VOL;
  $DATA=[];
  echo "Offset=$offset\n";
  $firstPrice = -1;
  if (($handle = fopen($fname, "r")) !== FALSE) {
    while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) 
    {
//   echo "data[0]=" . $data[0] . " data[1]=" . $data[1] . "\n";
      $newdata = [];
      $newdata['price'] = $data[1];
      $newdata['open'] = $data[2];
      $newdata['high'] = $data[3];
      $newdata['low'] = $data[4];
      $newdata['vol'] = $data[5];
      $newdata['change'] = $data[6];
      if($newdata['vol'] != '-')
      {
        $s = substr($newdata['vol'],strlen($newdata['vol'])-1,1);
        //echo "sym=$s\n";
        if (is_numeric($s))
        {
//echo "found NUMERIC\n";
        }
        else 
        {
          $newdata['vol'] = substr($newdata['vol'],0,strlen($newdata['vol'])-1);
          if ($s == 'M')
          {
//echo "found M\n";
            $newdata['vol'] *= 1000000/2;
          }
          else if ($s == 'K')
          {
            $newdata['vol'] *= 1000/2;
//echo "found K\n";
          }
          else
          {
            echo "ERROR: bad symbol in volume data\n";
          }
        }
      }
      else
      {
        $newdata['vol'] = 2000000;
      }
//var_dump($newdata);
      $DATA[] = $newdata;
    }
    fclose($handle);
  }
  $COUNTER=sizeof($DATA)-1-$offset;
  echo "COUNTER=$COUNTER\n";
  $firstPrice = $DATA[$COUNTER]['price'];
  echo "firstPrice=$firstPrice\n";
  $totalVol=0;
  for($i=0;$i <= $COUNTER;$i++)
  {
    $DATA[$i]['price'] /= $firstPrice;
    $totalVol += $DATA[$i]['vol'];
  }
  $volRatio = ($COUNTER+1)*$TARGET_DAILY_VOL/$totalVol*0.8;
  for($i=0;$i <= $COUNTER;$i++)
  {
    $DATA[$i]['vol'] *= $volRatio;
  }
}
  
function printData()
{
  global $DATA;
  for($data = getOneData();$data;$data=getOneData())
  {
    var_dump($data);
  }
}

//initData("AVAXneutral.csv");
//printData();
?>