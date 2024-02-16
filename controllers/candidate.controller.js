const createError = require('http-errors')
const CandidateModel = require('../models/candidate.model');
const AgencyJobModel = require('../models/agency_job.model');
const CandidateJobModel = require('../models/candidate_job.model');
const Recruiter = require('../models/recruiter.model');
const { getUserViaToken } = require('../helpers/jwt_helper');
const Agency = require('../models/agency.model');
const JobPosting = require("../models/job_posting.model");
const ObjectId = require('mongoose').Types.ObjectId;
var admin = require("firebase-admin");
var serviceAccount = require("../hire2inspire-firebase-adminsdk.json");
const express = require('express')
const app = express();
const nodemailer = require("nodemailer");
const sgMail = require('@sendgrid/mail');

// var transport = nodemailer.createTransport({
//     host: 'smtp.zoho.in',
//     port: 465,
//     secure: true,
//     auth: {
//         user: 'Info@hire2inspire.com',
//         pass: '17X2DnJJiQmm'
//     },
//     requireTLS: true,
// });



admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.BUCKET_URL
});
app.locals.bucket = admin.storage().bucket()

module.exports = {
    /**
     * This method is to submit candidate 
     */
    submitCandidate: async (req, res, next) => {
        try {
            let token = req.headers["authorization"]?.split(" ")[1];
            let { userId, dataModel } = await getUserViaToken(token);
            const checkAgency = await Agency.findOne({ _id: userId });
            const checkRecruiter = await Recruiter.findOne({ _id: userId });
            if (
                (!checkAgency || !checkRecruiter) &&
                !["agency", "recruiters"].includes(dataModel)
            ) return res.status(401).send({ error: true, message: "User unauthorized." })

            // Checking the corresponding agency job exist or not
            const agencyJobExist = await AgencyJobModel.findOne({ _id: req.body.agency_job });

            console.log("agencyJobExist", agencyJobExist)

            // if corresponding agency job not exist
            if (!agencyJobExist) return res.status(400).send({ error: true, message: "AGgency job does not exist" });

            // Checking the candidate exist or not
            // const candidateExist = await CandidateModel.findOne({email:req.body.email});
            // const candidateExist1 = await CandidateModel.findOne({phone:req.body.phone})

            let candidateExist = await CandidateModel.findOne({ $and: [{ email: req.body.email }, { agency_job: req.body.agency_job }] });
            let candidateExist1 = await CandidateModel.findOne({ $and: [{ phone: req.body.phone }, { agency_job: req.body.agency_job }] });

            console.log("candidate>>>>>", candidateExist)
            console.log("candidate.id", candidateExist?.agency_job)
            console.log('patrams', req.body.agency_job);
            console.log('candidateExist1', candidateExist1);
            console.log("body", req.body);

            if (candidateExist?.agency_job == req.body.agency_job) {
                console.log('in..')
                return res.status(400).send({ error: true, message: `Candidate data already exist with this email ${candidateExist?.email}` })
            }
            else if (candidateExist1?.agency_job == req.body.agency_job) {
                return res.status(400).send({ error: true, message: `Candidate data already exist with this phone no ${candidateExist1?.phone}` })
            }

            // if candidate exist


            // if corresponding agency job exist and candidate not exist
            // Submit candidate here
            req.body.agency = agencyJobExist.agency
            req.body.recruiter = checkRecruiter?._id || undefined
            req.body.job = agencyJobExist.job

            // console.log("1", req.body);
            const candidateData = new CandidateModel(req.body)
            // console.log("2", candidateData);

            const candidateDataResult = await candidateData.save()

            const agencyJobUpdate = await AgencyJobModel.findOneAndUpdate({ _id: agencyJobExist._id }, { $push: { candidates: candidateDataResult._id } }, { new: true })

            req.body.emp_job = candidateDataResult?.job;
            req.body.agency_id = candidateDataResult?.agency;
            req.body.candidate = candidateDataResult?._id;

            const candidateJobData = new CandidateJobModel(req.body)

            const candidateJob = await candidateJobData.save();

            const candidatejobdata = await CandidateJobModel.findOne({ _id: candidateJob?._id }).populate([
                {
                    path: "emp_job",
                    select: ""
                }
            ])


            const candidatelist = await CandidateModel.findOne({ _id: candidateDataResult?._id });
            //console.log("agengydata>>>>",agengydata)

            let candidateEmail = candidatelist?.email;
            let candidatefName = candidatelist?.fname;
            let candidatelName = candidatelist?.lname;

            let companyName = candidatejobdata?.emp_job?.comp_name;

            let jobRole = candidatejobdata?.emp_job?.job_name;

            let jobId = candidatejobdata?.emp_job;

            let candidateId = candidatejobdata?.candidate;

            console.log("candidateEmail>>>>", candidateEmail)

            sgMail.setApiKey(process.env.SENDGRID)
            const msg = {
                to: candidateEmail, // Change to your recipient
                from: 'info@hire2inspire.com',
                subject: `Your Talent Spark: Ignite Opportunity with ${companyName}`,
                html: `
                       <head>
                           <title>Notification: Candidate Hired - Backend Development Position</title>
                   </head>
                   <body>
                       <p>Dear ${candidatefName} ${candidatelName} ,</p>
                       <p>I hope this email finds you well. I am writing to confirm that we have received your application for the ${jobRole} at ${companyName}. We appreciate your interest in joining our team and taking the time to submit your CV. Your application is currently being reviewed by our recruitment team.</p>
       
                       <p>As we move forward in the selection process, we would like to gather some additional information from you. Please take a moment to answer the following screening questions. Your responses will help us better understand your qualifications and suitability for the role. Once we review your answers, we will determine the next steps in the process.</p>
       
                       <p>Find the link 
                       <a href="https://hire2inspire.com/candidate/apply-job/${candidateId}" target="blank">Find your job</a>
                     </p>
       
                       <p>Best regards,</p>
                       <p>Hire2Inspire</p>
                   </body>
               `
            }

            sgMail
                .send(msg)
                .then(() => {
                    console.log('Email sent')
                })
                .catch((error) => {
                    console.error(error)
                })

            if (candidateDataResult) {
                return res.status(201).send({
                    error: false,
                    message: "Candidate submitted",
                    data: candidateDataResult,
                    candidateJob
                })
            }
            return res.status(400).send({
                error: true,
                message: "Candidate submission failed"
            })
        } catch (error) {
            next(error)
        }
    },

    /**
     * This method is to submit bulk candidate 
     */
    submitBulkCandidate: async (req, res, next) => {
        try {
            let token = req.headers["authorization"]?.split(" ")[1];
            let { userId, dataModel } = await getUserViaToken(token);
            const checkAgency = await Agency.findOne({ _id: userId });
            const checkRecruiter = await Recruiter.findOne({ _id: userId });
            if (
                (!checkAgency || !checkRecruiter) &&
                !["agency", "recruiters"].includes(dataModel)
            ) return res.status(401).send({ error: true, message: "User unauthorized." })

            // Checking the corresponding agency job exist or not
            const agencyJobExist = await AgencyJobModel.findOne({ _id: req.body.agency_job })

            const empJobExist = await JobPosting.findOne({ _id: req.body.job })

            // if corresponding agency job not exist
            if (!agencyJobExist) return res.status(400).send({ error: true, message: "Candidate submission failed" })

            if (!empJobExist) return res.status(400).send({ error: true, message: "Candidate submission failed" })

            // if corresponding agency job exist
            // Submit candidate here
            const candidates = req.body.candidates
            let candidateData = []

            for (let index = 0; index < candidates.length; index++) {
                // console.log("agencyJobExist >>>>>>>>>>>>>>>>>>> ", agencyJobExist);
                // console.log("candidates[index].email >>>>>>>>>>>>>>>>>>>>>>>>>>>> ", candidates[index].email)
                // Checking the candidate exist or not
                // const candidateExist = await CandidateModel.findOne({$and: [{email: candidates[index].email}]})
                const candidateExist = await CandidateModel.findOne({
                    $and: [
                        { job: agencyJobExist.job },
                        {
                            $or: [
                                { email: candidates[index].email },
                                { phone: candidates[index].phone }
                            ]
                        }
                    ]
                });

                const candidateExist1 = await CandidateModel.findOne({
                    $and: [
                        { job: empJobExist?._id },
                        {
                            $or: [
                                { email: candidates[index].email },
                                { phone: candidates[index].phone }
                            ]
                        }
                    ]
                })
                // console.log("candidateExist >>>>>>>>>>>>>>>>>>> ", candidateExist);
                // if candidate exist
                if (candidateExist) return res.status(400).send({ error: true, message: `Candidate data already exist with this email ${candidateExist?.email}` })

                if (candidateExist1) return res.status(400).send({ error: true, message: `Candidate data already exist with this email ${candidateExist?.email}` })


                candidates[index].agency = agencyJobExist.agency
                candidates[index].recruiter = checkRecruiter?._id
                // candidates[index].job = agencyJobExist.job
                candidates[index].job = empJobExist?._id
                candidateData.push(candidates[index])



            }

            // console.log("candidates >>>>>>>>>>>>", candidateData);
            const candidateDataResult = await CandidateModel.insertMany(candidateData);
            const candidatejobData = await CandidateJobModel.insertMany(candidateData);

            console.log({ candidatejobData });

            submitted_candidates_id = candidateDataResult.map(e => e._id)
            const agencyJobUpdate = await AgencyJobModel.findOneAndUpdate({ _id: agencyJobExist._id }, { $push: { candidates: submitted_candidates_id } }, { new: true })
            // console.log("agencyJobUpdate >>>>>>>>>>>> ", agencyJobUpdate);
            console.log({ candidateDataResult });

            if (candidateDataResult.length) {
                return res.status(201).send({
                    error: false,
                    message: "Candidate data submitted",
                    data: candidateDataResult
                })
            } else if (candidatejobData.length) {
                return res.status(201).send({
                    error: false,
                    message: "Candidate data submitted",
                    data: candidatejobData
                })
            }
            return res.status(400).send({
                error: true,
                message: "Candidate submission failed"
            })
        } catch (error) {
            next(error)
        }
    },

    /**
     * This method is used to update candidate status
     */
    statusUpdate: async (req, res, next) => {
        try {
            // Status update
            const candidateData = await CandidateModel.findOneAndUpdate({ _id: req.params.candidateId }, { status: req.body.status }, { new: true })

            if (!candidateData) return res.status(400).send({ error: true, message: "Candidate status is not updated" })

            return res.status(200).send({ error: false, message: "Candidate status updated" })

        } catch (error) {
            next(error)
        }
    },

    /**
     * This method is used to upload candidate CV
     */
    resumeUpload: async (req, res, next) => {
        try {
            let token = req.headers["authorization"]?.split(" ")[1];
            let { userId, dataModel } = await getUserViaToken(token);
            const checkAgency = await Agency.findOne({ _id: userId });
            const checkRecruiter = await Recruiter.findOne({ _id: userId });
            if (
                (!checkAgency || !checkRecruiter) &&
                !["agency", "recruiters"].includes(dataModel)
            ) return res.status(401).send({ error: true, message: "User unauthorized." })

            if (req.file.mimetype != 'application/pdf') return res.status(400).send({ error: true, message: "Only pdf file is allowed." })

            const fileName = `HIRE2INSPIRE_${Date.now()}_${req.file.originalname}`;
            const fileData = await app.locals.bucket.file(fileName).createWriteStream().end(req.file.buffer);

            fileurl = `https://firebasestorage.googleapis.com/v0/b/hire2inspire-62f96.appspot.com/o/${fileName}?alt=media`;

            // Status update
            const candidateData = await CandidateModel.findOneAndUpdate({ _id: req.params.candidateId }, { resume: fileurl }, { new: true })

            if (!candidateData) return res.status(400).send({ error: true, message: "Candidate resume not uploaded." })

            return res.status(200).send({ error: false, message: "Candidate resume uploaded", data: candidateData })

        } catch (error) {
            next(error)
        }
    },

    /**
     * This method is to find all candidates
     */
    allCandidateWithFilter: async (req, res, next) => {
        try {
            // All candidate data
            let matchTry = {};
            matchTry['$and'] = []
            var queriesArray = Object.entries(req.query)
            queriesArray.forEach(x => {
                if (x[1] != '') {
                    if (ObjectId.isValid(x[1])) {
                        var z = { [x[0]]: { $eq: ObjectId(x[1]) } }
                    } else {
                        var z = { [x[0]]: { $regex: x[1], $options: 'i' } }
                    }
                    matchTry.$and.push(z)
                }

            })

            const candidates = await CandidateModel
                .find(matchTry)
                .sort({ _id: -1 })

            return res.status(200).send({ error: false, message: "Candidate list", data: candidates })

        } catch (error) {
            next(error)
        }
    },

    /**
     * This method is used to fetch candidate details
     */
    details: async (req, res, next) => {
        try {
            const candidateDetail = await CandidateModel
                .findOne({ _id: req.params.id })
                .populate([
                    {
                        path: "job"
                    },
                    {
                        path: "agency"
                    },
                    {
                        path: "recruiter"
                    }
                ])
            if (!candidateDetail) return res.status(400).send({ error: true, message: "Candidate not found" })
            return res.status(200).send({ error: false, message: "Candidate data found", data: candidateDetail })
        } catch (error) {
            next(error)
        }
    },

    requestUpdate: async (req, res, next) => {
        try {
            // Status update
            const candidateJobData = await CandidateJobModel.findOneAndUpdate({ candidate: req.params.candidateId }, { request: req.body.request }, { new: true });

            console.log({ candidateJobData })

            const candidateData = await CandidateModel.findOneAndUpdate({ _id: req.params.candidateId }, { status: candidateJobData?.request }, { new: true })

            console.log("candidateJobData", candidateJobData?.request)

            if (candidateJobData?.request == "1") {
                const jobData = await JobPosting.findOneAndUpdate({ _id: candidateJobData?.emp_job }, { '$inc': { 'reviewing_count': 1 }, }, { new: true });
            }
            else if (candidateJobData?.request == "2") {
                const jobData = await JobPosting.findOneAndUpdate({ _id: candidateJobData?.emp_job }, { '$inc': { 'interviewin_count': 1 }, }, { new: true });
            }
            else if (candidateJobData?.request == "3") {
                const jobData = await JobPosting.findOneAndUpdate({ _id: candidateJobData?.emp_job }, { '$inc': { 'offer_count': 1 }, }, { new: true });
            }

            if (!candidateJobData) return res.status(400).send({ error: true, message: "Candidate status is not updated" })

            return res.status(200).send({ error: false, message: "Candidate status updated" })

        } catch (error) {
            next(error)
        }
    },


    update: async (req, res, next) => {
        try {
            const resData = await CandidateModel.find({ _id: req.params.id });
            // const result = await CandidateModel.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true });

            const result = await CandidateModel.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true }).populate([
                {
                    path: "job",
                    select: ""
                }
            ]);

            if (!result) return res.status(200).send({ error: false, message: "Candidate not updated" });


            let candidateEmail = result?.email;
            let candidatefName = result?.fname;
            let candidatelName = result?.lname;

            let jobRole = result?.job?.job_name;

            console.log(result, 'result')

            let jobId = result?.job;

            let companyName = result?.job?.comp_name;

            let candidateId = result?._id;



            if (result?.final_submit == false && result?.updated_by == "agency") {
                sgMail.setApiKey(process.env.SENDGRID)
                const msg = {
                    to: candidateEmail, // Change to your recipient
                    from: 'info@hire2inspire.com',
                    subject: `Subject: Confirmation of CV Resubmission for ${jobRole} - Next Steps`,
                    html: `
                      <head>
                          <title>Notification: Candidate Hired - Backend Development Position</title>
                  </head>
                  <body>
                      <p>Dear ${candidatefName} ${candidatelName} ,</p>
                      <p>I hope this email finds you well. I am writing to confirm that we have received your application for the ${jobRole} at ${companyName}. We appreciate your interest in joining our team and taking the time to submit your CV. Your application is currently being reviewed by our recruitment team.</p>
      
                      <p>As we move forward in the selection process, we would like to gather some additional information from you. Please take a moment to answer the following screening questions. Your responses will help us better understand your qualifications and suitability for the role. Once we review your answers, we will determine the next steps in the process.</p>
      
                      <p>Find the link 
                      <a href="https://hire2inspire.com/candidate/apply-job/${candidateId}" target="blank">Find your job</a>
                    </p>
      
                      <p>Best regards,</p>
                      <p>Hire2Inspire</p>
                  </body>
              `
                }

                sgMail
                    .send(msg)
                    .then(() => {
                        console.log('Email sent')
                    })
                    .catch((error) => {
                        console.error(error)
                    })

            }
            else if (result?.final_submit == false && resData?.email != result?.email && resData?.phone != result?.phone && result?.updated_by == "agency") {
                sgMail.setApiKey(process.env.SENDGRID)
                const new_msg = {
                    to: candidateEmail, // Change to your recipient
                    from: 'info@hire2inspire.com',
                    subject: `Subject: Confirmation of CV Submission for ${jobRole} - Next Steps`,
                    html: `
                      <head>
                          <title>Notification: Candidate Hired - Backend Development Position</title>
                  </head>
                  <body>
                      <p>Dear ${candidatefName} ${candidatelName} ,</p>
                      <p>I hope this email finds you well. I am writing to confirm that we have received your application for the ${jobRole} at ${companyName}. We appreciate your interest in joining our team and taking the time to submit your CV. Your application is currently being reviewed by our recruitment team.</p>
      
                      <p>As we move forward in the selection process, we would like to gather some additional information from you. Please take a moment to answer the following screening questions. Your responses will help us better understand your qualifications and suitability for the role. Once we review your answers, we will determine the next steps in the process.</p>
      
                      <p>Find the link 
                      <a href="https://hire2inspire.com/candidate/apply-job/${candidateId}" target="blank">Find your job</a>
                    </p>
      
                      <p>Best regards,</p>
                      <p>Hire2Inspire</p>
                  </body>
              `
                }

                sgMail
                    .send(new_msg)
                    .then(() => {
                        console.log('Email sent')
                    })
                    .catch((error) => {
                        console.error(error)
                    })


            }


            let updatedData;
            if (result?.updated_by == "agency") {
                updatedData = await CandidateModel.findOneAndUpdate({ _id: req.params.id }, { reSubmit: true }, { new: true });
            }

            return res.status(200).send({
                error: false,
                message: "Candidate Updated",
                data: result,
                updatedData
            })
        } catch (error) {
            next(error)
        }
    },







    candidateJobUpdate: async (req, res, next) => {
        try {
            const candidateJobData = await CandidateJobModel.findOneAndUpdate({ candidate: req.params.candidateId }, req.body, { new: true }).populate([
                {
                    path: "emp_job",
                    select: "",
                    populate: {
                        path: "employer",
                        select: ""
                    }
                },
                {
                    path: "agency_id",
                    select: ""
                },
                {
                    path: "candidate",
                    select: ""
                },
            ]);

            if (candidateJobData?.final_submit == true) {
                const candidateDataUpdate = await CandidateModel.findOneAndUpdate({ _id: req.params.candidateId }, { final_submit: true }, { new: true }).populate([
                    {
                        path: "agency",
                        select: ""
                    },
                    {
                        path: "job",
                        select: "",
                        populate: {
                            path: "employer",
                            select: ""
                        }
                    }
                ]);

                let agencyemail = candidateDataUpdate?.agency?.corporate_email;
                console.log({ agencyemail });
                let agencyName = candidateDataUpdate?.agency?.name;
                let empemail = candidateDataUpdate?.job?.employer?.email;
                console.log({ empemail });
                let candidateFName = candidateDataUpdate?.fname;
                let candidateLName = candidateDataUpdate?.lname;
                let jobName = candidateDataUpdate?.job?.job_name;

                sgMail.setApiKey(process.env.SENDGRID)
                const msg = {
                    to: agencyemail, // Change to your recipient
                    from: 'info@hire2Inspire.com',
                    subject: `FInal Response from ${candidateFName} ${candidateLName} for JoB name ${jobName}`,
                    html: `
                      <body>
                      <p>Dear ${agencyName},</p>
                    
                      <p>I hope this email finds you well. I am writing to inform you that we have received the final response from the candidate you uploaded for the [Job Title] position.</p>
                    
                      <p>After a thorough evaluation process, including multiple rounds of interviews and assessments, we are pleased to share that the candidate has accepted our job offer. We believe that their skills and experience align perfectly with our requirements, and we are confident that they will be a valuable addition to our team.</p>
                    
                      <p>We appreciate your assistance in the recruitment process and would like to express our gratitude for presenting us with such a well-qualified candidate. Your professionalism and dedication to finding the right fit for our organization have not gone unnoticed.</p>
                    
                      <p>Please convey our congratulations to the candidate on their successful acceptance of the offer, and thank them for their commitment to joining our team.</p>
                    
                      <p>We look forward to a successful collaboration and appreciate the ongoing support from your agency.</p>
                    
                      <p>If you have any further questions or if there are additional steps we need to take, please feel free to reach out.</p>
                    
                      <p>Thank you again for your partnership.</p>
                    
                      <p>Best regards</p>
                      <p>Hire2Inspire</p>
                    </body>
              `
                }

                sgMail
                    .send(msg)
                    .then(() => {
                        console.log('Email sent')
                    })
                    .catch((error) => {
                        console.error(error)
                    })


                sgMail.setApiKey(process.env.SENDGRID)
                const new_msg = {
                    to: empemail, // Change to your recipient
                    from: 'info@hire2Inspire.com',
                    subject: `FInal Response from ${candidateFName} ${candidateLName} for JoB name ${jobName}`,
                    html: `
                        <body>
                        <p>Dear ${empemail},</p>
                      
                        <p>I hope this email finds you well. I am writing to inform you that we have received the final response from the candidate you uploaded for the [Job Title] position.</p>
                      
                        <p>After a thorough evaluation process, including multiple rounds of interviews and assessments, we are pleased to share that the candidate has accepted our job offer. We believe that their skills and experience align perfectly with our requirements, and we are confident that they will be a valuable addition to our team.</p>
                      
                        <p>We appreciate your assistance in the recruitment process and would like to express our gratitude for presenting us with such a well-qualified candidate. Your professionalism and dedication to finding the right fit for our organization have not gone unnoticed.</p>
                      
                        <p>Please convey our congratulations to the candidate on their successful acceptance of the offer, and thank them for their commitment to joining our team.</p>
                      
                        <p>We look forward to a successful collaboration and appreciate the ongoing support from your agency.</p>
                      
                        <p>If you have any further questions or if there are additional steps we need to take, please feel free to reach out.</p>
                      
                        <p>Thank you again for your partnership.</p>
                      
                        <p>Best regards</p>
                        <p>Hire2Inspire</p>
                      </body>
                `
                }

                sgMail
                    .send(new_msg)
                    .then(() => {
                        console.log('Email sent')
                    })
                    .catch((error) => {
                        console.error(error)
                    })


            }

            if (candidateJobData?.screening_q_a.length != null) {
                const candidateUpdate = await CandidateModel.findOneAndUpdate({ _id: req.params.candidateId }, { "$push": { screening_q_a: candidateJobData?.screening_q_a } }, { new: true })
            }

            if (!candidateJobData) return res.status(400).send({ error: true, message: "Candidate status is not updated" })

            return res.status(200).send({ error: false, message: "Candidate status updated" })

        } catch (error) {
            next(error)
        }
    },


    candidateJobDetail: async (req, res, next) => {
        try {
            const result = await CandidateJobModel.findOne({ candidate: req.params.candidateId }).populate([
                {
                    path: "emp_job",
                    select: "",
                    populate: {
                        path: "employer",
                        select: ""
                    }
                },
                {
                    path: "agency_id",
                    select: ""
                },
                {
                    path: "candidate",
                    select: ""
                },

            ]);

            return res.status(200).send({
                error: false,
                message: "Detail of candidate job",
                data: result
            })

        } catch (error) {
            next(error)
        }
    },

    // BulkCandidate: async (req, res, next) => {
    //     try {
    //         let token = req.headers["authorization"]?.split(" ")[1];
    //         let { userId, dataModel } = await getUserViaToken(token);
    //         const checkAgency = await Agency.findOne({ _id: userId });
    //         const checkRecruiter = await Recruiter.findOne({ _id: userId });
    //         if (
    //             (!checkAgency || !checkRecruiter) &&
    //             !["agency", "recruiters"].includes(dataModel)
    //         ) return res.status(401).send({ error: true, message: "User unauthorized." })


    //         if (candidateDataResult.length) {
    //             return res.status(201).send({
    //                 error: false,
    //                 message: "Candidate data submitted",
    //                 data: candidateDataResult
    //             })
    //         }
    //         return res.status(400).send({
    //             error: true,
    //             message: "Candidate submission failed"
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // },

    submitBulkCandidate: async (req, res, next) => {
        try {
            let token = req.headers["authorization"]?.split(" ")[1];
            let { userId, dataModel } = await getUserViaToken(token);
            const checkAgency = await Agency.findOne({ _id: userId });
            const checkRecruiter = await Recruiter.findOne({ _id: userId });
            if (
                (!checkAgency || !checkRecruiter) &&
                !["agency", "recruiters"].includes(dataModel)
            ) return res.status(401).send({ error: true, message: "User unauthorized." })

            // Checking the corresponding agency job exist or not
            const agencyJobExist = await AgencyJobModel.findOne({ _id: req.body.agency_job })

            const empJobExist = await JobPosting.findOne({ _id: req.body.job })

            // if corresponding agency job not exist
            if (!agencyJobExist) return res.status(400).send({ error: true, message: "Candidate submission failed" })

            if (!empJobExist) return res.status(400).send({ error: true, message: "Candidate submission failed" })

            // if corresponding agency job exist
            // Submit candidate here
            const candidates = req.body.candidates
            let candidateData = []

            for (let index = 0; index < candidates.length; index++) {
                const candidateExist = await CandidateModel.findOne({
                    $and: [
                        { job: agencyJobExist.job },
                        {
                            $or: [
                                { email: candidates[index].email },
                                { phone: candidates[index].phone }
                            ]
                        }
                    ]
                });

                const candidateExist1 = await CandidateModel.findOne({
                    $and: [
                        { job: empJobExist?._id },
                        {
                            $or: [
                                { email: candidates[index].email },
                                { phone: candidates[index].phone }
                            ]
                        }
                    ]
                })
                // console.log("candidateExist >>>>>>>>>>>>>>>>>>> ", candidateExist);
                // if candidate exist
                if (candidateExist) return res.status(400).send({ error: true, message: `Candidate data already exist with this email ${candidateExist?.email}` })

                if (candidateExist1) return res.status(400).send({ error: true, message: `Candidate data already exist with this email ${candidateExist?.email}` })


                candidates[index].agency = agencyJobExist.agency
                candidates[index].recruiter = checkRecruiter?._id;
                // candidates[index].job = agencyJobExist.job
                candidates[index].job = empJobExist?._id;
                candidateData.push(candidates[index]);



            }

            // console.log("candidates >>>>>>>>>>>>", candidateData);
            const candidateDataResult = await CandidateModel.insertMany(candidateData);
            const candidatejobData = await CandidateJobModel.insertMany(candidateData);

            console.log({ candidatejobData });

            submitted_candidates_id = candidateDataResult.map(e => e._id)
            const agencyJobUpdate = await AgencyJobModel.findOneAndUpdate({ _id: agencyJobExist._id }, { $push: { candidates: submitted_candidates_id } }, { new: true })
            // console.log("agencyJobUpdate >>>>>>>>>>>> ", agencyJobUpdate);
            console.log({ candidateDataResult });

            if (candidateDataResult.length) {
                return res.status(201).send({
                    error: false,
                    message: "Candidate data submitted",
                    data: candidateDataResult
                })
            } else if (candidatejobData.length) {
                return res.status(201).send({
                    error: false,
                    message: "Candidate data submitted",
                    data: candidatejobData
                })
            }
            return res.status(400).send({
                error: true,
                message: "Candidate submission failed"
            })
        } catch (error) {
            next(error)
        }
    },


    /////// review list //////////

    reviewList: async (req, res, next) => {
        try {
            const result = await CandidateJobModel.find({ agency_id: req.params.agencyId }).populate([
                {
                    path: "emp_job",
                    select: "",
                    populate: {
                        path: "employer",
                        select: ""
                    }
                },
                {
                    path: "agency_id",
                    select: ""
                },
                {
                    path: "candidate",
                    select: ""
                },

            ]).sort({ _id: -1 });
            return res.status(200).send({ error: false, message: "Candidate review data", data: result })
        } catch (error) {
            next(error)
        }
    },



}
