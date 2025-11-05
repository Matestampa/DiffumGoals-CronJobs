const { get_env } = require("./get_env.js");

get_env();

const RETRY_VARS={
    retryDataFilePath:process.env.RETRY_DATA_FILE_PATH
}

module.exports= {RETRY_VARS};