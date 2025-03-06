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

// Create a calculator tool
const calculatorTool = createTool({
	name: "calculator",
	description: "Perform mathematical calculations",
	parameters: z.object({
		expression: z.string().describe("The mathematical expression to calculate"),
	}),
	execute: async ({ expression }) => {
		// Use consola's start method correctly
		logger.start(`Calculating: ${expression}`);

		try {
			// Add a small delay to simulate processing time
			await new Promise((resolve) => setTimeout(resolve, 800));

			// Simple evaluation - in a real application, use a safer approach
			const result = eval(expression);
			logger.success(`Calculated: ${expression} = ${result}`);
			return { expression, result };
		} catch (error) {
			logger.error(`Calculation error: ${error}`);
			return { expression, error: String(error) };
		}
	},
});

// Create a weather tool (simplified)
const weatherTool = createTool({
	name: "getWeather",
	description: "Get weather information for a location",
	parameters: z.object({
		location: z.string().describe("The city or location"),
	}),
	execute: async ({ location }) => {
		// Start spinner for the weather fetch
		logger.start(`Fetching weather for ${location}`);

		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Mock data
		const weatherData = {
			location,
			temperature: 22,
			conditions: "Sunny",
			humidity: 65,
		};

		logger.success(
			`Weather data for ${location}: ${weatherData.temperature}°C, ${weatherData.conditions}`,
		);
		return weatherData;
	},
});

// Create an agent with tools
const agent = createAgent({
	name: "Tool Assistant",
	instructions: `You are a helpful assistant with access to tools.
You can use the calculator tool to perform mathematical calculations.
You can use the getWeather tool to provide weather information for a location.
Always use the appropriate tool when applicable.`,
	model: openai("gpt-4o"),
	tools: {
		calculator: calculatorTool,
		getWeather: weatherTool,
	},
});

// Example usage
async function main() {
	logger.box("Tools Example", {
		title: "Astor Tools Demo",
		style: "bold",
		padding: 1,
	});

	const messages: Message[] = [
		{
			role: "user",
			content: "What's 345 * 678? Also, how's the weather in Paris?",
		},
	];

	logger.info("User: What's 345 * 678? Also, how's the weather in Paris?");

	// Start the overall process
	logger.start("Getting response from assistant...");

	// Use the tool handler to manage tool execution
	try {
		logger.info("Assistant response:");

		for await (const chunk of handleToolCalls(agent, messages, {
			showToolCalls: true, // Show tool calls for demo purposes
		})) {
			process.stdout.write(chunk);
		}

		logger.success("Assistant completed response");
	} catch (error) {
		logger.error(`Error occurred: ${error}`);
	}
}

// Run the example
if (require.main === module) {
	main().catch((err) => {
		console.error("Error:", err);
		process.exit(1);
	});
}

export { agent, calculatorTool, weatherTool };
