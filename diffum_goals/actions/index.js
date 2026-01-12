const {connect_toDb,
    disconnect_fromDb,
    get_goalsToDiffum_db,
    get_imgsFromS3,
    get_newImgName,
    diffum_locally,
    update_goalsToDb,
    update_imgsToS3,
    delete_oldImgsFromS3,
    clean_cache} = require('./actions.js');
    

const GLOBAL_ACTIONS={
    "CONNECT_DB":{
        func:connect_toDb,
        action:"CONNECT_DB"
    },
    "DISCONNECT_DB":{
        func:disconnect_fromDb,
        action:"DISCONNECT_DB"
    },
    "CLEAN_CACHE":{
        func:clean_cache,
        action:"CLEAN_CACHE"
    }
}

const BATCH_ACTIONS={
    "GET_TO_DIFFUM_FROM_DB":{
        func:get_goalsToDiffum_db,
        action:"GET_TO_DIFFUM_FROM_DB"
    },
    "GET_FROM_S3":{
        func:get_imgsFromS3,
        action:"GET_FROM_S3"
    },

    "GET_NEW_IMG_NAME":{
        func:get_newImgName,
        action:"GET_NEW_IMG_NAME"
    },

    "DIFFUM_LOCALLY":{
        func:diffum_locally,
        action:"DIFFUM_LOCALLY"
    },
    "UPDATE_TO_S3":{
        func:update_imgsToS3,
        action:"UPDATE_TO_S3"
    },

    "UPDATE_TO_DB":{
        func:update_goalsToDb,
        action:"UPDATE_TO_DB"
    },
    "DELETE_OLD_IMGS_FROM_S3":{
        func:delete_oldImgsFromS3,
        action:"DELETE_OLD_IMGS_FROM_S3"
    }
}


module.exports={GLOBAL_ACTIONS,BATCH_ACTIONS}