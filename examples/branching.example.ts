import { z } from 'zod';
import {
    createAgent,
    createStep,
    createWorkflow,
    createTool,
    createToolkit,
    openai,
    createLogger
} from '../src';

// Create a dedicated logger for this example
const logger = createLogger({ level: 'info' });

// Define schema for the support ticket input
const ticketSchema = z.object({
    id: z.string(),
    subject: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    category: z.enum(['technical', 'billing', 'general', 'feature']),
    customer: z.object({
        name: z.string(),
        email: z.string().email(),
        tier: z.enum(['free', 'basic', 'premium', 'enterprise']).default('free')
    })
});

// Create different agents for different support categories
const technicalAgent = createAgent({
    name: 'Technical Support',
    instructions: `
    You are a technical support specialist. 
    Provide detailed technical solutions based on the customer's issue.
    For premium and enterprise customers, include advanced solutions.
    Always provide step-by-step troubleshooting guidance.
  `,
    model: openai('gpt-4o')
});

const billingAgent = createAgent({
    name: 'Billing Support',
    instructions: `
    You are a billing support specialist.
    Help customers understand their bills and resolve payment issues.
    Provide clear explanations of charges and subscription details.
    For enterprise customers, mention their dedicated account manager.
  `,
    model: openai('gpt-4o-mini')
});

const generalAgent = createAgent({
    name: 'General Support',
    instructions: `
    You are a general customer support agent.
    Provide friendly and helpful responses to general inquiries.
    Direct technical or billing issues to the appropriate department.
  `,
    model: openai('gpt-4o-mini')
});

// Create a sentiment analysis tool
const sentimentAnalysisTool = createTool({
    name: 'analyzeSentiment',
    description: 'Analyzes the sentiment of a text',
    parameters: z.object({
        text: z.string().min(1)
    }),
    execute: async ({ text }) => {
        // Simplified sentiment analysis for example purposes
        const negativeWords = ['angry', 'upset', 'terrible', 'awful', 'horrible', 'bad', 'worst'];
        const positiveWords = ['happy', 'great', 'excellent', 'good', 'wonderful', 'best', 'pleased'];

        const lowerText = text.toLowerCase();
        let score = 0;

        for (const word of negativeWords) {
            if (lowerText.includes(word)) score -= 1;
        }

        for (const word of positiveWords) {
            if (lowerText.includes(word)) score += 1;
        }

        return {
            score,
            sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
            confidence: Math.min(Math.abs(score) / 3, 1) // Normalize to 0-1 range
        };
    }
});

// Create tools toolkit
const supportToolkit = createToolkit({
    name: 'Support Tools',
    description: 'Tools for support ticket analysis',
    logger
}).addTool(sentimentAnalysisTool);

// Create workflow steps
const validateTicketStep = createStep({
    id: 'validate-ticket',
    description: 'Validate the support ticket data',
    inputSchema: ticketSchema,
    execute: async ({ input }) => {
        logger.debug(`Validate step received: ${JSON.stringify(input)}`);
        logger.info(`Processing ticket: ${input.id} - ${input.subject}`);
        return input;
    }
});

const analyzeSentimentStep = createStep({
    id: 'analyze-sentiment',
    description: 'Analyze customer sentiment',
    execute: async ({ input, context }) => {
        logger.debug(`Sentiment step received: ${JSON.stringify(input)}`);

        const sentimentTool = supportToolkit.getTool('analyzeSentiment');

        if (!sentimentTool) {
            logger.error('Sentiment analysis tool not found in toolkit');
            throw new Error('Sentiment analysis tool not found');
        }

        const text = `${input.subject} ${input.description}`;
        logger.debug(`Analyzing sentiment for text: ${text.substring(0, 100)}...`);

        const sentimentResult = await sentimentTool.execute({ text });

        logger.info(`Sentiment analysis for ticket ${input.id}: ${sentimentResult.sentiment} (${sentimentResult.score})`);

        return {
            ...input,
            sentimentAnalysis: sentimentResult
        };
    }
});

