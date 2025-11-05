const {get_goal_fromDb,get_Goals_FromDb_Pagination,updateMulti_Goals_2Db,
    get_ImgFile_Array,save_NewImgFile,invalidateAll_CloudfrontCache} = require("./getters_savers.js");

const {S3_Error,MongoDB_Error,MongoDB_Connection_Error,CleanCache_Error, Unknown_Error} = require("./errors.js");

const {connect_MongoDB,disconnect_MongoDB}=require("../../mongodb");


const {get_randNum,get_untouchedPix,changePixel,delete_arrElem} = require("./utils.js");


const {errorHandler} = require("../core/errorHandler.js"); 


// Top-level sleep function for async delays
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


//======================= GLOBAL ACTION FUNCTIONS =======================

async function connect_toDb(){
    let attempts = 0;
    let delay = 500; // ms
    while (attempts < 3) {
        try {
            await connect_MongoDB();
            return {error:undefined,ok:true};
        } catch (err) {
            attempts++;
            if (attempts >= 3) {
                return {
                    error: {
                        failed: [{ id:"all", error: new MongoDB_Connection_Error("",err), retry_data: {} }]
                    },
                    ok: undefined
                };
            }
            await sleep(delay);
            delay *= 2;
        }
    }
}

async function disconnect_fromDb(){
    let attempts = 0;
    let delay = 500; // ms
    while (attempts < 3) {
        try {
            await disconnect_MongoDB();
            return {error:undefined,ok:true};
        } catch (err) {
            attempts++;
            if (attempts >= 3) {
                return {
                    error: {
                        failed: [{ id:"all", error: new MongoDB_Connection_Error("",err), retry_data: {} }]
                    },
                    ok: undefined
                };
            }
            await sleep(delay);
            delay *= 2;
        }
    }
}

async function clean_cache(){
    let attempts = 0;
    let delay = 500; // ms
    while (attempts < 3) {
        try {
            await invalidateAll_CloudfrontCache();
            return {error:undefined,ok:true};
        } catch (err) {
            attempts++;
            if (attempts >= 3) {
                return {
                    error: {
                        failed: [{ id:"all", error: new CleanCache_Error("",err), retry_data: {} }]
                    },
                    ok: undefined
                };
            }
            await sleep(delay);
            delay *= 2;
        }
    }
}

//===================== BATCH ACTION FUNCTIONS =====================

//Receives:
//mode: "PAGINATION" , params : {nextCursor,limit}
//mode : "ONE_BY_ID", params : {id}
async function get_goalsFromDb(mode,params){
    
    let GENERAL_FILTER={expired:false}

    if (mode==="PAGINATION"){
        let {nextCursor,limit}=params

        try{
            let results=await get_Goals_FromDb_Pagination(nextCursor,limit,GENERAL_FILTER)
            return {ok:results,error:undefined}
        }
        catch(err){
            return {ok:undefined,error:{failed:[{id:"all",error:new MongoDB_Error("",err),retry_data:{lastCursor:nextCursor}}]}}
        }
    }
    else if (mode==="ONE_BY_ID"){
        let {id}=params
        try{
            let result=await get_goal_fromDb(id)
            return {ok:result,error:undefined}
        }
        catch(err){
            return {ok:undefined,error:{failed:[{id:id,error:new MongoDB_Error("",err),retry_data:{}}]}}
        }
    }
}


//Receives : [{id,imgName}]
async function get_imgsFromS3(imgsNames){
    let results = [];
    let failed = [];
    for (const {id, imgName} of imgsNames) {
        try {
            const imgData = await get_ImgFile_Array(imgName);
            results.push({id, ...imgData});

        } catch (err) {
            failed.push({id, error: new S3_Error("",err), retry_data:{}});
        }
    }
    return {
        ok: results.length > 0 ? results : undefined,
        error: failed.length > 0 ? {failed} : undefined
    };
}

//Receives : id,image_dataArr,diffum_color,cant_pix_xday,imageInfo (una sola)
async function diffum_locally(id,image_dataArr,diffum_color,cant_pix_xday,imageInfo){
    
    let new_image_dataArr=[]
    let wasLastDiffum = false;
    
    try{
        let untouched_pix=get_untouchedPix(image_dataArr,diffum_color,imageInfo.channels);
    
        new_image_dataArr=image_dataArr
        
        if (untouched_pix.length<=cant_pix_xday){
            cant_pix_xday=untouched_pix.length;
            wasLastDiffum = true;
        }

        for (let i=0;i<cant_pix_xday;i++){
            let rand_arrPos=get_randNum(0,untouched_pix.length-1);
            let pixel_coords=untouched_pix[rand_arrPos];
            changePixel(pixel_coords[0],pixel_coords[1],diffum_color,image_dataArr,imageInfo);
            delete_arrElem(rand_arrPos,untouched_pix);
        }
    }
    catch(err){
        return {ok : undefined, error: {failed: {id:id,error:new Unknown_Error("",err),retry_data:{}}}}
    }
    
    new_image_dataArr=image_dataArr;
    return {
        ok: {new_image_dataArr,wasLastDiffum},
        error: undefined
    }
}


//Receives : [{id,imgName,pixelArr,imageInfo}]
async function update_imgsToS3(imgsData){
    let results = [];
    let failed = [];
    
    for (const {id, imgName, pixelArr, imageInfo} of imgsData) {
        try {
            await save_NewImgFile(imgName, pixelArr, imageInfo);
            results.push({id, imgName});
        } catch (err) {
            failed.push({id, error: new S3_Error("",err), retry_data:{}});
        }

    }
    return {
        ok: results.length > 0 ? results : undefined,
        error: failed.length > 0 ? {failed} : undefined
    };
}

//Receives : [{id,settedObject}]
async function update_goalsToDb(goals_data2update){

    let results = [];
    let failed = [];

    try {
        await updateMulti_Goals_2Db(goals_data2update);
        // If no error, all succeeded
        results = goals_data2update.map(g => ({ id: g.id}));
    } 
    catch (err) {
        // If error, parse bulkWrite error to get failed ids
        // Mongoose bulkWrite error structure: err.writeErrors is an array
        if (err && Array.isArray(err.writeErrors)) {
            // For each writeError, get the id (from op._id or op.id)
            failed = err.writeErrors.map(e => {
                const op = e?.op || {};
                const id = op._id || op.id;
                return {
                    id,
                    error: new MongoDB_Error("", e.err || e),
                    retry_data: { id, setted_object: goals_data2update.find(g => g.id === id)?.settedObject }
                };
            });
            // The rest are successful
            const failedIds = new Set(failed.map(f => f.id));
            results = goals_data2update.filter(g => !failedIds.has(g.id)).map(g => ({ id: g.id }));
        } 
        else {
            // If error is not bulkWrite, mark all as failed
            failed = goals_data2update.map(g => ({
                id: g.id,
                error: new MongoDB_Error("", err),
                retry_data: { settedObject: g.settedObject }
            }));
        }
    }

    return {
        ok: results.length > 0 ? results : undefined,
        error: failed.length > 0 ? { failed } : undefined
    };
}

module.exports={
    connect_toDb,
    disconnect_fromDb,
    get_goalsFromDb,
    get_imgsFromS3,
    diffum_locally,
    update_goalsToDb,
    update_imgsToS3,
    clean_cache
}

