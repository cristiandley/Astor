import { z } from "zod";
import type { Logger } from "@shared/logger.shared";
import { generateObject, generateText, streamText } from "ai";

import { Step } from "./step.core";
import { Tool } from "./tools.core";

/**
 * Creates an AI step that generates text
 */
export function TextStep({
	id,
	description,
	model,
	systemPrompt,
	inputSchema = z.object({
		message: z.string().min(1, "Message cannot be empty"),
	}),
	logger,
}: {
	id: string;
	description: string;
	model: any;
	systemPrompt?: string;
	inputSchema?: z.ZodType;
	logger?: Logger;
}) {
	return Step({
		id,
		description,
		inputSchema,
		execute: async ({ input }) => {
			const userMessage = input.message;
			const system =
				systemPrompt || input.systemPrompt || "You are a helpful assistant.";

			if (logger) {
				logger.debug(`System prompt: ${system}`);
				logger.debug(`User message: ${userMessage}`);
			}

			const { text } = await generateText({
				model,
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: userMessage },
				],
			});

			return {
				query: userMessage,
				response: text,
				timestamp: new Date().toISOString(),
			};
		},
	});
}

/**
 * Creates an AI step that generates structured data
 */
export function ObjectStep({
	id,
	description,
	model,
	schema,
	systemPrompt,
	inputSchema = z.object({
		message: z.string().min(1, "Message cannot be empty"),
	}),
	logger,
}: {
	id: string;
	description: string;
	model: any;
	schema: z.ZodType;
	systemPrompt?: string;
	inputSchema?: z.ZodType;
	logger?: Logger;
}) {
	return Step({
		id,
		description,
		inputSchema,
		execute: async ({ input }) => {
			const userMessage = input.message;
			const system =
				systemPrompt || input.systemPrompt || "You are a helpful assistant.";

			if (logger) {
				logger.debug(`System prompt: ${system}`);
				logger.debug(`User message: ${userMessage}`);
			}

			const { object } = await generateObject({
				model,
				schema,
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: userMessage },
				],
			});

			return {
				query: userMessage,
				response: object,
				timestamp: new Date().toISOString(),
			};
		},
	});
}

/**
 * Creates an AI step that streams text
 */
export function StreamTextStep({
	id,
	description,
	model,
	systemPrompt,
	inputSchema = z.object({
		message: z.string().min(1, "Message cannot be empty"),
	}),
	onChunk,
	logger,
}: {
	id: string;
	description: string;
	model: any;
	systemPrompt?: string;
	inputSchema?: z.ZodType;
	onChunk?: (chunk: string) => void;
	logger?: Logger;
}) {
	return Step({
		id,
		description,
		inputSchema,
		execute: async ({ input }) => {
			const userMessage = input.message;
			const system =
				systemPrompt || input.systemPrompt || "You are a helpful assistant.";

			if (logger) {
				logger.debug(`System prompt: ${system}`);
				logger.debug(`User message: ${userMessage}`);
			}

			const { textStream } = streamText({
				model,
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: userMessage },
				],
			});

			// Collect all chunks
			let fullResponse = "";
			for await (const chunk of textStream) {
				fullResponse += chunk;
				if (onChunk) {
					onChunk(chunk);
				}
			}

			return {
				query: userMessage,
				response: fullResponse,
				timestamp: new Date().toISOString(),
			};
		},
	});
}

/**
 * Creates an AI-powered tool
 */
export function AITool({
	name,
	description,
	parameters,
	model,
	systemPrompt = "You are an AI assistant that provides tool functionality.",
	logger,
}: {
	name: string;
	description: string;
	parameters: z.ZodType;
	model: any;
	systemPrompt?: string;
	logger?: Logger;
}) {
	return Tool({
		name,
		description,
		parameters,
		execute: async (params) => {
			// Format parameters for the prompt
			const paramsText = Object.entries(params)
				.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
				.join("\n");

			if (logger) {
				logger.debug(`Executing AI tool: ${name}`);
				logger.debug(`Parameters: ${paramsText}`);
			}

			const { text } = await generateText({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{
						role: "user",
						content: `Execute the ${name} tool with these parameters:\n${paramsText}`,
					},
				],
			});

			return { result: text };
		},
	});
}

/**
 * Creates an AI tool that returns structured data
 */
export function AIObjectTool<TResult extends z.ZodType>({
	name,
	description,
	parameters,
	resultSchema,
	model,
	systemPrompt = "You are an AI assistant that provides structured data.",
	logger,
}: {
	name: string;
	description: string;
	parameters: z.ZodType;
	resultSchema: TResult;
	model: any;
	systemPrompt?: string;
	logger?: Logger;
}) {
	return Tool({
		name,
		description,
		parameters,
		execute: async (params) => {
			// Format parameters for the prompt
			const paramsText = Object.entries(params)
				.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
				.join("\n");

			if (logger) {
				logger.debug(`Executing AI object tool: ${name}`);
				logger.debug(`Parameters: ${paramsText}`);
			}

			const { object } = await generateObject({
				model,
				schema: resultSchema,
				messages: [
					{ role: "system", content: systemPrompt },
					{
						role: "user",
						content: `Execute the ${name} tool with these parameters:\n${paramsText}`,
					},
				],
			});

			return object as z.infer<TResult>;
		},
	});
}
