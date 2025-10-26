//Van todas las funcs relacionadas con mainRetry

const {FailedTracker} = require("../core/classes");
const {GLOBAL_ACTIONS,BATCH_ACTIONS} = require("../actions");

const {infoLogger} = require("../../logs/loggers.js");

const {diffumProcess} = require("../core/logic.js");

const {errorHandler} =require("../core/errorHandler.js");


const RETRY_FROM_ZERO_BATCH=[BATCH_ACTIONS["GET_FROM_DB"].action]

const RETRY_FROM_ZERO_SINGLE=[BATCH_ACTIONS["GET_FROM_S3"].action,
                       BATCH_ACTIONS["DIFFUM_LOCALLY"].action,BATCH_ACTIONS["UPDATE_TO_S3"].action];


const BATCH_SIZE=5;

async function retryFromZero_batch(lastCursor,Failed_Tracker){
	let nextCursor = lastCursor;

	do {
		let getFromDb_res = await BATCH_ACTIONS.GET_FROM_DB.func("PAGINATION", {nextCursor: nextCursor, limit: BATCH_SIZE});
		if (getFromDb_res.error) {
			errorHandler(BATCH_ACTIONS.GET_FROM_DB.action, getFromDb_res.error.failed);
			Failed_Tracker.processFailed(BATCH_ACTIONS.GET_FROM_DB.action, getFromDb_res.error.failed);
			return;
		}
		nextCursor = getFromDb_res.ok.pagination.nextCursor;
		let goalsData = getFromDb_res.ok.data;
		let total_batchGoals = goalsData.length;

		Failed_Tracker.setActiveRecords(goalsData.map(goal => goal.id));

		await diffumProcess(goalsData, Failed_Tracker);

		infoLogger.info(`Batch finished. Success count: ${Failed_Tracker.getActiveRecords().length} / ${total_batchGoals}`);
	}
	while (nextCursor);
}

async function retryFromZero_single(failedIds,Failed_Tracker){

	for (let goalId of failedIds){

		infoLogger.info(`Retrying from zero single, goal id : ${goalId}`);
		let getFromDb_res = await BATCH_ACTIONS.GET_FROM_DB.func("ONE_BY_ID", {id: goalId});

		
		if (getFromDb_res.error) {
			errorHandler(BATCH_ACTIONS.GET_FROM_DB.action, getFromDb_res.error.failed);
			Failed_Tracker.processFailed(BATCH_ACTIONS.GET_FROM_DB.action, getFromDb_res.error.failed);
		}
		else{
			infoLogger.info(`Diffuming for goal id : ${goalId}`);
			let goalData = getFromDb_res.ok;

			Failed_Tracker.setActiveRecords([goalId]);
			await diffumProcess([goalData], Failed_Tracker);

		}

	}
}


async function retryUpdateDB(failedGoals,Failed_Tracker){

	for (let goal of failedGoals){
		Failed_Tracker.setActiveRecords([goal.id]);
		let res = await BATCH_ACTIONS.UPDATE_TO_DB.func([{id: goal.id, settedObject: goal.retry_data.settedObject}]); //Tambien habria q poner el modo que es de uno solo en la func

		if (res.error){
			errorHandler(BATCH_ACTIONS.UPDATE_TO_DB.action, res.error.failed);
			Failed_Tracker.processFailed(BATCH_ACTIONS.UPDATE_TO_DB.action, res.error.failed);
		}
	}

}


async function mainRetry(failed_goals_from_json){

	// Array to collect all failed actions that belong to RETRY_FROM_ZERO
	let retryFromZero_batch_true = false;
	let retryFromZero_batch_lastCursor = undefined;
	let retryFromZero_single_arr = [];
	let retryDBUpdate=[]
	let neeedCleanCache=false

	// Go through each action group in failed_goals_from_json and add them to each group
	for (const action in failed_goals_from_json) {

		let failedArr=failed_goals_from_json[action]

		if (RETRY_FROM_ZERO_BATCH.includes(action)) {
			retryFromZero_batch_true = true;
			retryFromZero_batch_lastCursor = failedArr[0].retry_data.lastCursor;
		}
		
		//Si la accion es una de las que se hacen desde cero, agregar todas las fallidas a retryAll
		if (RETRY_FROM_ZERO_SINGLE.includes(action)) {
			for (const entry of failedArr) {
				retryFromZero_single_arr.push({ id: entry.id, action, retry_data: entry.retry_data });
			}
			neeedCleanCache=true
		}

		//Si la accion es updateDB, agregar todas las fallidas a retryDBUpdate
		if (action===BATCH_ACTIONS.UPDATE_TO_DB.action){
			for (const entry of failedArr) {
				retryDBUpdate.push({ id: entry.id, action, retry_data: entry.retry_data });
			}
			neeedCleanCache=true
		}

		//Si la accion es cleanCache, poner el flag en true de que hay q reinentar el cache
		if (action===GLOBAL_ACTIONS.CLEAN_CACHE.action){
			neeedCleanCache=true
		}
	}

	let Failed_Tracker = new FailedTracker();

	if (retryFromZero_batch_true || retryFromZero_single_arr.length > 0 || retryDBUpdate.length > 0 || neeedCleanCache){
		
		
		//----------- GLOBAL : Connect DB -----------------------------
		// If there are any actions to retry, we need to connect to the DB first
		let connectDb_res = await GLOBAL_ACTIONS.CONNECT_DB.func();

		if (connectDb_res.error) {
			errorHandler(GLOBAL_ACTIONS.CONNECT_DB.action, connectDb_res.error.failed);
			Failed_Tracker.processFailed(GLOBAL_ACTIONS.CONNECT_DB.action, connectDb_res.error.failed);
			return Failed_Tracker; // If we can't connect to the DB, we can't proceed
		}
		//--------------------------------------------------------------

		//Si hay de retryFromZero_batch
		if (retryFromZero_batch_true){
			infoLogger.info("Retrying batch from zero");
			await retryFromZero_batch(retryFromZero_batch_lastCursor, Failed_Tracker);
		}

		//Si hay de retryFromZero_single
		if (retryFromZero_single_arr.length > 0){
			infoLogger.info("Retrying single from zero");
			let failedIds=retryFromZero_single_arr.map(e => e.id)
			await retryFromZero_single(failedIds, Failed_Tracker);
		}

		if (retryDBUpdate.length > 0){
			infoLogger.info("Retrying DB updates");
			await retryUpdateDB(retryDBUpdate, Failed_Tracker);
		}

		//----------- GLOBAL : Disconnect DB -----------------------------
		let disconnectDb_res = await GLOBAL_ACTIONS.DISCONNECT_DB.func();

		if (disconnectDb_res.error) {
			errorHandler(GLOBAL_ACTIONS.DISCONNECT_DB.action, disconnectDb_res.error.failed);
			Failed_Tracker.processFailed(GLOBAL_ACTIONS.DISCONNECT_DB.action, disconnectDb_res.error.failed);
		}
		//--------------------------------------------------------------

		if (neeedCleanCache){
			infoLogger.info("Retrying clean cache...");
			//----------- GLOBAL : Clean Cache -----------------------------
			let cleanCache_res = await GLOBAL_ACTIONS.CLEAN_CACHE.func();
			if (cleanCache_res.error) {
				errorHandler(GLOBAL_ACTIONS.CLEAN_CACHE.action, cleanCache_res.error.failed);
				Failed_Tracker.processFailed(GLOBAL_ACTIONS.CLEAN_CACHE.action, cleanCache_res.error.failed);
			}
			
		}

	}

	return Failed_Tracker;


}


module.exports={
	mainRetry
}