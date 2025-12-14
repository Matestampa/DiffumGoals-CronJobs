const dotenv = require("dotenv");
const { join, dirname } = require("path");
const fs = require('fs');

const APP_ENV = process.env.APP_ENV ? process.env.APP_ENV : "dev";
let env_absPath = join(__dirname, `../.env.${APP_ENV}`);

console.log(env_absPath)

if (fs.existsSync(env_absPath)) {
    dotenv.config({ path: env_absPath });
} else {
    dotenv.config();
}

function get_env(){
    return APP_ENV;
}

module.exports= {get_env};