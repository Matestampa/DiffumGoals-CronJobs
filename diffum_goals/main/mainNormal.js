
const {FailedTracker} = require("../core/classes");
const {GLOBAL_ACTIONS,BATCH_ACTIONS} = require("../actions");

const {infoLogger} = require("../../logs/loggers.js");

const {diffumProcess} = require("../core/logic.js");

const {errorHandler} =require("../core/errorHandler.js");


const BATCH_SIZE=10;


async function mainDiffum(expiredDiffumTime) {
    let Failed_Tracker=new FailedTracker();

	//----------- GLOBAL : Connect DB -----------------------------
	let connectDb_res=await GLOBAL_ACTIONS.CONNECT_DB.func()
	if (connectDb_res.error){
		errorHandler(GLOBAL_ACTIONS["CONNECT_DB"].action, connectDb_res.error.failed);
		Failed_Tracker.processFailed(GLOBAL_ACTIONS["CONNECT_DB"].action,connectDb_res.error.failed);
		return Failed_Tracker;
	}
	infoLogger.info("Connected to DB");
	//--------------------------------------------------------------

	let nextCursor= null
	let totalProcessedGoals=0;

	do {
		let getFromDb_res = await BATCH_ACTIONS.GET_TO_DIFFUM_FROM_DB.func(nextCursor,BATCH_SIZE,expiredDiffumTime);

		//Si hay errores las mandamos a fallidas de una
		if (getFromDb_res.error){
			errorHandler(BATCH_ACTIONS.GET_TO_DIFFUM_FROM_DB.action, getFromDb_res.error.failed);
			Failed_Tracker.processFailed(BATCH_ACTIONS.GET_TO_DIFFUM_FROM_DB.action,getFromDb_res.error.failed);
            await GLOBAL_ACTIONS.DISCONNECT_DB.func()
			return Failed_Tracker;
		}

        nextCursor = getFromDb_res.ok.pagination.nextCursor;
        let goalsData = getFromDb_res.ok.data;
		let total_batchGoals = goalsData.length;

		totalProcessedGoals += total_batchGoals;

		Failed_Tracker.setActiveRecords(goalsData.map(goal0=>goal0.id));

		if (total_batchGoals>0){
			await diffumProcess(goalsData,Failed_Tracker);
		}

		infoLogger.info(`Batch finished. Success count: ${Failed_Tracker.getActiveRecords().length} / ${total_batchGoals}`);
	}
	while(nextCursor)

	//----------- GLOBAL : Disconnect DB -----------------------------
	let disconnectFromDb_res=await GLOBAL_ACTIONS.DISCONNECT_DB.func()

	if (disconnectFromDb_res.error){
		errorHandler(GLOBAL_ACTIONS.DISCONNECT_DB.action, disconnectFromDb_res.error.failed);
		Failed_Tracker.processFailed(GLOBAL_ACTIONS.DISCONNECT_DB.action,disconnectFromDb_res.error.failed);
	}
	else{
		infoLogger.info("Disconnected from DB");
	}

	return Failed_Tracker;	
}



module.exports={mainDiffum};