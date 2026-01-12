const {mainDiffum} = require("./mainNormal.js")


async function main_diffumProcess(expiredDiffumTime){

	let Failed_Tracker=await mainDiffum(expiredDiffumTime);


}
module.exports={main_diffumProcess};