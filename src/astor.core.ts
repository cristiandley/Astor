import { z } from "zod";
import { openai as aiSdkOpenai } from "@ai-sdk/openai";
import { createLogger } from "./shared/logger.shared";
import { createConfig, type Config } from "./shared/config.shared";
import { Step } from "./step.core";
import { Workflow } from "./workflow.core";
import { Tool, Toolkit } from "./tools.core";
import { Chain } from "./chain.core";
import {
	TextStep,
	ObjectStep,
	StreamTextStep,
	AITool,
	AIObjectTool,
} from "./ai.core";
import type { Logger } from "./shared/logger.shared";

/**
 * Configuration options for Astor
 */
export type AstorConfig = {
	openAIKey?: string;
	defaultModel?: string;
	logLevel?: "debug" | "info" | "warn" | "error";
	environment?: "development" | "production" | "test";
	batchConcurrency?: number;
};

// Define a type for the OpenAI model provider
export type OpenAIModelProvider = any; // Using 'any' for build compatibility, we'll document the actual usage

/**
 * Main Astor class that provides the entry point for the library
 */
export class Astor {
	// Use public modifier for config since TypeScript doesn't like private properties in exported classes
	public readonly config: Config;
	public readonly logger: Logger;

	constructor(config: AstorConfig = {}) {
		// Create validated config using shared config module
		this.config = createConfig(config);

		this.logger = createLogger({ level: this.config.logLevel });

		// Validate config
		if (!this.config.openAIKey) {
			this.logger.warn(
				"No OpenAI API key provided. Specify it in the Astor constructor options.",
			);
		}
	}

	/**
	 * Create an OpenAI model instance
	 */
	openai(model?: string): OpenAIModelProvider {
		if (!this.config.openAIKey) {
			throw new Error(
				"OpenAI API key is required. Specify it in the Astor constructor options.",
			);
		}

		// @ts-ignore
		return aiSdkOpenai(model || this.config.defaultModel, {
			apiKey: this.config.openAIKey,
		});
	}

	/**
	 * Create a step for use in workflows
	 */
	Step(config: any) {
		return Step({
			...config,
			logger: this.logger,
		});
	}

	/**
	 * Create an AI step that generates text
	 */
	TextStep(config: any) {
		return TextStep({
			...config,
			logger: this.logger,
		});
	}

	/**
	 * Create an AI step that generates structured data
	 */
	ObjectStep(config: any) {
		return ObjectStep({
			...config,
			logger: this.logger,
		});
	}

	/**
	 * Create an AI step that streams text
	 */
	StreamTextStep(config: any) {
		return StreamTextStep({
			...config,
			logger: this.logger,
		});
	}

	/**
	 * Create a workflow
	 */
	Workflow(config: any) {
		return Workflow({
			...config,
			logger: this.logger,
		});
	}

	/**
	 * Create a simple AI workflow
	 */
	SimpleWorkflow({
		name,
		model,
		systemPrompt = "You are a helpful assistant.",
	}: {
		name: string;
		model: any; // Model from AI SDK
		systemPrompt?: string;
	}) {
		return this.Workflow({
			name,
			triggerSchema: z.object({
				message: z.string().min(1, "Message cannot be empty"),
				systemPrompt: z.string().optional(),
			}),
		})
			.step(
				this.TextStep({
					id: "generate-response",
					description: "Generate AI response",
					model,
					systemPrompt,
				}),
				{
					variables: {
						message: { step: "trigger", path: "message" },
						systemPrompt: { step: "trigger", path: "systemPrompt" },
					},
				},
			)
			.commit();
	}

	/**
	 * Create a tool
	 */
	Tool(config: any) {
		return Tool(config);
	}

	/**
	 * Create an AI-powered tool
	 */
	AITool(config: any) {
		return AITool({
			...config,
			logger: this.logger,
		});
	}

	/**
	 * Create an AI tool that returns structured data
	 */
	AIObjectTool(config: any) {
		return AIObjectTool({
			...config,
			logger: this.logger,
		});
	}

	/**
	 * Create a toolkit containing multiple tools
	 */
	Toolkit(config: any) {
		return Toolkit({
			...config,
			logger: this.logger,
		});
	}

	/**
	 * Create a chain of workflows
	 */
	Chain(config: any) {
		return Chain({
			...config,
			logger: this.logger,
		});
	}
}

// Export the class
export default Astor;
