var nodemailer = require("nodemailer");
require("dotenv").config();

const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

//*********************************************************************
// nodemailer
//*********************************************************************
var transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "phdlance@gmail.com",
    pass: GMAIL_APP_PASSWORD,
  },
});

var mailOptions = {
  from: "phdlance@gmail.com",
  to: "phdlance@gmail.com",
  subject: "Pool Protocol: ",
  text: "That was easy!",
};

function setToOption(to) {
  mailOptions.to = to;
}

async function sendMail(subject, text) {
  mailOptions.subject += subject;
  mailOptions.text = text;
  transporter.sendMail(mailOptions, function (e, info) {
    if (e) {
      console.log(error);
    } else {
      console.log("Email sent with subject " + subject);
      throw Error(e + " => sendMail failed");
    }
  });
}

const emailTo = [
  {
    name: "default",
    email: "phdlance@gmail.com,michael.tokuda17@gmail.com",
  },
  {
    name: "family",
    email: "phdlance@gmail.com,michael.tokuda17@gmail.com",
  },
  {
    name: "lance",
    email: "phdlance@gmail.com",
  },
];

function initEmailTo(wname) {
  for (let i = 0; i < emailTo.length; i++) {
    if (wname == emailTo[i].name) {
      setToOption(emailTo[i].email);
      if (wname != "default") mailOptions.subject += "[" + wname + "] ";
      return;
    }
  }
  throw Error("Wallet " + wname + " not found");
}

module.exports = Object.assign({ initEmailTo, sendMail });
