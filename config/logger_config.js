const { get_env } = require("./get_env.js");

// Get the current environment (dev, prod, etc.)
let env=get_env();

// Configure logging variables based on environment
// - In dev: Use local file paths for info and error logs
// - In other environments: Use CloudWatch log group name
const LOG_VARS = env === "dev" 
    ? {
        infoLogPath: process.env.INFO_LOGS_PATH,
        errorLogPath: process.env.ERROR_LOGS_PATH,
        localEnv : true
    }
    : {
        infoLogGroupName: process.env.INFO_LOG_GROUP_NAME,
        errorLogGroupName: process.env.ERROR_LOG_GROUP_NAME,
        localEnv: false
    };


module.exports= {LOG_VARS};