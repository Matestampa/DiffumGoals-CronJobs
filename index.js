const {DIFFUM_VARS} = require("./config/diffum_config.js");
const {LOG_VARS} = require("./config/logger_config.js");
const {main_diffumProcess} = require("./diffum_goals/main/main.js");
const {setupCronJob, flushLogs_and_closeLogger} = require("./utils.js");
const {infoLogger} = require("./logs/loggers.js");

// 2 MINUTOS
let expiredDiffumTime = DIFFUM_VARS.EXPIRED_DIFFUM_TIME; // 2 MINUTOS

// Check if we're in cron mode
const isCronMode = process.env.CRON_MODE === 'true';

async function run(){
    if (isCronMode) {
        infoLogger.info('Starting cron job mode...');
        infoLogger.info(`Cron job will run every ${expiredDiffumTime} milliseconds`);
        
        const timeInSeconds = Math.floor(expiredDiffumTime / 1000);
        setupCronJob(timeInSeconds, main_diffumProcess, expiredDiffumTime);
        
        // Keep the process alive
        console.log('Cron job started. Press Ctrl+C to stop.');
        process.on('SIGINT', () => {
            console.log('\nStopping cron job...');
            process.exit(0);
        });
        
    } 
    else {
        infoLogger.info('Running in direct execution mode...');
        await main_diffumProcess(expiredDiffumTime);

        if (!LOG_VARS.localEnv){
            await flushLogs_and_closeLogger(0);
        }
    }
}

run();
