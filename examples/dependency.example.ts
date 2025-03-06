import { z } from 'zod';
import {
    createAgent,
    createStep,
    createWorkflow,
    openai,
    createLogger
} from '../src';

// Create a dedicated logger for this example
const logger = createLogger({ level: 'info' });

// Define schema for the data processing input
const processingSchema = z.object({
    dataId: z.string(),
    userId: z.string(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    options: z.object({
        format: z.enum(['json', 'csv', 'xml']).default('json'),
        notify: z.boolean().default(false)
    }).optional()
});

// Create an agent for data analysis
const dataAnalysisAgent = createAgent({
    name: 'Data Analyst',
    instructions: `
    You are a data analysis specialist.
    Analyze the provided data and provide concise, insightful summaries.
    Focus on key patterns, anomalies, and actionable insights.
    `,
    model: openai('gpt-4o-mini')
});

// Create workflow steps
const validateInputStep = createStep({
    id: 'validate-input',
    description: 'Validate input parameters',
    inputSchema: processingSchema,
    execute: async ({ input }) => {
        logger.info(`Processing request for data ID: ${input.dataId}, user: ${input.userId}`);
        return {
            ...input,
            timestamp: new Date().toISOString(),
            validated: true
        };
    }
});

const fetchDataStep = createStep({
    id: 'fetch-data',
    description: 'Fetch data from the source system',
    execute: async ({ input }) => {
        logger.info(`Fetching data for ID: ${input.dataId}`);

        // Simulate API call to fetch data
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock data for this example
        const mockData = {
            id: input.dataId,
            metrics: {
                viewCount: 1250,
                conversionRate: 0.034,
                engagementScore: 7.2
            },
            segments: [
                { name: 'desktop', percentage: 68 },
                { name: 'mobile', percentage: 29 },
                { name: 'tablet', percentage: 3 }
            ],
            timeframe: {
                start: '2023-01-01',
                end: '2023-01-31'
            }
        };

        logger.info(`Successfully fetched data for ID: ${input.dataId}`);

        return {
            ...input,
            data: mockData,
            dataStatus: 'success'
        };
    }
});

const fetchUserPreferencesStep = createStep({
    id: 'fetch-user-preferences',
    description: 'Fetch user preferences for data presentation',
    execute: async ({ input }) => {
        logger.info(`Fetching preferences for user: ${input.userId}`);

        // Simulate API call to fetch user preferences
        await new Promise(resolve => setTimeout(resolve, 300));

        // Mock user preferences for this example
        const userPreferences = {
            userId: input.userId,
            displayPreferences: {
                theme: 'dark',
                detailLevel: 'detailed',
                visualizations: ['bar', 'line', 'table']
            },
            notifications: {
                email: true,
                inApp: true
            }
        };

        logger.info(`Successfully fetched preferences for user: ${input.userId}`);

        return {
            ...input,
            userPreferences,
            preferencesStatus: 'success'
        };
    }
});

const processDataStep = createStep({
    id: 'process-data',
    description: 'Process and transform the data',
    execute: async ({ input, context }) => {
        logger.info(`Processing data...`);

        // Ensure we have the data from the fetch-data step
        const fetchResult = context?.getStepResult('fetch-data');
        if (!fetchResult || fetchResult.dataStatus !== 'success') {
            throw new Error('Required data not available');
        }

        // Apply transformations based on the requested format
        const format = input.options?.format || 'json';

        // Simulate data processing
        await new Promise(resolve => setTimeout(resolve, 600));

        const processedData = {
            original: fetchResult.data,
            derived: {
                averageEngagement: fetchResult.data.metrics.engagementScore,
                dominantSegment: fetchResult.data.segments.sort((a: { percentage: number; }, b: { percentage: number; }) => b.percentage - a.percentage)[0],
                period: `${fetchResult.data.timeframe.start} to ${fetchResult.data.timeframe.end}`
            },
            format
        };

        logger.info(`Data processed successfully in ${format} format`);

        return {
            ...input,
            processedData,
            processingStatus: 'success'
        };
    }
});

const prepareVisualizationStep = createStep({
    id: 'prepare-visualization',
    description: 'Prepare data visualization based on user preferences',
    execute: async ({ input, context }) => {
        logger.info(`Preparing visualizations...`);

        // Get user preferences
        const userResult = context?.getStepResult('fetch-user-preferences');
        if (!userResult || !userResult.userPreferences) {
            throw new Error('User preferences not available');
        }

        // Get processed data
        const processResult = context?.getStepResult('process-data');
        if (!processResult || processResult.processingStatus !== 'success') {
            throw new Error('Processed data not available');
        }

        // Prepare visualization options based on user preferences
        const visualizations = userResult.userPreferences.displayPreferences.visualizations;
        const theme = userResult.userPreferences.displayPreferences.theme;

        // Simulate visualization preparation
        await new Promise(resolve => setTimeout(resolve, 400));

        const visualizationConfig = {
            charts: visualizations.map((type: any) => ({
                type,
                data: processResult.processedData.original.segments,
                theme
            })),
            dashboardLayout: {
                columns: 2,
                rows: Math.ceil(visualizations.length / 2)
            }
        };

        logger.info(`Visualizations prepared with ${visualizations.length} charts`);

        return {
            ...input,
            visualizationConfig,
            visualizationStatus: 'success'
        };
    }
});

const generateAnalysisStep = createStep({
    id: 'generate-analysis',
    description: 'Generate human-readable analysis using LLM',
    execute: async ({ input, context }) => {
        logger.info(`Generating analysis...`);

        // Get processed data
        const processResult = context?.getStepResult('process-data');
        if (!processResult || processResult.processingStatus !== 'success') {
            throw new Error('Processed data not available');
        }

        const data = processResult.processedData.original;

        // Prepare the prompt for the LLM
        const prompt = `
            Please analyze the following data and provide key insights:
            
            Data ID: ${data.id}
            Timeframe: ${data.timeframe.start} to ${data.timeframe.end}
            
            Metrics:
            - View Count: ${data.metrics.viewCount}
            - Conversion Rate: ${data.metrics.conversionRate}
            - Engagement Score: ${data.metrics.engagementScore}
            
            Segments:
            ${data.segments.map((segment: { name: any; percentage: any; }) => `- ${segment.name}: ${segment.percentage}%`).join('\n')}
            
            Please provide:
            1. A summary of the most important insights
            2. Any notable patterns or anomalies
            3. 2-3 actionable recommendations based on this data
        `;

        // Generate analysis using LLM
        const response = await dataAnalysisAgent.stream([
            { role: 'user', content: prompt }
        ]);

        // Collect the response
        let analysis = '';
        for await (const chunk of response.textStream) {
            analysis += chunk;
        }

        logger.info(`Analysis generated successfully`);

        return {
            ...input,
            analysis,
            analysisStatus: 'success'
        };
    }
});

const notifyUserStep = createStep({
    id: 'notify-user',
    description: 'Send notification to the user if requested',
    execute: async ({ input, context }) => {
        // Check if notification is requested
        if (!input.options?.notify) {
            logger.info(`Notification not requested, skipping`);
            return {
                ...input,
                notificationStatus: 'skipped'
            };
        }

        // Get user preferences
        const userResult = context?.getStepResult('fetch-user-preferences');
        if (!userResult || !userResult.userPreferences) {
            throw new Error('User preferences not available');
        }

        // Check notification channels
        const channels = [];
        if (userResult.userPreferences.notifications.email) {
            channels.push('email');
        }
        if (userResult.userPreferences.notifications.inApp) {
            channels.push('inApp');
        }

        // Simulate notification sending
        logger.info(`Sending notification to user ${input.userId} via ${channels.join(', ')}`);

        await new Promise(resolve => setTimeout(resolve, 200));

        return {
            ...input,
            notificationStatus: 'success',
            notificationChannels: channels,
            notificationTime: new Date().toISOString()
        };
    }
});

// Create workflow with custom dependencies using .after()
const dataAnalysisWorkflow = createWorkflow({
    name: 'Data Analysis Workflow',
    triggerSchema: processingSchema,
    logger
})
    // Start with input validation
    .step(validateInputStep, {
        variables: {
            dataId: { step: 'trigger', path: 'dataId' },
            userId: { step: 'trigger', path: 'userId' },
            priority: { step: 'trigger', path: 'priority' },
            options: { step: 'trigger', path: 'options' }
        }
    })

    // Fetch data and user preferences in parallel (both after validation)
    .after('validate-input').step(fetchDataStep)
    .after('validate-input').step(fetchUserPreferencesStep)

    // Process data step depends only on having the raw data
    .after('fetch-data').step(processDataStep)

    // These final steps require both processed data and user preferences
    .after(['process-data', 'fetch-user-preferences']).step(prepareVisualizationStep)
    .after(['process-data', 'fetch-user-preferences']).step(generateAnalysisStep)

    // Notification is the final step that depends on having user preferences and completed analysis
    .after(['fetch-user-preferences', 'generate-analysis']).step(notifyUserStep)

    .commit();

// Export the workflow
export default dataAnalysisWorkflow;

// Example usage
async function runExample() {
    console.log("\n=== Running Data Analysis Workflow with Dependency Management ===\n");

    const runObj = dataAnalysisWorkflow.createRun();

    const result = await runObj.run({
        triggerData: {
            dataId: 'data-1234',
            userId: 'user-5678',
            priority: 'high',
            options: {
                format: 'json',
                notify: true
            }
        }
    });

    console.log("\n=== Workflow Execution Complete ===\n");

    // Print final analysis
    if (result.results['generate-analysis'] && result.results['generate-analysis'].analysis) {
        console.log("DATA ANALYSIS:");
        console.log("=============");
        console.log(result.results['generate-analysis'].analysis);
    }

    // Print notification status
    if (result.results['notify-user']) {
        console.log("\nNOTIFICATION STATUS:");
        console.log("===================");
        console.log(`Status: ${result.results['notify-user'].notificationStatus}`);

        if (result.results['notify-user'].notificationStatus === 'success') {
            console.log(`Channels: ${result.results['notify-user'].notificationChannels.join(', ')}`);
            console.log(`Time: ${result.results['notify-user'].notificationTime}`);
        }
    }

    // Print execution graph (simplified)
    console.log("\nEXECUTION FLOW:");
    console.log("==============");
    console.log("validate-input");
    console.log("├── fetch-data");
    console.log("│   └── process-data");
    console.log("│       ├── prepare-visualization (also depends on fetch-user-preferences)");
    console.log("│       └── generate-analysis (also depends on fetch-user-preferences)");
    console.log("└── fetch-user-preferences");
    console.log("    └── notify-user (also depends on generate-analysis)");
}

// Run the example
if (require.main === module) {
    runExample().catch(err => {
        console.error("Error running example:", err);
        process.exit(1);
    });
}