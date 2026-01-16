const { get_env } = require("./get_env.js");

// Get the current environment (dev, prod, etc.)
let env=get_env();


const DIFFUM_VARS={
    EXPIRED_DIFFUM_TIME : process.env.EXPIRED_DIFFUM_TIME
}

module.exports={DIFFUM_VARS};