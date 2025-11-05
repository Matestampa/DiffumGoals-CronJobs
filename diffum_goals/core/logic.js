
const {BATCH_ACTIONS} = require("../actions")
const {errorHandler} = require("./errorHandler.js");

//----------------- Get params to modify in DB , according to the situation ----------------

//DIFFUM operation
function get_dbDiffumOperation(){

    return {last_diffumDate: new Date()}
}

//SET_EXPIRED operation
function get_dbSetExpiredOperation(){

    return {expired: true,last_diffumDate: new Date()}
}



// Receives : [{id,cant_pix_xday,diffum_color,s3_imgName,limit_date}] , FailedTracker
async function diffumProcess(goalsData,FailedTracker){
    
    let dbData_2_update=[]
    let s3Data_2_update=[]

    //Initiay process each goal one by one
    for (let goalData of goalsData){
        
        //--------------------------------- Get image from S3 ---------------------------------
        //-------------------------------------------------------------------------------------
        let {id,cant_pix_xday,diffum_color,s3_imgName,limit_date}=goalData;

        let getfromS3_resp=await BATCH_ACTIONS.GET_FROM_S3.func([{id,imgName:s3_imgName}]);

        if (getfromS3_resp.error){
            errorHandler(BATCH_ACTIONS.GET_FROM_S3.action,getfromS3_resp.error.failed)
            FailedTracker.processFailed(BATCH_ACTIONS.GET_FROM_S3.action,getfromS3_resp.error.failed)
            continue;           
        }

        let imgDataObj=getfromS3_resp.ok[0]; //{id,image_dataArr,contentType}

        //-------------------------------- Diffum locally -----------------------------------------
        //----------------------------------------------------------------------------------------
        let diffumLocal_resp=await BATCH_ACTIONS.DIFFUM_LOCALLY.func(id,imgDataObj.image_dataArr,diffum_color,cant_pix_xday,imgDataObj.imageInfo);

        if (diffumLocal_resp.error){
            errorHandler(BATCH_ACTIONS.DIFFUM_LOCALLY.action,[diffumLocal_resp.error.failed])
            FailedTracker.processFailed(BATCH_ACTIONS.DIFFUM_LOCALLY.action,[diffumLocal_resp.error.failed])
            continue;           
        }

        let {new_image_dataArr,wasLastDiffum}=diffumLocal_resp.ok;
        
        //if the last pixels are diffumed or the date is expired, the goal is set to be expired in DB
        if (wasLastDiffum || limit_date < new Date()){
            dbData_2_update.push({id:id,settedObject:get_dbSetExpiredOperation()})
        }
        else{
            dbData_2_update.push({id:id,settedObject:get_dbDiffumOperation()})
        }

        //Prepare data to update in S3
        s3Data_2_update.push({
                id:id,
                imgName:s3_imgName,
                pixelArr:new_image_dataArr,
                imageInfo:imgDataObj.imageInfo,
       })


    }

    //-------------------------- Update modified images to S3 (Batch) ---------------------------
    //--------------------------------------------------------------------------------------------
    let updateToS3_resp=await BATCH_ACTIONS.UPDATE_TO_S3.func(s3Data_2_update);

    if (updateToS3_resp.error){
        errorHandler(BATCH_ACTIONS.UPDATE_TO_S3.action,updateToS3_resp.error.failed)
        FailedTracker.processFailed(BATCH_ACTIONS.UPDATE_TO_S3.action,updateToS3_resp.error.failed)
    }

    let stillActive=FailedTracker.getActiveRecords(); //get array of still active ids in case some failed in S3 update
   
    //-------------------------- Update modified data to DB (Batch) -------------------------------
    //--------------------------------------------------------------------------------------------
    //Filter only the dbData of the still active goals
    let dbData_filtered=dbData_2_update.filter(dbData=> stillActive.find(activeRec=> activeRec.id==dbData.id) );

    let updateToDb_resp=await BATCH_ACTIONS.UPDATE_TO_DB.func(dbData_filtered);
    

    if (updateToDb_resp.error){
        errorHandler(BATCH_ACTIONS.UPDATE_TO_DB.action,updateToDb_resp.error.failed)
        FailedTracker.processFailed(BATCH_ACTIONS.UPDATE_TO_DB.action,updateToDb_resp.error.failed)
    }

    //No need to return anything, as the FailedTracker already should have all the failed records

}

module.exports={
    diffumProcess
}