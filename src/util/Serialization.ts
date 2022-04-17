interface SentError {
	message: string,
	stack?: string,
	name: string,
	code?: string
}

const errorToJSON = (error: NodeJS.ErrnoException): NodeJS.ErrnoException => {
	return {
		code: error.code,
		errno: error.errno,
		message: error.message,
		name: error.name,
		path: error.path,
		stack: error.stack,
		syscall: error.syscall
	};
};

const reconstructError = (data: NodeJS.ErrnoException): NodeJS.ErrnoException => {
	if (!(data instanceof Error)) return data;
	const objData = data as NodeJS.ErrnoException;
	const result = new Error() as Record<string, any>;
	Object.entries(objData).forEach(([key, value]) => {
		result[key] = value;
	});
	return result as NodeJS.ErrnoException;
};

const stringifyJSON = (data: unknown): any => {
	return JSON.stringify(data, (key, value) => {
		switch(typeof value) {
		case "bigint": {
			return `BIGINT::${value}`;
		}
		case "undefined": {
			return "UNDEFINED::";
		}
		default: {
			return value;
		}
		}
	});
};

const parseJSON = (json: string): any => {
	return JSON.parse(json, (key, value) => {
		if (typeof value === "string") {
			if (value.startsWith("BIGINT::")) {
				return BigInt(value.substring(8)); 
			} else if (value.startsWith("UNDEFINED::")) {
				return undefined;
			}
		}
		return value;
	});
};

export {reconstructError, errorToJSON, stringifyJSON, parseJSON, SentError};