const mongoose = require("mongoose");
const GetInTouch = require("../models/getInTouch.model");
const nodemailer = require("nodemailer");

var transport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_NAME,
        pass: process.env.EMAIL_PASSWORD
    },
    requireTLS: true,
});

module.exports = {
    create: async (req, res, next) => {
        try {
            const getIntouchData = new GetInTouch(req.body)
            const result = await getIntouchData.save();


            let getData = await GetInTouch.findOne({_id:result?._id});


            let getName = getData?.name;
            let getEmail = getData?.emailId;
            let getSubject = getData?.subject;
            let getQuery = getData?.query


            var mailOptions = {
                from: getEmail,
                to: 'info@hire2inspire.com',
                subject: `${getSubject}`,
                html:`
            <body>
                <p>Dear Hire2Inspire,</p>
                <p>${getQuery}</p>
                <p>Thank you and best regards,</p>
                <p> ${getName} </p>
            </body>
        `
 };   
            transport.sendMail(mailOptions, function(error, info){
                if (error) {
                  console.log(error);
                } else {
                  console.log('Email sent: ' + info.response);
                }
            });


            return res.status(200).send({
                error: false,
                message: "Thank you for submit your query",
                data: result
            })
        } catch (error) {
            next(error)
        }
    },
}
