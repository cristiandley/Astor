import { zodToJsonSchema } from "@shared/zod.shared";
import type { Tool } from "./tools.core";

export type ModelProvider = {
	stream: (
		messages: Message[],
		options?: StreamOptions,
	) => Promise<StreamResponse>;
};

export type StreamOptions = {
	tools?: any[];
	toolChoice?:
		| "auto"
		| "none"
		| { type: "function"; function: { name: string } };
};

export type ToolCall = {
	id: string;
	type: string;
	function: {
		name: string;
		arguments: string;
	};
};

export type Message = {
	role: string;
	content: string | null;
	tool_call_id?: string;
	tool_calls?: ToolCall[];
	name?: string;
};

export type DeltaToolCall = {
	index: number;
	id?: string;
	type?: string;
	function?: {
		name?: string;
		arguments?: string;
	};
};

export type ChunkDelta = {
	role?: string;
	content?: string;
	tool_calls?: DeltaToolCall[];
};

export type Chunk = {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		delta: ChunkDelta;
		finish_reason: string | null;
	}[];
};

export type StreamResponse = {
	textStream: AsyncIterable<string>;
	rawChunks?: AsyncIterable<Chunk>;
	toolCalls?: AsyncIterable<ToolCall[]>;
};

export type AgentConfig = {
	name: string;
	instructions: string;
	model: ModelProvider;
	tools?: Record<string, Tool>; // Support for tools
};

export type Agent = {
	config: AgentConfig;
	stream: (
		messages: Message[],
		options?: StreamOptions,
	) => Promise<StreamResponse>;
	executeTool: (toolName: string, params: any) => Promise<any>;
};

export function createAgent(config: AgentConfig): Agent {
	return {
		config,
		stream: async (messages: Message[], options?: StreamOptions) => {
			// Generate tool schema for API if tools exist
			const toolsFormatted = config.tools
				? Object.values(config.tools).map((tool) => ({
						type: "function",
						function: {
							name: tool.definition.name,
							description: tool.definition.description,
							parameters: zodToJsonSchema(tool.definition.parameters),
						},
					}))
				: undefined;

			// Combine options
			const combinedOptions: StreamOptions = {
				...options,
				tools: toolsFormatted || options?.tools,
			};

			// Don't pass empty tools array
			if (combinedOptions.tools && combinedOptions.tools.length === 0) {
				// biome-ignore lint/performance/noDelete: <explanation>
				delete combinedOptions.tools;
			}

			// Prepend system message with instructions
			const fullMessages = [
				{ role: "system", content: config.instructions },
				...messages,
			];

			return config.model.stream(fullMessages, combinedOptions);
		},
		executeTool: async (toolName: string, params: any) => {
			if (!config.tools || !config.tools[toolName]) {
				throw new Error(`Tool ${toolName} not found`);
			}
			return config.tools[toolName].execute(params);
		},
	};
}

export type OpenAIConfig = {
	apiKey: string; // No longer optional - must be provided
	baseUrl?: string;
	organization?: string;
	temperature?: number;
	maxTokens?: number;
	defaultModel?: string;
};

