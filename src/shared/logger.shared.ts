import { createConsola } from "consola";

export type LogLevel =
	| "silent"
	| "fatal"
	| "error"
	| "warn"
	| "info"
	| "success"
	| "debug"
	| "trace";

export interface LoggerConfig {
	level?: LogLevel;
	colors?: boolean;
	compact?: boolean;
	timestamp?: boolean;
}

export interface Logger {
	debug(message: string, ...args: any[]): void;
	info(message: string, ...args: any[]): void;
	warn(message: string, ...args: any[]): void;
	error(message: string, ...args: any[]): void;
	success(message: string, ...args: any[]): void;
	fatal(message: string, ...args: any[]): void;
	trace(message: string, ...args: any[]): void;
	box(message: string, options?: any): void;
	start(message: string, options?: any): any;
}

const logLevelMap: Record<LogLevel, number> = {
	silent: 0,
	fatal: 1,
	error: 2,
	warn: 3,
	info: 4,
	success: 5,
	debug: 6,
	trace: 7,
};

export function createLogger(config?: LoggerConfig): Logger {
	return createConsola({
		level: config?.level ? logLevelMap[config.level] : 4, // Default to info
		formatOptions: {
			date: config?.timestamp ?? true,
			colors: config?.colors ?? true,
			compact: config?.compact ?? false,
		},
	});
}

export const logger = createLogger();

export default logger;
