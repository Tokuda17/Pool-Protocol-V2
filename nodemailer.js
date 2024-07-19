var nodemailer = require("nodemailer");
require("dotenv").config();

//
let GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
//GMAIL_APP_PASSWORD = process.env.PHDLANCE_GMAIL_APP_PASSWORD;

const subjectStart = "Pool Protocol: ";

//*********************************************************************
// nodemailer
//*********************************************************************
var transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "kandlrealtyllc@gmail.com",
    //    user: 'phdlance@gmail.com',
    pass: GMAIL_APP_PASSWORD,
  },
});

var mailOptions = {
  from: "phdlance@gmail.com",
  to: "phdlance@gmail.com",
  subjectStart: subjectStart,
  text: "That was easy!",
};

function setSubjectStartOption(ss) {
  mailOptions.subjectStart = ss;
}
function setToOption(to) {
  mailOptions.to = to;
}

async function sendMail(subject, text) {
  mailOptions.subject = mailOptions.subjectStart + subject;
  mailOptions.text = text;
  //console.log("sendMail mailOptions=",mailOptions);
  transporter.sendMail(mailOptions, function (e, info) {
    if (e) {
      console.log(e);
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
  {
    name: "michael",
    email: "michael.tokuda17@gmail.com",
  },
  {
    name: "poly",
    email: "phdlance@gmail.com",
  },
  {
    name: "op",
    email: "phdlance@gmail.com",
  },
  {
    name: "multi",
    email: "phdlance@gmail.com",
  },
];

function init(wname) {
  for (let i = 0; i < emailTo.length; i++) {
    if (wname == emailTo[i].name) {
      setToOption(emailTo[i].email);
      if (wname != "default")
        mailOptions.subjectStart = subjectStart + "[" + wname + "] ";
      return;
    }
  }
  throw Error("Wallet " + wname + " not found");
}

function getMailOptions() {
  return mailOptions;
}

module.exports = Object.assign({
  init,
  sendMail,
  setSubjectStartOption,
  getMailOptions,
  setToOption,
});
