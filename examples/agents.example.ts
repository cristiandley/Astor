import { type Message, createAgent, createLogger, openai } from "../src";

// Create a logger
const logger = createLogger({ level: "info" });

// Create a specialized agent for technical content
const techAgent = createAgent({
	name: "Technical Assistant",
	instructions: `You are a technical expert who explains complex topics clearly.
	Focus on accuracy and precision when answering technical questions.
	Use examples where helpful.`,
	model: openai("gpt-4o"),
});

// Create an agent for creative content
const creativeAgent = createAgent({
	name: "Creative Assistant",
	instructions: `You are a creative assistant who helps with writing and brainstorming.
	Be imaginative and provide unique perspectives.
	Help users develop their ideas further.`,
	model: openai("gpt-4o-mini"), // Using a different model
});

// Example usage
async function main() {
	logger.box("Specialized Agents Example", {
		title: "Astor Agents Demo",
		style: "round",
		padding: 1,
	});

	// Technical query example
	const techQuery: Message[] = [
		{
			role: "user",
			content: "Explain how public key cryptography works in simple terms.",
		},
	];

	logger.box("Technical Agent", { style: "classic" });
	logger.info(
		"User: Explain how public key cryptography works in simple terms.",
	);

	// Start a spinner for the technical response
	logger.start("Generating technical explanation...");

	const techResponse = await techAgent.stream(techQuery);

	// Collect the response first
	let techResult = "";
	for await (const chunk of techResponse.textStream) {
		techResult += chunk;
	}

	logger.success("Technical explanation generated");
	logger.success("Assistant response:");
	logger.info("Result", { techResult });

	// Creative query example
	const creativeQuery: Message[] = [
		{
			role: "user",
			content:
				"Give me a creative name for a coffee shop that serves space-themed drinks.",
		},
	];

	logger.box("Creative Agent", { style: "classic" });
	logger.info(
		"User: Give me a creative name for a coffee shop that serves space-themed drinks.",
	);

	// Start a spinner for the creative response
	logger.start("Generating creative ideas...");

	const creativeResponse = await creativeAgent.stream(creativeQuery);

	// Collect the response first
	let creativeResult = "";
	for await (const chunk of creativeResponse.textStream) {
		creativeResult += chunk;
	}

	logger.success("Creative idea generated");
	logger.success("Assistant response:");
	logger.info("Result", { creativeResult });
}

// Run the example
if (require.main === module) {
	main().catch((err) => {
		console.error("Error:", err);
		process.exit(1);
	});
}

export { techAgent, creativeAgent };
