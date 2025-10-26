const { InternalError } = require("../error_handling");

class MongoDB_Error extends InternalError{
    constructor(message,attachedError){
        super(message,attachedError)
        this.name="MongoDB_Error";
        this.critic=true;
    }
}

module.exports = {MongoDB_Error};
