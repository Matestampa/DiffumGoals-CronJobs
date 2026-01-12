
const sharp = require('sharp');

const {GoalModel, MongoDB_Error}=require("../../mongodb/");

const {S3_FUNCS,CLOUDFRONT_FUNCS}=require("../../aws_services");

const {AWS_CLOUDFRONT_VARS} = require("../../config/aws_config.js");

//------------------------- DB ---------------------------------------------- 


async function get_goal_fromDb(id){

    const goal = await GoalModel.findById(id).select("cant_pix_xday diffum_color s3_imgName limit_date");

    if (!goal) {
        throw new MongoDB_Error("Goal not found", null);
    }

    return {
        id: goal._id,
        cant_pix_xday: goal.cant_pix_xday,
        diffum_color: goal.diffum_color,
        s3_imgName: goal.s3_imgName,
        limit_date: goal.limit_date
    }
}


//Gets goals from DB with cursor pagination
async function get_Goals_FromDb_Pagination(lastId = null, limit = 10, filter = {}, fields = ["_id"]){

    // Build the query - if lastId is provided, find documents with _id greater than lastId
    let query = { ...filter };
    if (lastId) {
        query._id = { $gt: lastId };
    }
    
    // Convert fields array to string for MongoDB select
    const fieldsString = fields.join(' ');
    
    const docs = await GoalModel
        .find(query)
        .select(fieldsString)
        .sort({ _id: 1 }) // Sort by _id ascending for consistent pagination
        .limit(limit);
    
    // Si obtenemos menos documentos que el límite, estamos en la última página
    const hasNextPage = docs.length === limit;
    
    // Get the last ID for the next page
    const nextCursor = docs.length > 0 ? docs[docs.length - 1]._id : null;
    
    // Create result objects dynamically based on fields array
    const results = docs.map(doc => {
        const result = { id: doc._id };
        fields.forEach(field => {
            if (doc[field] !== undefined) {
                result[field] = doc[field];
            }
        });
        return result;
    });
    
    return {
        data: results,
        pagination: {
            hasNextPage: hasNextPage,
            nextCursor: nextCursor,
            limit: limit,
            returnedCount: docs.length
        }
    };
}


//Receives [{id,settedObject}] . Setted objects is an objects with the properties to modify and their
//new values
async function updateMulti_Goals_2Db(goalsUpdated){

    let operations=[]

    for (let goal of goalsUpdated){
        // Use the settedObject directly, or fallback to just updating last_diffumDate
        let setObject = goal.settedObject || { last_diffumDate: new Date() }
        
        operations.push({
            updateOne: {
                filter: { _id: goal.id },
                update: { $set: setObject }
            }
        })
    }
    
    await GoalModel.bulkWrite(operations);
}


//------------------------- S3 ----------------------------------------------

//Obtener array de pixeles e info de la img
async function get_ImgFile_Array(imgName){
    
    let imgByteArr=await S3_FUNCS.getObject(imgName);

    let {data,info}=await sharp(imgByteArr).raw().toBuffer({resolveWithObject:true});

    return {image_dataArr:data,imageInfo:info};
}

//Guardar la imagen actualizada a partir del nuevo arr de pixeles
async function save_NewImgFile(imgName, pixelArr, info) {
    
    let buffer = await sharp(pixelArr, {
        raw: { width: info.width, height: info.height, channels: info.channels }
    }).toFormat("png").toBuffer();

    await S3_FUNCS.saveObject(imgName, buffer, "image/png");
}


//------------------------- CLOUDFRONT : invalidate cache ----------------------------------------------
async function invalidateAll_CloudfrontCache(){

    distId=AWS_CLOUDFRONT_VARS.distributionId;
    paths=["/*"]

    await CLOUDFRONT_FUNCS.invalidateCache(distId,paths)
}

module.exports={get_goal_fromDb,get_Goals_FromDb_Pagination,updateMulti_Goals_2Db,
                get_ImgFile_Array,save_NewImgFile,invalidateAll_CloudfrontCache
}

