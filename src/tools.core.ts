import { zodToJsonSchema } from "@shared/zod.shared";
import type { z } from "zod";
import type { Agent, Message, ToolCall } from "./agent.core";
import type { Logger } from "./shared/logger.shared";

export type ToolDefinition = {
	name: string;
	description: string;
	parameters: z.ZodType;
	execute: (params: any) => Promise<any>;
};

export type Tool = {
	definition: ToolDefinition;
	execute: (params: any) => Promise<any>;
};

export function createTool(definition: ToolDefinition): Tool {
	return {
		definition,
		execute: definition.execute,
	};
}

export type ToolkitConfig = {
	name: string;
	description?: string;
	logger?: Logger;
};

export type Toolkit = {
	config: ToolkitConfig;
	tools: Record<string, Tool>;
	addTool: (tool: Tool) => Toolkit;
	getTool: (name: string) => Tool | undefined;
	getToolsSchema: () => Record<string, any>;
};

export function createToolkit(config: ToolkitConfig): Toolkit {
	const toolkit: Toolkit = {
		config,
		tools: {},

		addTool(tool: Tool) {
			this.tools[tool.definition.name] = tool;
			return this;
		},

		getTool(name: string) {
			return this.tools[name];
		},

		getToolsSchema() {
			const schema: Record<string, any> = {};

			for (const [name, tool] of Object.entries(this.tools)) {
				schema[name] = {
					description: tool.definition.description,
					parameters: zodToJsonSchema(tool.definition.parameters),
				};
			}

			return schema;
		},
	};

	return toolkit;
}

// Tool handler functionality
export type ToolHandlerOptions = {
	logger?: Logger;
	maxToolCalls?: number;
	showToolCalls?: boolean; // Whether to show tool call messages to the user
};

/**
 * Handles tool calls from an agent, executing tools and managing the conversation flow
 * using OpenAI's proper tool calling API
 * @param agent The agent to use for conversation
 * @param messages The conversation messages
 * @param options Options for tool handling
 * @returns An async generator that yields response chunks
 */
export async function* handleToolCalls(
	agent: Agent,
	messages: Message[],
	options?: ToolHandlerOptions,
): AsyncGenerator<string> {
	const logger = options?.logger || console;
	const maxToolCalls = options?.maxToolCalls || 10; // Prevent infinite loops
	const showToolCalls = options?.showToolCalls || false; // Whether to show tool call messages
	let toolCallCount = 0;
	const currentMessages = [...messages];

	while (true) {
		try {
			// Create a response that can handle tool calls
			const response = await agent.stream(currentMessages);

			// Keep track of text content to add to messages later
			let responseText = "";

			// Stream text content to the user
			for await (const chunk of response.textStream) {
				responseText += chunk;
				yield chunk;
			}

			// No toolCalls stream means we're done
			if (!response.toolCalls) {
				break;
			}

			// Check for tool calls
			let hasToolCalls = false;

			for await (const toolCalls of response.toolCalls) {
				hasToolCalls = true;

				// Enforce max tool calls limit
				toolCallCount += toolCalls.length;
				if (toolCallCount > maxToolCalls) {
					logger.warn(
						`Exceeded maximum tool calls (${maxToolCalls}), stopping execution`,
					);
					if (showToolCalls) {
						yield `\n[Reached maximum tool call limit of ${maxToolCalls}]`;
					}
					break;
				}

				// Add assistant response with tool calls to the conversation
				currentMessages.push({
					role: "assistant",
					content: responseText || null,
					tool_calls: toolCalls,
				});

				// Process each tool call
				for (const toolCall of toolCalls) {
					try {
						// Extract tool name and arguments
						const toolName = toolCall.function.name;
						const argsJson = toolCall.function.arguments;
						let args;

						try {
							args = JSON.parse(argsJson);
						} catch (e) {
							logger.error(
								//@ts-ignore
								`Failed to parse arguments for tool ${toolName}: ${e.message}`,
							);
							if (showToolCalls) {
								yield `\n[Error: Invalid arguments for tool ${toolName}]`;
							}

							// Add error result to continue the conversation
							currentMessages.push({
								role: "tool",
								tool_call_id: toolCall.id,
								name: toolName,
								content: JSON.stringify({
									//@ts-ignore
									error: `Invalid arguments: ${e.message}`,
								}),
							});
							continue;
						}

						// Execute the tool
						logger.info(`Executing tool: ${toolName} with args:`, args);
						if (showToolCalls) {
							yield `\n[Executing tool: ${toolName}]`;
						}

						const result = await agent.executeTool(toolName, args);
						logger.info(`Tool ${toolName} returned:`, result);

						// Add the tool result to the messages
						currentMessages.push({
							role: "tool",
							tool_call_id: toolCall.id,
							name: toolName,
							content: JSON.stringify(result),
						});

						if (showToolCalls) {
							yield `\n[Tool ${toolName} returned: ${JSON.stringify(result, null, 2)}]`;
						}
					} catch (error) {
						logger.error(
							`Error executing tool ${toolCall.function.name}:`,
							error,
						);
						if (showToolCalls) {
							//@ts-ignore
							yield `\n[Error executing tool ${toolCall.function.name}: ${error.message}]`;
						}

						// Add error result to continue the conversation
						currentMessages.push({
							role: "tool",
							tool_call_id: toolCall.id,
							name: toolCall.function.name,
							//@ts-ignore
							content: JSON.stringify({ error: error.message }),
						});
					}
				}
			}

			// If no tool calls were found, we're done
			if (!hasToolCalls) {
				break;
			}

			// Continue the conversation with another iteration to get the final response
		} catch (error) {
			logger.error("Error in tool handler:", error);
			if (showToolCalls) {
				//@ts-ignore
				yield `\n[Error in tool handling: ${error.message}]`;
			}
			break;
		}
	}
}