const prioritizeTicketStep = createStep({
    id: 'prioritize-ticket',
    description: 'Adjust ticket priority based on sentiment and customer tier',
    execute: async ({ input, context }) => {
        logger.debug(`Prioritize step received: ${JSON.stringify(input)}`);

        const { priority, customer, sentimentAnalysis } = input;

        if (!sentimentAnalysis) {
            logger.error('Missing sentiment analysis data');
            throw new Error('Sentiment analysis data is required for prioritization');
        }

        let adjustedPriority = priority;

        // Upgrade priority for negative sentiment
        if (sentimentAnalysis.sentiment === 'negative' && sentimentAnalysis.confidence > 0.5) {
            if (priority === 'low') adjustedPriority = 'medium';
            else if (priority === 'medium') adjustedPriority = 'high';
        }

        // Upgrade priority for premium and enterprise customers
        if (['premium', 'enterprise'].includes(customer.tier)) {
            if (adjustedPriority === 'low') adjustedPriority = 'medium';
            else if (adjustedPriority === 'medium') adjustedPriority = 'high';
        }

        logger.info(`Adjusted priority for ticket ${input.id}: ${priority} -> ${adjustedPriority}`);

        return {
            ...input,
            originalPriority: priority,
            priority: adjustedPriority
        };
    }
});

const routeTicketStep = createStep({
    id: 'route-ticket',
    description: 'Route the ticket to the appropriate department',
    execute: async ({ input, context }) => {
        logger.debug(`Route step received: ${JSON.stringify(input)}`);

        // Add routing metadata
        return {
            ...input,
            routing: {
                department: input.category,
                timestamp: new Date().toISOString()
            }
        };
    }
});

// Technical support response step
const technicalResponseStep = createStep({
    id: 'technical-response',
    description: 'Generate technical support response',
    execute: async ({ input, context }) => {
        logger.debug(`Technical response step received: ${JSON.stringify(input) || 'undefined'}`);

        if (!input || !input.id) {
            // Try to get data from context if input is missing
            const routeStepResult = context?.getStepResult('route-ticket');
            if (!routeStepResult) {
                logger.error('No input provided and cannot find route-ticket step result');
                throw new Error('Missing ticket data for technical response');
            }
            input = routeStepResult;
            logger.debug(`Retrieved input from route-ticket step: ${JSON.stringify(input)}`);
        }

        logger.info(`Generating technical response for ticket ${input.id}`);

        const prompt = `
Customer: ${input.customer.name}
Customer Tier: ${input.customer.tier}
Ticket ID: ${input.id}
Subject: ${input.subject}
Description: ${input.description}
Priority: ${input.priority}

Please provide a technical support response to help resolve this issue.
`;

        const response = await technicalAgent.stream([
            { role: 'user', content: prompt }
        ]);

        // Collect response
        let fullResponse = '';
        for await (const chunk of response.textStream) {
            fullResponse += chunk;
        }

        return {
            ...input,
            response: {
                type: 'technical',
                content: fullResponse,
                timestamp: new Date().toISOString()
            }
        };
    }
});

// Billing support response step
const billingResponseStep = createStep({
    id: 'billing-response',
    description: 'Generate billing support response',
    execute: async ({ input, context }) => {
        logger.debug(`Billing response step received: ${JSON.stringify(input) || 'undefined'}`);

        if (!input || !input.id) {
            // Try to get data from context if input is missing
            const routeStepResult = context?.getStepResult('route-ticket');
            if (!routeStepResult) {
                logger.error('No input provided and cannot find route-ticket step result');
                throw new Error('Missing ticket data for billing response');
            }
            input = routeStepResult;
            logger.debug(`Retrieved input from route-ticket step: ${JSON.stringify(input)}`);
        }

        logger.info(`Generating billing response for ticket ${input.id}`);

        const prompt = `
Customer: ${input.customer.name}
Customer Tier: ${input.customer.tier}
Ticket ID: ${input.id}
Subject: ${input.subject}
Description: ${input.description}
Priority: ${input.priority}

Please provide a billing support response to help resolve this financial issue.
`;

        const response = await billingAgent.stream([
            { role: 'user', content: prompt }
        ]);

        // Collect response
        let fullResponse = '';
        for await (const chunk of response.textStream) {
            fullResponse += chunk;
        }

        return {
            ...input,
            response: {
                type: 'billing',
                content: fullResponse,
                timestamp: new Date().toISOString()
            }
        };
    }
});

