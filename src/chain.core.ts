import type { Logger } from "@shared/logger.shared";
import type { Agent } from "@src/agent.core";
import type { Workflow } from "@src/workflow.core";

export type ChainConfig = {
	agents?: Record<string, Agent>;
	workflows?: Record<string, Workflow>;
	logger?: Logger;
};

export type Chain = {
	config: ChainConfig;
	agents: Record<string, Agent>;
	workflows: Record<string, Workflow>;
	getWorkflow: (name: string) => Workflow | undefined;
	getAgent: (name: string) => Agent | undefined;
	registerAgent: (name: string, agent: Agent) => void;
	registerWorkflow: (name: string, workflow: Workflow) => void;
};

export function createChain(config: ChainConfig): Chain {
	const chain: Chain = {
		config,
		agents: config.agents || {},
		workflows: config.workflows || {},

		getWorkflow(name: string) {
			return chain.workflows[name];
		},

		getAgent(name: string) {
			return chain.agents[name];
		},

		registerAgent(name: string, agent: Agent) {
			chain.agents[name] = agent;
		},

		registerWorkflow(name: string, workflow: Workflow) {
			chain.workflows[name] = workflow;
		},
	};

	return chain;
}
