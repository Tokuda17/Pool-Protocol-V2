const fs = require("fs");
const path =
  "/Users/phdlance/Google Drive/My Documents/Finance/Crypto/DeFi Project/lance/alpha/";

function positionRemoved(wname, id) {
  console.log("removing position", id);
  fs.writeFile(path + wname + "/" + id, "", (err) => {
    if (err) {
      console.error(err);
      throw new Error(
        "Could not remove position " +
          wname +
          " " +
          id +
          " => positionRemoved()"
      );
    }
  });
}

function getRemovedPositions(wname) {
  const dir = fs.readdirSync(path + "/" + wname);
  let ids = [];
  dir.forEach((fname) => {
    if (!isNaN(fname)) ids.push(parseInt(fname));
  });
  console.log("removed id list=", ids);
}

positionRemoved("lance", 14);
getRemovedPositions("lance");
