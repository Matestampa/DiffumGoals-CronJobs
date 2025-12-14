const { get_env } = require("./get_env.js");

get_env();


const AWS_S3_VARS={
    bucketRegion:process.env.S3_BUCKET_REGION,
    bucketRegion:process.env.S3_BUCKET_REGION,
    bucketName:process.env.S3_BUCKET_NAME,
    accessKeyId:process.env.S3_AWS_ACCESS_KEY_ID,
    secretAccessKey:process.env.S3_AWS_SECRET_ACCESS_KEY,
}

const AWS_CLOUDFRONT_VARS={
    distributionId:process.env.CFNT_DISTRIBUTION_ID,
    accessKeyId:process.env.CFNT_ACCESS_KEY_ID,
    secretAccessKey:process.env.CFNT_SECRET_ACCESS_KEY
}

const AWS_CLOUDWATCH_VARS={
    awsAccessKeyId: process.env.CLOUDWATCH_AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.CLOUDWATCH_AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.CLOUDWATCH_AWS_REGION
}


module.exports= {AWS_S3_VARS, AWS_CLOUDFRONT_VARS, AWS_CLOUDWATCH_VARS};