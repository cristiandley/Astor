import type { z } from "zod";
import type { Logger } from "@shared/logger.shared";

/**
 * Tool definition
 */
export interface ToolDefinition<TParams = any, TResult = any> {
	name: string;
	description: string;
	parameters: z.ZodType<TParams>;
	execute: (params: TParams) => Promise<TResult>;
}

/**
 * Tool implementation
 */
export interface Tool<TParams = any, TResult = any> {
	name: string;
	description: string;
	parameters: z.ZodType<TParams>;
	execute: (params: TParams) => Promise<TResult>;
	definition: {
		name: string;
		description: string;
		parameters: z.ZodType<TParams>;
	};
}

/**
 * Toolkit configuration
 */
export interface ToolkitConfig {
	name: string;
	description?: string;
	logger?: Logger;
}

/**
 * Toolkit implementation
 */
export interface Toolkit {
	name: string;
	description: string;
	tools: Record<string, Tool>;

	addTool<TParams, TResult>(tool: Tool<TParams, TResult>): Toolkit;
	getTool(name: string): Tool | undefined;
}

/**
 * Creates a tool
 */
export function Tool<TParams, TResult>({
	name,
	description,
	parameters,
	execute,
}: {
	name: string;
	description: string;
	parameters: z.ZodType<TParams>;
	execute: (params: TParams) => Promise<TResult>;
}): Tool<TParams, TResult> {
	return {
		name,
		description,
		parameters,
		execute,
		// Add definition property for compatibility with existing code
		definition: {
			name,
			description,
			parameters,
		},
	};
}

/**
 * Creates a toolkit
 */
export function Toolkit({
	name,
	description = "A collection of tools",
	logger,
}: ToolkitConfig): Toolkit {
	const tools: Record<string, Tool> = {};

	return {
		name,
		description,
		tools,

		addTool<TParams, TResult>(tool: Tool<TParams, TResult>) {
			tools[tool.name] = tool;
			if (logger) {
				logger.debug(`Added tool ${tool.name} to toolkit ${name}`);
			}
			return this;
		},

		getTool(toolName: string) {
			return tools[toolName];
		},
	};
}
