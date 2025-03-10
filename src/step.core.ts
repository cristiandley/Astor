import type { Logger } from "@shared/logger.shared";
import type { z } from "zod";

/**
 * Step execution context
 */
export type Context = {
	getStepResult: (stepId: string) => any;
	setStepResult: (stepId: string, result: any) => void;
};

/**
 * Step configuration
 */
export interface StepConfig {
	id: string;
	description: string;
	inputSchema?: z.ZodType;
	execute: (params: { input?: any; context?: Context }) => Promise<any>;
}

/**
 * Step implementation
 */
export interface Step {
	config: StepConfig;
	execute: (params: { input?: any; context?: Context }) => Promise<any>;
}

/**
 * Creates a step for use in workflows
 */
export function Step({
	id,
	description,
	inputSchema,
	execute,
	logger,
}: StepConfig & { logger?: Logger }) {
	return {
		config: {
			id,
			description,
			inputSchema,
			execute,
		},
		execute,
	};
}
