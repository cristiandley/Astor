import { z } from "zod";
import {
	type Message,
	createAgent,
	createLogger,
	createTool,
	handleToolCalls,
	openai,
} from "../src";

// Create a logger
const logger = createLogger({ level: "info" });

// Create a search tool
const searchTool = createTool({
	name: "search",
	description: "Search for information on a specific topic",
	parameters: z.object({
		query: z.string().describe("The search query"),
	}),
	execute: async ({ query }) => {
		logger.start(`Searching for: ${query}`);

		// Simulate search delay
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Mock search results
		const results = {
			query,
			results: [
				{
					title: `Information about ${query}`,
					snippet: `This is a summary about ${query} and related concepts.`,
					url: `https://example.com/info/${query.replace(/\s+/g, "-").toLowerCase()}`,
				},
				{
					title: `${query}: A comprehensive guide`,
					snippet: `Everything you need to know about ${query} from basics to advanced topics.`,
					url: `https://example.com/guides/${query.replace(/\s+/g, "-").toLowerCase()}`,
				},
				{
					title: `Latest news on ${query}`,
					snippet: `Recent developments and updates related to ${query}.`,
					url: `https://example.com/news/${query.replace(/\s+/g, "-").toLowerCase()}`,
				},
			],
		};

		logger.success(`Found ${results.results.length} results for: ${query}`);
		return results;
	},
});

// Create a translation tool
const translateTool = createTool({
	name: "translate",
	description: "Translate text from one language to another",
	parameters: z.object({
		text: z.string().describe("The text to translate"),
		targetLanguage: z.string().describe("The target language"),
	}),
	execute: async ({ text, targetLanguage }) => {
		logger.start(`Translating to ${targetLanguage}`);

		// Simulate translation delay
		await new Promise((resolve) => setTimeout(resolve, 800));

		// Mock translation - in a real example, you would use a translation API
		let translatedText = text;

		// Add some simple mock translations for demo purposes
		if (targetLanguage.toLowerCase() === "spanish") {
			translatedText = `[Spanish] ${text}`;
		} else if (targetLanguage.toLowerCase() === "french") {
			translatedText = `[French] ${text}`;
		} else if (targetLanguage.toLowerCase() === "german") {
			translatedText = `[German] ${text}`;
		} else {
			translatedText = `[${targetLanguage}] ${text}`;
		}

		logger.success(`Translation to ${targetLanguage} complete`);
		return {
			originalText: text,
			translatedText,
			language: targetLanguage,
		};
	},
});

// Create an agent with both tools
const researchAgent = createAgent({
	name: "Research Assistant",
	instructions: `You are a helpful research assistant with access to search and translation tools.
Use the search tool to find information when a user asks about a specific topic.
Use the translate tool when a user needs text translated to another language.
Always use the appropriate tool to provide the most helpful and accurate response.`,
	model: openai("gpt-4o"),
	tools: {
		search: searchTool,
		translate: translateTool,
	},
});

// Example usage
async function main() {
	logger.box("Agent with Tools Example", {
		title: "Astor Research Assistant",
		style: "bold",
	});

	// Example 1: Search query
	const searchQuery: Message[] = [
		{ role: "user", content: "Find information about quantum computing." },
	];

	logger.info("User: Find information about quantum computing.");
	logger.start("Processing search request...");

	logger.info("Assistant: ");
	try {
		for await (const chunk of handleToolCalls(researchAgent, searchQuery)) {
			process.stdout.write(chunk);
		}
		logger.success("Search response complete");
	} catch (error) {
		logger.error(`Error: ${error}`);
	}

	// Example 2: Translation request
	console.log("\n" + "=".repeat(50) + "\n");

	const translateQuery: Message[] = [
		{
			role: "user",
			content: 'Translate "Hello, how are you today?" to Spanish.',
		},
	];

	logger.info('User: Translate "Hello, how are you today?" to Spanish.');
	logger.start("Processing translation request...");

	logger.info("Assistant: ");
	try {
		for await (const chunk of handleToolCalls(researchAgent, translateQuery)) {
			process.stdout.write(chunk);
		}
		logger.success("Translation response complete");
	} catch (error) {
		logger.error(`Error: ${error}`);
	}
}

// Run the example
if (require.main === module) {
	main().catch((err) => {
		logger.error("Error:", err);
		process.exit(1);
	});
}

export { researchAgent, searchTool, translateTool };
