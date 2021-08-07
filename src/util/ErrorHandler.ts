interface SentError {
	message: string,
	stack?: string,
	name: string,
	code?: string
}

const reconstructError = (data: unknown) => {
	if (!(typeof data === "object") || data === null) return data;
	const objData = data as Record<string, any>;
	const result = new Error() as NodeJS.ErrnoException;
	result.message = objData.message;
	result.stack = objData.stack;
	result.name = objData.name;
	result.code = objData.code;
	return result;
};

export {reconstructError, SentError};