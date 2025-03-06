import { z } from 'zod';
import {
    createAgent,
    createStep,
    createWorkflow,
    openai,
    createLogger
} from '@src/index';

// Create a dedicated logger for this example
const logger = createLogger({ level: 'debug' });

// Define input schema
const conversationSchema = z.object({
    message: z.string().min(1, "Message cannot be empty"),
    systemPrompt: z.string().optional().default("You are a helpful assistant.")
});

// Create an agent
const assistant = createAgent({
    name: 'Conversation Assistant',
    instructions: "You are a helpful AI assistant. Respond in a concise and friendly manner.",
    model: openai('gpt-4o-mini')
});

// Create steps for the workflow
const validateInputStep = createStep({
    id: 'validate-input',
    description: 'Validate user input',
    inputSchema: conversationSchema,
    execute: async ({ input }) => {
        // Log the input we received from the trigger
        logger.debug(`Received input: ${JSON.stringify(input)}`);
        logger.info('Input validated successfully');
        return input;
    }
});

const generateResponseStep = createStep({
    id: 'generate-response',
    description: 'Generate response using LLM',
    execute: async ({ input, context }) => {
        // Log what we received from the previous step
        logger.debug(`Generate response received input: ${JSON.stringify(input)}`);

        logger.info('Generating response to user query');

        // Get message and prompt from context if not directly in input
        let userMessage = input.message;
        let systemPrompt = input.systemPrompt || "You are a helpful assistant.";

        // If input doesn't have message directly, try to get from trigger
        if (!userMessage && context) {
            const triggerData = context.getStepResult('trigger');
            logger.debug(`Looking at trigger data: ${JSON.stringify(triggerData)}`);

            if (triggerData) {
                userMessage = triggerData.message;
                systemPrompt = triggerData.systemPrompt || systemPrompt;
            }
        }

        logger.debug(`System prompt: ${systemPrompt}`);
        logger.debug(`User message: ${userMessage}`);

        if (!userMessage) {
            logger.error("No user message found in input or trigger data");
            throw new Error("No user message provided");
        }

        // Create messages for the conversation
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ];

        // Stream the response from the assistant
        const response = await assistant.stream(messages);

        // For simplicity, we'll collect the response
        let fullResponse = '';
        for await (const chunk of response.textStream) {
            fullResponse += chunk;
        }

        return {
            query: userMessage,
            response: fullResponse,
            timestamp: new Date().toISOString()
        };
    }
});

// Create and commit the workflow
const conversationWorkflow = createWorkflow({
    name: 'Simple Conversation',
    triggerSchema: conversationSchema,
    logger
})
    .step(validateInputStep, {
        // Explicitly map variables from trigger data
        variables: {
            message: { step: 'trigger', path: 'message' },
            systemPrompt: { step: 'trigger', path: 'systemPrompt' }
        }
    })
    .then(generateResponseStep, {
        // Explicitly map variables from previous step
        variables: {
            message: { step: 'validate-input', path: 'message' },
            systemPrompt: { step: 'validate-input', path: 'systemPrompt' }
        }
    })
    .commit();

// Export the workflow for usage
export default conversationWorkflow;

// Example usage
async function runExample() {
    const runObj = conversationWorkflow.createRun();

    console.log("Running workflow with quantum computing question...\n");

    const result = await runObj.run({
        triggerData: {
            message: "What are three interesting facts about quantum computing?",
            systemPrompt: "You are a quantum computing expert. Be technical but concise."
        }
    });

    console.log("\nWorkflow execution complete.\n");

    // Print just the main input/output for clarity
    console.log("INPUT:");
    console.log("------");
    console.log(`Message: ${result.results.trigger.message}`);
    console.log(`System Prompt: ${result.results.trigger.systemPrompt}`);
    console.log("\nOUTPUT:");
    console.log("-------");

    if (result.results['generate-response'] && !result.results['generate-response'].status) {
        console.log(result.results['generate-response'].response);
    } else {
        console.log("Error generating response:", result.results['generate-response']?.error || "Unknown error");
    }

    // Full results for debugging
    console.log("\nFULL RESULTS:");
    console.log("-------------");
    console.log(JSON.stringify(result.results, null, 2));
}

// Run the example
runExample().catch(err => {
    console.error("Error running example:", err);
    process.exit(1);
});