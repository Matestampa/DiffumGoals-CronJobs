const cron = require('node-cron');
const {infoTransport,errorTransport,infoLogger} = require("./logs/loggers.js");


//El logger con winston-cloudwatch queda abierto si cerramos
//el programa directamente, por lo tanto hay que hacer flush de los logs que quedaron
//y cerrar el logger antes de salir
async function flushLogs_and_closeLogger(code = 0) {
	console.log("Flushing logs...");

	await new Promise((resolve) => {
		infoTransport.kthxbye(() => {
		console.log("CloudWatch logs flushed");
		resolve();
		});
	});

	await new Promise((resolve) => {
		errorTransport.kthxbye(() => {
		console.log("CloudWatch logs flushed");
		resolve();
		});
	});

	process.exit(code);
}

function executeScheduledTask(taskFunction, ...args) {
    infoLogger.info('Running scheduled diffum process...');
    taskFunction(...args);
}

function setupCronJob(timeInSeconds, taskFunction, ...args) {
    let cronPattern, useInterval = false;
    
    if (timeInSeconds < 60) {
        useInterval = true;
        cronPattern = `${timeInSeconds} seconds interval`;
    } else if (timeInSeconds < 3600) {
        const minutes = Math.floor(timeInSeconds / 60);
        cronPattern = `*/${minutes} * * * *`;
    } else {
        const hours = Math.floor(timeInSeconds / 3600);
        cronPattern = `0 */${hours} * * *`;
    }
    
    infoLogger.info(`Using ${useInterval ? 'interval' : 'cron pattern'}: ${cronPattern}`);
    
    if (useInterval) {
        setInterval(() => executeScheduledTask(taskFunction, ...args), timeInSeconds * 1000);
    } else {
        cron.schedule(cronPattern, () => executeScheduledTask(taskFunction, ...args));
    }
}

module.exports={flushLogs_and_closeLogger, executeScheduledTask, setupCronJob};