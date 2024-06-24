const mongoose = require("mongoose");
const GetInTouch = require("../models/getInTouch.model");
const nodemailer = require("nodemailer");
const sgMail = require('@sendgrid/mail');

// var transport = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: 465,
//     secure: true,
//     auth: {
//         user: process.env.EMAIL_NAME,
//         pass: process.env.EMAIL_PASSWORD
//     },
//     requireTLS: true,
// });

module.exports = {
    create: async (req, res, next) => {
        try {
            const getIntouchData = new GetInTouch(req.body)
            const result = await getIntouchData.save();


            let getData = await GetInTouch.findOne({ _id: result?._id });


            let getName = getData?.name;
            let getEmail = getData?.emailId;
            let getSubject = getData?.subject;
            let getQuery = getData?.query;


            //     var mailOptions = {
            //         from: getEmail,
            //         to: 'Info@hire2inspire.com',
            //         subject: `${getSubject}`,
            //         html: `
            //     <body>
            //         <p>Dear Hire2Inspire,</p>
            //         <p>${getQuery}</p>
            //         <p>Thank you and best regards,</p>
            //         <p> ${getName} </p>
            //     </body>
            // `
            //     };
            //     transport.sendMail(mailOptions, function (error, info) {
            //         if (error) {
            //             console.log(error);
            //         } else {
            //             console.log('Email sent: ' + info.response);
            //         }
            //     });



            sgMail.setApiKey(process.env.SENDGRID)
            const new_msg = {
                // to: 'hire2inspireh2i@gmail.com', // Change to your recipient
                to: 'info@hire2inspire.com',
                from: 'info@hire2inspire.com', // Change to your verified sender
                subject: "User Query",
                html: `
            <head>
            
                <title>Notification:User Query</title>
            </head>
            <body>

                    <p>Dear Admin,</p>

                    <p>I hope this email finds you well. I recently received a user query that requires your attention and expertise. Below are the details of the query:</p>

                    <ul>
                        <li><strong>User's Name:</strong> ${getName}</li>
                        <li><strong>User's Email:</strong> ${getEmail}</li>
                        <li><strong>Nature of Query:</strong> ${getQuery}</li>
                    </ul>


                    <p>I have attempted to address the user's concerns to the best of my ability, but I believe your input and guidance would be valuable in resolving this matter efficiently.</p>

                    <p>Please let me know when you have the opportunity to review this query, and if there's any specific information you require from me.</p>

                    <p>Thank you for your prompt attention to this matter.</p>

                    <p>Best regards,</p>
                    <p>${getName}<br>
                </body>         
                `
            }
            sgMail
                .sendMultiple(new_msg)
                .then(() => {
                    console.log('Email sent')
                })
                .catch((error) => {
                    console.error(error)
                })


            return res.status(200).send({
                error: false,
                message: "We will respond in 2 business days",
                data: result
            })
        } catch (error) {
            next(error)
        }
    },

    //  testmail : async(req,res,next) =>{
    //     try {
    //       sgMail.setApiKey(process.env.SENDGRID);
    //       console.log("calling......................")
    //       const new_msg = {
    //         // to: "info@hire2inspire.com", // Change to your recipient
    //         // from: "subhra.onenesstechs@gmail.com", // Change to your verified sender
    //         to: "info@hire2inspire.com", // Change to your recipient
    //         from: "info@hire2inspire.com", // Change to your verified sender
    //         subject: "User Query",
    //         html: `
    //         <head>
            
    //             <title>Notification:User Query</title>
    //         </head>
    //         <body>

    //                 <p>Dear Admin,</p>

    //                 <p>I hope this email finds you well. I recently received a user query that requires your attention and expertise. Below are the details of the query:</p>

                    


    //                 <p>I have attempted to address the user's concerns to the best of my ability, but I believe your input and guidance would be valuable in resolving this matter efficiently.</p>

    //                 <p>Please let me know when you have the opportunity to review this query, and if there's any specific information you require from me.</p>

    //                 <p>Thank you for your prompt attention to this matter.</p>

    //                 <p>Best regards,</p>
                    
    //             </body>         
    //             `,
    //       };
    //       sgMail
    //         .sendMultiple(new_msg)
    //         .then(() => {
    //           console.log("Email sent");
    //         })
    //         .catch((error) => {
    //           console.error(error);
    //         });

    //       return res.status(200).send({
    //         error: false,
    //         message: "We will respond in 2 business days",
    //         // data: result,
    //       });
    //     } catch (error) {
    //       next(error);
    //     }
     }
}

