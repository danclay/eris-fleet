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

export {reconstructError, errorToJSON, SentError};