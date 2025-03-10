import type { Logger } from "@shared/logger.shared";
import type { Workflow } from "./workflow.core";

/**
 * Chain configuration
 */
export interface ChainConfig {
	name: string;
	workflows?: Record<string, Workflow>;
	logger?: Logger;
}

/**
 * Chain implementation
 */
export interface Chain {
	name: string;
	workflows: Record<string, Workflow>;

	getWorkflow(name: string): Workflow | undefined;
	addWorkflow(name: string, workflow: Workflow): Chain;
}

/**
 * Creates a chain of workflows
 */
export function Chain({ name, workflows = {}, logger }: ChainConfig): Chain {
	return {
		name,
		workflows,

		getWorkflow(workflowName: string) {
			return workflows[workflowName];
		},

		addWorkflow(workflowName: string, workflow: Workflow) {
			workflows[workflowName] = workflow;
			if (logger) {
				logger.debug(`Added workflow ${workflowName} to chain ${name}`);
			}
			return this;
		},
	};
}
