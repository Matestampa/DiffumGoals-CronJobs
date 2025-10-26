//Funcion de error Hander va aca y debe importar el logger
const {infoLogger,errorLogger} = require("../../logs/loggers.js")

function errorHandler(action,failedArr) {
	if (!failedArr) return;

	infoLogger.info(`==== Error for action : ${action} =======`)
	for (const {id, error} of failedArr) {
		infoLogger.info(`Error for goalId: ${id}`);
		errorLogger.error(error,{goalId:id,action});
	}
}

module.exports = { errorHandler };