const {InternalError} = require("../../error_handling/general_errors.js");
const {MongoDB_Error} = require("../../mongodb");

class MongoDB_Connection_Error extends InternalError{
    constructor(message,attachedError){
        super(message,attachedError)
        this.name="MongoDB_Connection_Error";
        this.critic=true;
    }
}

class S3_Error extends InternalError{
    constructor(message,attachedError){
        super(message,attachedError)
        this.name="S3_Error";
        this.critic=true;
        this.attachedError=attachedError;
    }
}

class Unknown_Error extends InternalError{
    constructor(message,attachedError){
        super(message,attachedError)
        this.name="Unknown_Error";
        this.critic=true;
    }
}

class CleanCache_Error extends InternalError{
    constructor(message,attachedError){
        super(message,attachedError)
        this.name="CleanCache_Error";
        this.critic=true;
        this.attachedError=attachedError;
    }
}

module.exports = {
    MongoDB_Connection_Error,
    MongoDB_Error,
    S3_Error,
    CleanCache_Error,
    Unknown_Error
}
