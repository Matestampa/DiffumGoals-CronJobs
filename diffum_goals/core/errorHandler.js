//Funcion de error Hander va aca y debe importar el logger
const {infoLogger,errorLogger} = require("../../logs/loggers.js")

function errorHandler(action,failedArr) {
	if (!failedArr) return;

	infoLogger.info(`==== Error for action : ${action} =======`)
	for (const {id, error} of failedArr) {
		infoLogger.info(`Error for goalId: ${id}`);
		errorLogger.error(error,{goalId:id,action});
		errorLogger.error(error.message ? error.message : ".", { errorName:error.name,errorMessage:error.message, stack: error.stack,attachedError:error.attachedError,goalId:id,action:action });

	}
}

module.exports = { errorHandler };