const {RETRY_VARS}=require("../../config/retry_config.js");

const {RetryData_Manager} = require("../core/classes.js");
const {GLOBAL_ACTIONS}=require("../actions");


const {mainNormal} = require("./mainNormal.js")
const {mainRetry} = require("./mainRetry.js");

const {errorLogger,infoLogger} = require("../../logs/loggers.js");


// startHour inclusive, endHour exclusive (0-1 means 00:00:00 .. 00:59:59)
const NORMAL_EXEC_WINDOW_GMT3 = { startHour: 21, endHour: 22 };

//Pasa la data del json de retry por todas las condiciones y decide si es retry o normal
function evaluate(json_retryData){
	
	const RETRY_ACTION_THAT_CAN_BE_NORMAL=GLOBAL_ACTIONS["CONNECT_DB"].action


	//Si no hay fallidas, decidir si correr (NORMAL) o no (NO-RUN)
	
	if (!json_retryData || Object.keys(json_retryData.failedGoals).length === 0){ 
		// Calculate current hour in GMT-3 (UTC-3)
		const nowUtc = new Date();
		const hourGmt3 = ((nowUtc.getUTCHours() - 3) + 24) % 24;

		// If current time is inside normal execution window in GMT-3, allow NORMAL run
		const inWindow = hourGmt3 >= NORMAL_EXEC_WINDOW_GMT3.startHour && hourGmt3 < NORMAL_EXEC_WINDOW_GMT3.endHour;
		if (inWindow) {
			return {mode:"NORMAL", descr:`No failed goals in json (within GMT-3 ${NORMAL_EXEC_WINDOW_GMT3.startHour}:00-${NORMAL_EXEC_WINDOW_GMT3.endHour}:00)`};
		}

		// Outside the normal execution window - if a normal run already happened today, skip (NO-RUN)
		// otherwise allow a NORMAL run so the pipeline can still execute once per day outside the window
		const lastNormal = json_retryData?.last_normalProcess;
		if (lastNormal) {
			const lastNormalDate = new Date(lastNormal);
			const nowDate = new Date();
			if (lastNormalDate.getDate() === nowDate.getDate() &&
				lastNormalDate.getMonth() === nowDate.getMonth() &&
				lastNormalDate.getFullYear() === nowDate.getFullYear()) {
				// A normal run already executed today, do not run again
				return {mode:"NO-RUN", descr:`No failed goals in json, outside GMT-3 ${NORMAL_EXEC_WINDOW_GMT3.startHour}:00-${NORMAL_EXEC_WINDOW_GMT3.endHour}:00 
										and a normal run has already been executed today at ${lastNormalDate.toISOString()}`};
			}
			/*else{
				// No normal run executed today -> allow NORMAL run
				return {mode:"NORMAL", descr:`No failed goals in json , outside GMT-3 ${NORMAL_EXEC_WINDOW_GMT3.startHour}:00-${NORMAL_EXEC_WINDOW_GMT3.endHour}:00
		                      and no normal run executed today`};
			}*/
		}
		// No normal run executed today -> allow NORMAL run
		return {mode:"NORMAL", descr:`No failed goals in json , outside GMT-3 ${NORMAL_EXEC_WINDOW_GMT3.startHour}:00-${NORMAL_EXEC_WINDOW_GMT3.endHour}:00
						and no normal run executed today`};
	}

	//Si hay fallidas, ver si alguna de las condiciones de retry se cumple
	let failedGoals=json_retryData.failedGoals
	let last_normalProcess=json_retryData.last_normalProcess
	
	//Si hay una accion fallida de tipo "CONNECT_DB" (que es la que puede hacer que un retry se convierta en normal)
	if (failedGoals[RETRY_ACTION_THAT_CAN_BE_NORMAL]){
		
		let last_normalDate=new Date(last_normalProcess)
		let nowDate=new Date()

		//Si la ultima corrida normal ya fue fue en el mismo dia, es retry
		if (last_normalDate.getDate()===nowDate.getDate() &&
			last_normalDate.getMonth()===nowDate.getMonth() &&
			last_normalDate.getFullYear()===nowDate.getFullYear()){
				
				return {mode:"RETRY",descr:"There are failed goals. Connect DB failed and normal process has already run today"};
		}
		//Si no, es normal. Por que quiere decir que ya hubo una corrida normal hoy 
		else {
			
			return {mode:"NORMAL",descr:"There are failed goals. Connect DB failed but normal process has not run today"};
		}

	}
	else{
		
		return {mode:"RETRY",descr:"There are failed goals"};
	}

}


async function main_diffumProcess(){
	let RetryDataMgr=new RetryData_Manager(RETRY_VARS.retryDataFilePath);

	let {data,error}=RetryDataMgr.getDataFromJson()

	if (error){
		errorLogger.error(error);
		return;
	}

	let {mode,descr}=evaluate(data);

	infoLogger.info(`=========== Diffum Process Running Mode : ${mode} - ${descr} ============`);

	if (mode=="NORMAL"){
		
		let Failed_Tracker=await mainNormal();

		//Si hay fallidos, agregar al json
		let failedRecords=Failed_Tracker.getFailedRecords();

		if (failedRecords.length>0){

			RetryDataMgr.updateFailed(failedRecords,true);

			//Chequear si hay alguno de connect db
			let connectDbFailed = failedRecords.some(record => record.action === GLOBAL_ACTIONS["CONNECT_DB"].action);

			//Si hay, dejar la fecha como estas
			//Si no, hay q actualizar la fecha de normal process
			if (!connectDbFailed){
				RetryDataMgr.updateLastProcess("NORMAL");
			}
		
		}
		else{
			RetryDataMgr.updateFailed(failedRecords,true);
			RetryDataMgr.updateLastProcess("NORMAL");
		}

		RetryDataMgr.updateJson();


	}

	if (mode=="RETRY"){
		let Failed_Tracker=await mainRetry(retry_data.failedGoals);

		let failedRecords = Failed_Tracker.getFailedRecords()

		if (failedRecords.length>0){

			//Chequear si hay alguno de connect db
			let connectDbFailed = failedRecords.some(record => record.action === GLOBAL_ACTIONS["CONNECT_DB"].action);


			//Si no hay quiere decir que las siguientes q estaban fallidas se pudieron llegar a aejecutar
			//Por lo tanto de no estar en las fallidas, las podemos sacar del json
			//Y por eso pasamos true en replaceMissing
			if (!connectDbFailed){
				RetryDataMgr.updateFailed(failedRecords,true)
			}

			//Si hay fallo de connect db, quiere decir que no se pudo ejecutar nada
			//Por lo tanto no podemos sacar nada del json
			//Y por eso pasamos false en replaceMissing
			else{
				RetryDataMgr.updateFailed(failedRecords,false)
			}
		
		}
		else{
			RetryDataMgr.updateFailed([],true)
		}

		RetryDataMgr.updateLastProcess("RETRY")
		RetryDataMgr.updateJson()

		//Por cada uno del JSON comparamos con los fallidos del tracker
		//Si esta el mismo fallido no lo reemplzamos (incluso podriamos incrementar un contador de intentos)
		//Si no esta el fallido, quiere decir que fue succesfull y debemos eliminarlo del json
		//Poner fecha en last_retryProcess
	}

}

module.exports={main_diffumProcess};