import { z } from "zod";
import {
	createAgent,
	createChain,
	createLogger,
	createStep,
	createWorkflow,
	openai,
} from "../src";

// Create a logger for better output
const logger = createLogger({ level: "info" });

// Create a summarization agent
const summaryAgent = createAgent({
	name: "Text Summarizer",
	instructions: "You are an expert at summarizing text concisely and clearly.",
	model: openai("gpt-4o-mini"),
});

// Create a step for text summarization
const summarizeStep = createStep({
	id: "summarize",
	description: "Summarize the provided text",
	inputSchema: z.object({
		text: z.string().min(1, "Text cannot be empty"),
	}),
	execute: async ({ input }) => {
		logger.start(`Summarizing text (${input.text.length} chars)`);

		const response = await summaryAgent.stream([
			{
				role: "user",
				content: `Summarize this in 2-3 sentences: ${input.text}`,
			},
		]);

		let summary = "";
		for await (const chunk of response.textStream) {
			summary += chunk;
		}

		logger.success("Summary generated");
		return {
			originalText: input.text,
			summary,
			length: {
				original: input.text.length,
				summary: summary.length,
				ratio: (input.text.length / summary.length).toFixed(1),
			},
		};
	},
});

// Create analysis agent
const analysisAgent = createAgent({
	name: "Content Analyzer",
	instructions:
		"You analyze text and identify key themes, tone, and potential improvements.",
	model: openai("gpt-4o-mini"),
});

// Create a step for deeper content analysis
const analyzeStep = createStep({
	id: "analyze",
	description: "Analyze the summary and original content",
	execute: async ({ input }) => {
		logger.start("Analyzing content");

		const response = await analysisAgent.stream([
			{
				role: "user",
				content: `
          I have a text and its summary:
          
          Original: "${input.originalText.substring(0, 500)}${input.originalText.length > 500 ? "..." : ""}"
          
          Summary: "${input.summary}"
          
          Please analyze:
          1. Key themes
          2. Tone of the summary
          3. Accuracy (does the summary capture the main points?)
          4. One suggestion for improvement
        `,
			},
		]);

		let analysis = "";
		for await (const chunk of response.textStream) {
			analysis += chunk;
		}

		logger.success("Analysis complete");
		return {
			...input,
			analysis,
		};
	},
});

// Create a workflow combining these steps
const contentWorkflow = createWorkflow({
	name: "Content Enhancement",
	triggerSchema: z.object({
		text: z.string().min(1, "Text cannot be empty"),
	}),
	logger,
})
	.step(summarizeStep, {
		variables: {
			text: { step: "trigger", path: "text" },
		},
	})
	.then(analyzeStep)
	.commit();

// Create a chain to organize these components
const contentChain = createChain({
	agents: {
		summarizer: summaryAgent,
		analyzer: analysisAgent,
	},
	workflows: {
		contentEnhancement: contentWorkflow,
	},
	logger,
});

// Example usage
async function main() {
	logger.box("Content Chain Example", {
		title: "Astor Chain Demo",
		style: "bold",
	});

	const sampleText = `
    Artificial intelligence (AI) has rapidly transformed various sectors of society, from healthcare 
    to transportation, entertainment to education. This technology, which enables machines to perform 
    tasks that typically require human intelligence, has both ardent supporters and vocal critics. 
    Proponents highlight its potential to solve complex problems, automate tedious tasks, and create 
    new opportunities for human creativity and growth. They point to AI's successes in medical diagnosis, 
    scientific research, and improving accessibility for disabled individuals.

    Critics, however, raise concerns about job displacement, algorithmic bias, privacy violations, 
    and the concentration of power in the hands of large technology companies. They argue that without 
    proper regulation and ethical guidelines, AI development could exacerbate existing societal inequalities 
    or create new ones. Additionally, questions about AI safety and control remain significant topics 
    of debate among researchers and policymakers.

    As AI continues to evolve, societies face the challenge of maximizing its benefits while mitigating 
    potential harms. This requires thoughtful policy approaches, multidisciplinary collaboration, and 
    ongoing dialogue between technologists, ethicists, government officials, and the broader public.
  `;

	logger.info("Running content enhancement workflow...");

	const workflow = contentChain.getWorkflow("contentEnhancement");
	if (!workflow) {
		throw new Error("Workflow not found");
	}

	const run = workflow.createRun();
	const result = await run.run({
		triggerData: { text: sampleText },
	});

	// Display results
	logger.box("Results", {
		title: "Workflow Output",
		style: "double",
	});

	logger.success("Original Text:");
	console.log(`${sampleText.substring(0, 150)}...`);
	console.log(`(${result.results.summarize.length.original} characters)\n`);

	logger.success("Summary:");
	console.log(result.results.summarize.summary);
	console.log(`(${result.results.summarize.length.summary} characters)`);
	console.log(`Compression ratio: ${result.results.summarize.length.ratio}x\n`);

	logger.success("Analysis:");
	logger.info("Result", { analyze: result.results.analyze.analysis });
}

// Run the example
if (require.main === module) {
	main().catch((err) => {
		logger.error("Error:", err);
		process.exit(1);
	});
}

export { contentChain, contentWorkflow, summaryAgent, analysisAgent };
