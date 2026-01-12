const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

const { AWS_S3_VARS } = require("../config/aws_config.js");

const { aws_errorHandler } = require("./error_handler.js");

//----------------------- S3 class client & vars---------------------------

const S3_ARGS={}

//if localEndpoint is defined, use it, else use region
if (AWS_S3_VARS.localEndpoint){
    S3_ARGS.endpoint=AWS_S3_VARS.localEndpoint;
}
else{S3_ARGS.region=AWS_S3_VARS.bucketRegion;}

const S3=new S3Client({
    region:AWS_S3_VARS.bucketRegion,
    credentials:{
        accessKeyId:AWS_S3_VARS.accessKeyId,
        secretAccessKey:AWS_S3_VARS.secretAccessKey
    }
});

const BUCKET_NAME=AWS_S3_VARS.bucketName;

//-----------------------------------------------------------------------


//-------------------- Functions ----------------------------------

async function saveObject(key,dataBuffer,contentType){
      
    let params={
        Bucket:BUCKET_NAME, 
        Key:key, 
        Body:dataBuffer,
        ContentType:contentType
    }

    let command=new PutObjectCommand(params);
    try{
        await S3.send(command); 
    }
    catch(e){
        aws_errorHandler(e,"S3");
    };
}

async function getObject(key){

    let params={
        Bucket:BUCKET_NAME,
        Key:key
    }
    
    let command=new GetObjectCommand(params);
    
    let imgByteArr;
    try {
        let data=await S3.send(command);

        imgByteArr=await data.Body.transformToByteArray();
    }
    catch(err){
        aws_errorHandler(err,"S3");
    }

    return imgByteArr;
}

async function deleteObjects(keys){
      
    let params={
        Bucket:BUCKET_NAME, 
        Delete:{
            Objects:keys.map(key=>({Key:key})),
            Quiet:false
        }
    }

    let command=new DeleteObjectsCommand(params);
    try{
        let resp=await S3.send(command); 
    }
    catch(e){
        aws_errorHandler(e,"S3");
    };
}


//
const S3_FUNCS={
    saveObject,
    getObject,
    deleteObjects,
}

module.exports = {S3,S3_FUNCS};