const {LOG_VARS} = require("../config/logger_config.js");
const {AWS_CLOUDWATCH_VARS} = require("../config/aws_config.js");

const { createLogger, format, transports } = require("winston");
const WinstonCloudWatch = require("winston-cloudwatch");

// AWS CloudWatch configuration
const awsCloudWatchConfig = {
  ...AWS_CLOUDWATCH_VARS,
  uploadRate : 5000,
  maxBatchCount: 100
};

// Get the appropriate transport for info logger based on environment
function getInfoTransport() {
  if (LOG_VARS.localEnv) {
    return new transports.File({ filename: LOG_VARS.infoLogPath });
  } else {
    return new WinstonCloudWatch({
      ...awsCloudWatchConfig,
      logGroupName: LOG_VARS.infoLogGroupName,
      logStreamName: `info-${new Date().toISOString().split('T')[0]}`
    });
  }
}

// Get the appropriate transport for error logger based on environment
function getErrorTransport() {
  if (LOG_VARS.localEnv) {
    return new transports.File({
      filename: LOG_VARS.errorLogPath,
      format: format.combine(format.json())
    });
  } else {
    return new WinstonCloudWatch({
      ...awsCloudWatchConfig,
      logGroupName: LOG_VARS.errorLogGroupName,
      logStreamName: `error-${new Date().toISOString().split('T')[0]}`,
      jsonMessage: true
    });
  }
}

//-------------------------- INFO LOGGER ---------------------------------------------
const infoLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    //Output to console in a human readable format
    new transports.Console({
      format: format.colorize()
    }),

    //Output to local file or CloudWatch based on environment
    getInfoTransport()
  ],
});

//-------------------------- ERROR LOGGER ---------------------------------------------

const errorLogger = createLogger({
  level: "error",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }) // captura stack si es Error
  ),
  transports: [
    
    //Output to console in a human readable format
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, stack, ...meta }) => {
          if (message instanceof Error) {
            return `[${timestamp}] ${level}: ${message.name} - ${message.message} ${JSON.stringify(meta)}\n${stack}`;
          }
          return `[${timestamp}] ${level}: ${message} ${JSON.stringify(meta)}`;
        })
      )
    }),

    //Output to local file or CloudWatch based on environment
    getErrorTransport()
  ]
});




module.exports = {infoLogger, errorLogger};