// General support response step
const generalResponseStep = createStep({
    id: 'general-response',
    description: 'Generate general support response',
    execute: async ({ input, context }) => {
        logger.debug(`General response step received: ${JSON.stringify(input) || 'undefined'}`);

        if (!input || !input.id) {
            // Try to get data from context if input is missing
            const routeStepResult = context?.getStepResult('route-ticket');
            if (!routeStepResult) {
                logger.error('No input provided and cannot find route-ticket step result');
                throw new Error('Missing ticket data for general response');
            }
            input = routeStepResult;
            logger.debug(`Retrieved input from route-ticket step: ${JSON.stringify(input)}`);
        }

        logger.info(`Generating general response for ticket ${input.id}`);

        const prompt = `
Customer: ${input.customer.name}
Customer Tier: ${input.customer.tier}
Ticket ID: ${input.id}
Subject: ${input.subject}
Description: ${input.description}
Priority: ${input.priority}

Please provide a helpful general support response.
`;

        const response = await generalAgent.stream([
            { role: 'user', content: prompt }
        ]);

        // Collect response
        let fullResponse = '';
        for await (const chunk of response.textStream) {
            fullResponse += chunk;
        }

        return {
            ...input,
            response: {
                type: 'general',
                content: fullResponse,
                timestamp: new Date().toISOString()
            }
        };
    }
});

// Feature request response step
const featureResponseStep = createStep({
    id: 'feature-response',
    description: 'Generate feature request response',
    execute: async ({ input, context }) => {
        logger.debug(`Feature response step received: ${JSON.stringify(input) || 'undefined'}`);

        if (!input || !input.id) {
            // Try to get data from context if input is missing
            const routeStepResult = context?.getStepResult('route-ticket');
            if (!routeStepResult) {
                logger.error('No input provided and cannot find route-ticket step result');
                throw new Error('Missing ticket data for feature response');
            }
            input = routeStepResult;
            logger.debug(`Retrieved input from route-ticket step: ${JSON.stringify(input)}`);
        }

        logger.info(`Generating feature request response for ticket ${input.id}`);

        const prompt = `
Customer: ${input.customer.name}
Customer Tier: ${input.customer.tier}
Ticket ID: ${input.id}
Subject: ${input.subject}
Description: ${input.description}
Priority: ${input.priority}

This is a feature request. Please thank the customer for their suggestion, let them know we'll consider it for future updates, and provide information about current similar features if available.
`;

        const response = await generalAgent.stream([
            { role: 'user', content: prompt }
        ]);

        // Collect response
        let fullResponse = '';
        for await (const chunk of response.textStream) {
            fullResponse += chunk;
        }

        return {
            ...input,
            response: {
                type: 'feature',
                content: fullResponse,
                timestamp: new Date().toISOString()
            }
        };
    }
});