export function openai(
	modelName: string,
	options: OpenAIConfig, // Required parameter
): ModelProvider {
	return {
		async stream(
			messages: Message[],
			streamOptions?: StreamOptions,
		): Promise<StreamResponse> {
			// Use provided options directly
			const apiKey = options.apiKey;
			const baseUrl = options.baseUrl || "https://api.openai.com/v1";
			const model = modelName || options.defaultModel;

			if (!apiKey) {
				throw new Error(
					"OpenAI API key is required. Provide it in the options when creating the model.",
				);
			}

			if (!model) {
				throw new Error(
					"Model name is required. Provide it either as the first parameter or in options.defaultModel.",
				);
			}

			async function* streamText(response: Response): AsyncGenerator<string> {
				if (!response.body) {
					throw new Error("Response body is null");
				}

				// Get the reader from the response body stream
				const reader = response.body.getReader();
				const decoder = new TextDecoder("utf-8");

				// Process the stream chunks
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					// Convert the chunk to text and add to buffer
					buffer += decoder.decode(value, { stream: true });

					// Process lines in the buffer
					let lineEnd = buffer.indexOf("\n");
					while (lineEnd !== -1) {
						const line = buffer.slice(0, lineEnd).trim();
						buffer = buffer.slice(lineEnd + 1);

						if (line.startsWith("data: ")) {
							const data = line.slice(6);

							if (data === "[DONE]") {
								break;
							}

							try {
								const chunk = JSON.parse(data) as Chunk;

								for (const choice of chunk.choices) {
									// Handle text content
									if (choice.delta.content) {
										yield choice.delta.content;
									}

									// Skip processing tool_calls if not present
									if (!choice.delta.tool_calls) continue;

									// We don't yield anything here - tool calls are handled separately
								}
							} catch (err) {
								// Skip invalid JSON
							}
						}

						lineEnd = buffer.indexOf("\n");
					}
				}

				// Handle any remaining text in the buffer
				if (buffer.trim() && buffer.startsWith("data: ")) {
					const data = buffer.slice(6).trim();
					if (data && data !== "[DONE]") {
						try {
							const chunk = JSON.parse(data) as Chunk;
							const content = chunk.choices?.[0]?.delta?.content || "";
							if (content) {
								yield content;
							}
						} catch (err) {
							// Skip invalid JSON
						}
					}
				}
			}

			async function* streamRawChunks(
				response: Response,
			): AsyncGenerator<Chunk> {
				if (!response.body) {
					throw new Error("Response body is null");
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder("utf-8");
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					let lineEnd = buffer.indexOf("\n");

					while (lineEnd !== -1) {
						const line = buffer.slice(0, lineEnd).trim();
						buffer = buffer.slice(lineEnd + 1);

						if (line.startsWith("data: ")) {
							const data = line.slice(6);

							if (data === "[DONE]") {
								break;
							}

							try {
								const chunk = JSON.parse(data) as Chunk;
								yield chunk;
							} catch (err) {
								// Skip invalid JSON
							}
						}

						lineEnd = buffer.indexOf("\n");
					}
				}
			}

			async function* streamToolCalls(
				response: Response,
			): AsyncGenerator<ToolCall[]> {
				if (!response.body) {
					throw new Error("Response body is null");
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder("utf-8");
				let buffer = "";

				// Keep track of tool calls being built across chunks
				let toolCalls: Record<number, Partial<ToolCall>> = {};

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					let lineEnd = buffer.indexOf("\n");

					while (lineEnd !== -1) {
						const line = buffer.slice(0, lineEnd).trim();
						buffer = buffer.slice(lineEnd + 1);

						if (line.startsWith("data: ")) {
							const data = line.slice(6);

							if (data === "[DONE]") {
								break;
							}

							try {
								const chunk = JSON.parse(data) as Chunk;

								// Process tool calls if present
								if (chunk.choices[0]?.delta?.tool_calls) {
									for (const delta of chunk.choices[0].delta.tool_calls) {
										// Create an entry for this tool call if it doesn't exist
										if (!toolCalls[delta.index]) {
											toolCalls[delta.index] = {
												id: delta.id || `call_${Date.now()}_${delta.index}`,
												type: delta.type || "function",
												function: {
													name: delta.function?.name || "",
													arguments: delta.function?.arguments || "",
												},
											} as ToolCall;
										} else {
											// Update existing tool call
											if (delta.id) toolCalls[delta.index].id = delta.id;
											if (delta.type) toolCalls[delta.index].type = delta.type;

											if (delta.function) {
												if (!toolCalls[delta.index].function) {
													toolCalls[delta.index].function = {
														name: "",
														arguments: "",
													};
												}

												if (delta.function.name) {
													// biome-ignore lint/style/noNonNullAssertion: <explanation>
													toolCalls[delta.index].function!.name =
														delta.function.name;
												}

												if (delta.function.arguments) {
													// biome-ignore lint/style/noNonNullAssertion: <explanation>
													toolCalls[delta.index].function!.arguments =
														// biome-ignore lint/style/noNonNullAssertion: <explanation>
														(toolCalls[delta.index].function!.arguments || "") +
														delta.function.arguments;
												}
											}
										}
									}

									// If the finish reason is tool_calls or we have complete tool calls, yield them
									if (chunk.choices[0].finish_reason === "tool_calls") {
										const completedToolCalls = Object.values(toolCalls).filter(
											(tc) =>
												tc.id &&
												tc.function &&
												tc.function.name &&
												tc.function.arguments,
										) as ToolCall[];

										if (completedToolCalls.length > 0) {
											yield completedToolCalls;
											// Clear the tool calls after yielding
											toolCalls = {};
										}
									}
								}
							} catch (err) {
								// Skip invalid JSON
							}
						}

						lineEnd = buffer.indexOf("\n");
					}
				}

				// Check for any remaining complete tool calls
				const remainingToolCalls = Object.values(toolCalls).filter(
					(tc) =>
						tc.id && tc.function && tc.function.name && tc.function.arguments,
				) as ToolCall[];

				if (remainingToolCalls.length > 0) {
					yield remainingToolCalls;
				}
			}

			try {
				// Prepare request body
				const body: any = {
					model,
					messages,
					temperature: options.temperature ?? 0.7,
					max_tokens: options.maxTokens,
					stream: true,
				};

				// Add tools if provided
				if (streamOptions?.tools && streamOptions.tools.length > 0) {
					body.tools = streamOptions.tools;
				}

				// Add tool_choice if provided
				if (streamOptions?.toolChoice) {
					body.tool_choice = streamOptions.toolChoice;
				}

				const response = await fetch(`${baseUrl}/chat/completions`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${apiKey}`,
						...(options.organization
							? { "OpenAI-Organization": options.organization }
							: {}),
					},
					body: JSON.stringify(body),
				});

				if (!response.ok) {
					const error = await response
						.json()
						.catch(() => ({ error: { message: "Unknown error" } }));
					throw new Error(
						`OpenAI API error: ${error.error?.message || response.statusText}`,
					);
				}

				if (!response.body) {
					throw new Error("Response body is null");
				}

				// Create a clone of the response for each stream
				const clonedResponse1 = response.clone();
				const clonedResponse2 = response.clone();

				return {
					textStream: streamText(response),
					rawChunks: streamRawChunks(clonedResponse1),
					toolCalls: streamToolCalls(clonedResponse2),
				};
			} catch (error) {
				// @ts-ignore
				throw new Error(`Error streaming from OpenAI: ${error.message}`);
			}
		},
	};
}
