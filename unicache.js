const fs = require("fs");
const web = require("./web3.js");
const web3 = web.web3;
const UNISWAP_POSITION_PATH =
  "/Users/phdlance/Google Drive/My Documents/Finance/Crypto/DeFi Project/lance/uniswap";
const CACHE_POSITION_PATH =
  "/Users/phdlance/Google Drive/My Documents/Finance/Crypto/DeFi Project/lance/cache";
const TAG_POSITION_PATH =
  "/Users/phdlance/Google Drive/My Documents/Finance/Crypto/DeFi Project/lance/cache";

function writeTagId(tag, id, obj, ch = false) {
  try {
    console.log("writeTagId", tag, id, obj);
    let chain = web3.chain;
    if (ch) chain = ch;
    let json = JSON.stringify(obj);
    let path = CACHE_POSITION_PATH + "/" + chain + "/" + tag;
    fs.mkdirSync(path, { recursive: true });
    //console.log("json=",json);
    //fs.appendFile(path+"/"+id+".json", json+"\n\n", err => {
    fs.writeFile(path + "/" + id + ".json", json, (err) => {
      if (err) {
        console.error(err);
        throw new Error("Could write to " + id + " => fs.writeFile()");
      }
    });
  } catch (e) {
    console.log(e.message + " => writeTagId() failed");
    throw new Error(e.message + " => writeTagId() failed");
  }
}

function readTagId(tag, id, ch = false) {
  try {
    let chain = web3.chain;
    if (ch) chain = ch;
    const path =
      CACHE_POSITION_PATH + "/" + chain + "/" + tag + "/" + id + ".json";
    console.log("readTagId", id, path);
    const e = fs.existsSync(path);
    if (e) {
      //console.log("file exists, reading file");
      const data = fs.readFileSync(path);
      if (data.length == 0) return false;
      const json = JSON.parse(data);
      //console.log("read found",json);
      return json;
    } else return false;
  } catch (e) {
    console.log(e.message + " => readTagId() failed");
    throw new Error(e.message + " => readTagId() failed");
  }
}

function removeTagId(tag, id, ch = false) {
  try {
    //console.log("REMOVETAGID from cache",id);
    let chain = web3.chain;
    if (ch) chain = ch;
    const path =
      CACHE_POSITION_PATH + "/" + chain + "/" + tag + "/" + id + ".json";
    const e = fs.existsSync(path);
    if (e) {
      console.log("removeTagId removing from cache", id, path);
      fs.unlink(path, (err) => {
        if (err) {
          console.log(err);
          throw new Error(err + " => unlink failed");
        } else {
          console.log("unlink: " + id + ".json removed");
        }
      });
      console.log("removed");
    } else {
      throw new Error("Bad index number in removeTagId: " + id);
    }
  } catch (e) {
    console.log(e.message + " => removeTagId() failed");
    throw new Error(e.message + " => removeTagId() failed");
  }
}

function removeUniswapId(wname, i) {
  try {
    //console.log("REMOVEUNISWAPID from cache",i);
    const chain = web3.chain;
    const path =
      UNISWAP_POSITION_PATH + "/" + chain + "/" + wname + "/" + i + ".json";
    const e = fs.existsSync(path);
    if (e) {
      console.log("removeUniswapId removing from cache", i, path);
      fs.unlink(path, (err) => {
        if (err) {
          console.log(err);
          throw new Error(err + " => unlink failed");
        } else {
          console.log("unlink: " + i + ".json removed");
        }
      });
      console.log("removed");
    } else {
      throw new Error("Bad index number in removeUniswapId: " + i);
    }
  } catch (e) {
    console.log(e.message + " => removeUniswapId() failed");
    throw new Error(e.message + " => removeUniswapId() failed");
  }
}

function readUniswapId(wname, i) {
  try {
    const chain = web3.chain;
    const path =
      UNISWAP_POSITION_PATH + "/" + chain + "/" + wname + "/" + i + ".json";
    const e = fs.existsSync(path);
    if (e) {
      const data = fs.readFileSync(path);
      const json = JSON.parse(data);
      console.log("read found", json);
      return json;
    } else return false;
  } catch (e) {
    console.log(e.message + " => readUniswapId() failed");
    throw new Error(e.message + " => readUniswapId() failed");
  }
}

function checkUniswapId(wname, i) {
  try {
    let p = readUniswapId(wname, i);
    if (p) {
      return p.tid;
    } else return false;
  } catch (e) {
    console.log(e.message + " => checkUniswapId() failed");
    throw new Error(e.message + " => checkUniswapId() failed");
  }
}

function saveObj(tag, obj) {
  let json = JSON.stringify(obj);
  saveFile(tag, json);
}

function saveFile(tag, s) {
  try {
    let now = Math.floor(Date.now() / 1000);
    let day = Math.floor(now / 100000);
    let hour = Math.floor((now - day * 100000) / 1000);
    let sec = now % 1000;
    if (sec <= 9) sec = "00" + sec;
    else if (sec <= 99) sec = "0" + sec;
    let path = TAG_POSITION_PATH + "/" + tag + "/" + day + "/" + hour;
    fs.mkdirSync(path, { recursive: true });
    fs.appendFile(path + "/" + sec, s + "\n\n", (err) => {
      if (err) {
        console.error(err);
        throw new Error("Could write to " + tag + " => fs.writeFile()");
      }
    });
  } catch (e) {
    console.log(e.message + " => saveFile() failed");
    throw new Error(e.message + " => saveFile() failed");
  }
}

function writeUniswapId(wname, i, tid, tickLower, tickUpper, liquidity, fee) {
  try {
    let chain = web3.chain;
    //    console.log("write Uniswap Id", wname, i, tid, tickLower, tickUpper, liquidity);
    let obj = {
      tid: tid,
      tickLower: tickLower,
      tickUpper: tickUpper,
      liquidity: liquidity,
      fee: fee,
    };
    let json = JSON.stringify(obj);
    let path = UNISWAP_POSITION_PATH + "/" + chain + "/" + wname;
    fs.mkdirSync(path, { recursive: true });
    fs.writeFile(path + "/" + i + ".json", json, (err) => {
      if (err) {
        console.error(err);
        throw new Error(
          "Could write to " + wname + " " + i + " => fs.writeFile()"
        );
      }
    });
  } catch (e) {
    console.log(e.message + " => writeUniswapId() failed");
    throw new Error(e.message + " => writeUniswapId() failed");
  }
}

module.exports = Object.assign({
  saveFile,
  saveObj,
  writeTagId,
  removeTagId,
  readTagId,
  removeUniswapId,
  checkUniswapId,
  readUniswapId,
  writeUniswapId,
});