// Create workflow with branching
const supportWorkflow = createWorkflow({
    name: 'Support Ticket Workflow',
    triggerSchema: ticketSchema,
    logger
})
    .step(validateTicketStep, {
        variables: {
            id: { step: 'trigger', path: 'id' },
            subject: { step: 'trigger', path: 'subject' },
            description: { step: 'trigger', path: 'description' },
            priority: { step: 'trigger', path: 'priority' },
            category: { step: 'trigger', path: 'category' },
            customer: { step: 'trigger', path: 'customer' }
        }
    })
    .then(analyzeSentimentStep)
    .then(prioritizeTicketStep)
    .then(routeTicketStep)

    // Branch based on category using conditional steps with explicit variable mapping
    .step(technicalResponseStep, {
        when: {
            ref: { step: 'route-ticket', path: 'routing.department' },
            query: { $eq: 'technical' }
        },
        variables: {
            // Map all fields from the route-ticket step
            id: { step: 'route-ticket', path: 'id' },
            subject: { step: 'route-ticket', path: 'subject' },
            description: { step: 'route-ticket', path: 'description' },
            priority: { step: 'route-ticket', path: 'priority' },
            category: { step: 'route-ticket', path: 'category' },
            customer: { step: 'route-ticket', path: 'customer' },
            sentimentAnalysis: { step: 'route-ticket', path: 'sentimentAnalysis' },
            originalPriority: { step: 'route-ticket', path: 'originalPriority' },
            routing: { step: 'route-ticket', path: 'routing' }
        }
    })

    .step(billingResponseStep, {
        when: {
            ref: { step: 'route-ticket', path: 'routing.department' },
            query: { $eq: 'billing' }
        },
        variables: {
            // Map all fields from the route-ticket step
            id: { step: 'route-ticket', path: 'id' },
            subject: { step: 'route-ticket', path: 'subject' },
            description: { step: 'route-ticket', path: 'description' },
            priority: { step: 'route-ticket', path: 'priority' },
            category: { step: 'route-ticket', path: 'category' },
            customer: { step: 'route-ticket', path: 'customer' },
            sentimentAnalysis: { step: 'route-ticket', path: 'sentimentAnalysis' },
            originalPriority: { step: 'route-ticket', path: 'originalPriority' },
            routing: { step: 'route-ticket', path: 'routing' }
        }
    })

    .step(generalResponseStep, {
        when: {
            ref: { step: 'route-ticket', path: 'routing.department' },
            query: { $eq: 'general' }
        },
        variables: {
            // Map all fields from the route-ticket step
            id: { step: 'route-ticket', path: 'id' },
            subject: { step: 'route-ticket', path: 'subject' },
            description: { step: 'route-ticket', path: 'description' },
            priority: { step: 'route-ticket', path: 'priority' },
            category: { step: 'route-ticket', path: 'category' },
            customer: { step: 'route-ticket', path: 'customer' },
            sentimentAnalysis: { step: 'route-ticket', path: 'sentimentAnalysis' },
            originalPriority: { step: 'route-ticket', path: 'originalPriority' },
            routing: { step: 'route-ticket', path: 'routing' }
        }
    })

    .step(featureResponseStep, {
        when: {
            ref: { step: 'route-ticket', path: 'routing.department' },
            query: { $eq: 'feature' }
        },
        variables: {
            // Map all fields from the route-ticket step
            id: { step: 'route-ticket', path: 'id' },
            subject: { step: 'route-ticket', path: 'subject' },
            description: { step: 'route-ticket', path: 'description' },
            priority: { step: 'route-ticket', path: 'priority' },
            category: { step: 'route-ticket', path: 'category' },
            customer: { step: 'route-ticket', path: 'customer' },
            sentimentAnalysis: { step: 'route-ticket', path: 'sentimentAnalysis' },
            originalPriority: { step: 'route-ticket', path: 'originalPriority' },
            routing: { step: 'route-ticket', path: 'routing' }
        }
    })

    .commit();

// Export the workflow for usage
export default supportWorkflow;

// Example usage
async function runExample() {
    console.log("Running support ticket workflow example...\n");

    const runObj = supportWorkflow.createRun();

    const result = await runObj.run({
        triggerData: {
            id: 'TICKET-1234',
            subject: 'Can\'t connect to the API',
            description: 'I\'ve been trying to connect to the API for hours and it\'s very frustrating. The documentation isn\'t clear about authentication.',
            priority: 'medium',
            category: 'technical',
            customer: {
                name: 'Alex Johnson',
                email: 'alex@example.com',
                tier: 'premium'
            }
        }
    });

    console.log("\nWorkflow execution complete.\n");

    // Print ticket details
    console.log("TICKET DETAILS:");
    console.log("--------------");
    console.log(`ID: ${result.results.trigger.id}`);
    console.log(`Subject: ${result.results.trigger.subject}`);
    console.log(`Customer: ${result.results.trigger.customer.name} (${result.results.trigger.customer.tier} tier)`);
    console.log(`Original Priority: ${result.results.trigger.priority}`);

    if (result.results['prioritize-ticket']) {
        console.log(`Adjusted Priority: ${result.results['prioritize-ticket'].priority}`);
    }

    if (result.results['analyze-sentiment']?.sentimentAnalysis) {
        const sentiment = result.results['analyze-sentiment'].sentimentAnalysis;
        console.log(`Sentiment: ${sentiment.sentiment} (score: ${sentiment.score}, confidence: ${sentiment.confidence.toFixed(2)})`);
    }

    // Print the response from whichever response step was executed
    const responseSteps = ['technical-response', 'billing-response', 'general-response', 'feature-response'];

    for (const step of responseSteps) {
        if (result.results[step] && result.results[step].response) {
            console.log(`\nRESPONSE (${result.results[step].response.type}):`);
            console.log("-".repeat(16 + result.results[step].response.type.length));
            console.log(result.results[step].response.content);
            break;
        }
    }

    // Optional: Print full workflow results for debugging
    console.log("\nFULL RESULTS:");
    console.log("-------------");
    console.log(JSON.stringify(result.results, null, 2));
}

// Run the example
if (require.main === module) {
    runExample().catch(err => {
        console.error("Error running example:", err);
        process.exit(1);
    });
}