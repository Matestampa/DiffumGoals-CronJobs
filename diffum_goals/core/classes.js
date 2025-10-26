const { error } = require('console');
const fs = require('fs');
const path = require('path');

class ReadFile_Error extends Error {
    constructor(message,attachedError){
        super(message,attachedError)
        this.name="ReadFile_Error";
        this.critic=true;
    }
}


class FailedTracker {
	constructor() {
		this.activeRecords = {};
		this.failedRecords = [];
	}

	//Set current active records of the batch
	//it cleans the previous ones
	setActiveRecords(recordIds) {
		this.activeRecords = {};
		for (const id of recordIds) {
			this.activeRecords[id] = { id };
		}
	}

	//Add failed records to the failed list and remove them from active
	//the failed records are neveer deleted from the failed list
	processFailed(action, failedArr) {
		if (!failedArr) return;
		for (const { id, retry_data } of failedArr) {
			this.failedRecords.push({ id, action, retry_data });
		}
		this.__removeFailed_fromActive(failedArr);
	}

	getActiveRecords() {
		return Object.values(this.activeRecords);
	}

	getFailedRecords() {
		return this.failedRecords;
	}

	//Remove failed records from active records
	__removeFailed_fromActive(failedArr) {
		if (!failedArr) return;
		
		for (const { id } of failedArr) {
			delete this.activeRecords[id];
		}
	}
}

class RetryData_Manager {
    constructor(jsonPath) {
        this.jsonPath = jsonPath;
        this.data = null;
    }

    // Read JSON file and return {data, error}
    // If file does not exist or any error happens, return {data: undefined, error: Error}
    // If file exists and parses OK, return {data: this.data, error: undefined}
    getDataFromJson() {
        try {
            if (!fs.existsSync(this.jsonPath)) {
                return { data: undefined, error: new ReadFile_Error(`Retry data file: ${this.jsonPath} does not exist`, null) };
            }
            const raw = fs.readFileSync(this.jsonPath, 'utf8');
            this.data = JSON.parse(raw);
            return { data: this.data, error: undefined };
        } catch (err) {
            return { data: undefined, error: new ReadFile_Error(`Failed to read retry data file: ${this.jsonPath}`, err) };
        }
    }

    // Internal helper used by other methods to ensure this.data is populated.
    // Will initialize to default structure if file missing or unreadable.
    readJson() {
        const res = this.getDataFromJson();
        if (res.error || !res.data) {
            this.data = {
                last_normalProcess: null,
                last_retryProcess: null,
                failedGoals: {}
            };
        }
        return this.data;
    }

    //Vuelca el objeto data al json
    updateJson() {
        if (this.data) {
            fs.writeFileSync(this.jsonPath, JSON.stringify(this.data, null, 2), 'utf8');
        }
    }

    //Updatea la fecha del ultimo proceso segun el tipo (NORMAL o RETRY)
    updateLastProcess(type) {
        if (!this.data) this.readJson();
        const now = new Date().toISOString();
        
        if (type === 'NORMAL') {
            this.data.last_normalProcess = now;
        } else if (type === 'RETRY') {
            this.data.last_retryProcess = now;
        }

    }

    // 3) Update failed goals
    //Recibe las fallidas de este intento -> Array of {id, action, retry_data}
    //Por cada una de las que ya venian en el json, chequea si sigue fallando (esta en el array que recibio)
    //Si sigue fallando, la mantiene
    //Si no sigue fallando, depende el valor de replaceMissing. 
    //Si es true, las borra ; pero is es false las mantiene
    //Ademas agrega las nuevas
    updateFailed(recentFailed,replaceMissing) {
        if (!this.data) this.readJson();
        const failedGoals = this.data.failedGoals || {};

        // Flatten failedGoals to array: [{id, action, retry_data}]
        let previousFailed = [];
        for (const action in failedGoals) {
            for (const entry of failedGoals[action]) {
                previousFailed.push({ id: entry.id, action, retry_data: entry.retry_data });
            }
        }

        // Build a lookup for recentFailed: action+id => retry_data
        const recentMap = new Map();
        for (const obj of recentFailed) {
            recentMap.set(obj.action + '|' + obj.id, obj.retry_data);
        }

        
        let updatedFailed=[]
        if (replaceMissing){
            updatedFailed = previousFailed.filter(entry => {
                return recentMap.has(entry.action + '|' + entry.id);
            });
        }
        else{
            updatedFailed=previousFailed
        }

        // Add new entries from recentFailed that aren't already present
        const prevSet = new Set(updatedFailed.map(e => e.action + '|' + e.id));
        for (const obj of recentFailed) {
            const key = obj.action + '|' + obj.id;
            if (!prevSet.has(key)) {
                updatedFailed.push({ id: obj.id, action: obj.action, retry_data: obj.retry_data });
            }
        }

        // Rebuild failedGoals in the original format
        const newFailedGoals = {};
        for (const entry of updatedFailed) {
            if (!newFailedGoals[entry.action]) newFailedGoals[entry.action] = [];
            newFailedGoals[entry.action].push({ id: entry.id, retry_data: entry.retry_data });
        }
        this.data.failedGoals = newFailedGoals;
    }
}


module.exports = { FailedTracker, RetryData_Manager };