import config from './shared/config.shared';

export type ModelProvider = {
    stream: (messages: Message[]) => Promise<StreamResponse>;
};

export type Message = {
    role: string;
    content: string;
};

export type StreamResponse = {
    textStream: AsyncIterable<string>;
};

export type AgentConfig = {
    name: string;
    instructions: string;
    model: ModelProvider;
};

export type Agent = {
    config: AgentConfig;
    stream: (messages: Message[]) => Promise<StreamResponse>;
};

export function createAgent(config: AgentConfig): Agent {
    return {
        config,
        stream: async (messages: Message[]) => {
            // Prepend system message with instructions
            const fullMessages = [
                { role: 'system', content: config.instructions },
                ...messages,
            ];

            return config.model.stream(fullMessages);
        }
    };
}

export type OpenAIConfig = {
    apiKey?: string;
    baseUrl?: string;
    organization?: string;
    temperature?: number;
    maxTokens?: number;
};

export function openai(modelName?: string, options?: OpenAIConfig): ModelProvider {
    return {
        async stream(messages: Message[]): Promise<StreamResponse> {
            // Default options using application config
            const apiKey = options?.apiKey || config.openAiKey;
            const baseUrl = options?.baseUrl || 'https://api.openai.com/v1';
            const model = modelName || config.defaultModel;

            if (!apiKey) {
                throw new Error('OpenAI API key is required. Set it in options, as OPENAI_API_KEY environment variable, or in your config.');
            }

            async function* streamImplementation(): AsyncGenerator<string> {
                try {
                    const response = await fetch(`${baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                            ...(options?.organization ? { 'OpenAI-Organization': options.organization } : {}),
                        },
                        body: JSON.stringify({
                            model,
                            messages,
                            temperature: options?.temperature ?? 0.7,
                            max_tokens: options?.maxTokens,
                            stream: true,
                        }),
                    });

                    if (!response.ok) {
                        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
                        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
                    }

                    if (!response.body) {
                        throw new Error('Response body is null');
                    }

                    // Get the reader from the response body stream
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder('utf-8');

                    // Process the stream chunks
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        // Convert the chunk to text and add to buffer
                        buffer += decoder.decode(value, { stream: true });

                        // Process lines in the buffer
                        let lineEnd = buffer.indexOf('\n');
                        while (lineEnd !== -1) {
                            const line = buffer.slice(0, lineEnd).trim();
                            buffer = buffer.slice(lineEnd + 1);

                            if (line.startsWith('data: ')) {
                                const data = line.slice(6);

                                if (data === '[DONE]') {
                                    break;
                                }

                                try {
                                    const json = JSON.parse(data);
                                    const content = json.choices?.[0]?.delta?.content || '';
                                    if (content) {
                                        yield content;
                                    }
                                } catch (err) {
                                    // Skip invalid JSON
                                }
                            }

                            lineEnd = buffer.indexOf('\n');
                        }
                    }

                    // Handle any remaining text in the buffer
                    if (buffer.trim() && buffer.startsWith('data: ')) {
                        const data = buffer.slice(6).trim();
                        if (data && data !== '[DONE]') {
                            try {
                                const json = JSON.parse(data);
                                const content = json.choices?.[0]?.delta?.content || '';
                                if (content) {
                                    yield content;
                                }
                            } catch (err) {
                                // Skip invalid JSON
                            }
                        }
                    }
                } catch (error) {
                    // @ts-ignore
                    throw new Error(`Error streaming from OpenAI: ${error.message}`);
                }
            }

            return {
                textStream: streamImplementation(),
            };
        }
    };
}