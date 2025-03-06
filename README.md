# Astor
"Set those Agents to dance"



A lightweight, flexible TypeScript framework for building AI agent workflows with LLMs.

## Overview

Astor provides a clean, composable API for creating AI agent workflows. It allows you to:

- Create agents using various LLM providers
- Build multi-step workflows with complex branching logic
- Define custom tools and toolkits for agent use
- Chain multiple agents together for complex tasks
- Handle validation, error management, and logging consistently

## Installation

```bash
npm install astor-agent-framework
# or
yarn add astor-agent-framework
```

## Quick Start

```typescript
import { createAgent, createStep, createWorkflow, openai } from 'astor-agent-framework';

// Create an agent
const assistant = createAgent({
  name: 'Simple Assistant',
  instructions: 'You are a helpful AI assistant.',
  model: openai('gpt-4o-mini')
});

// Create a step
const responseStep = createStep({
  id: 'generate-response',
  description: 'Generate a response to the user query',
  execute: async ({ input }) => {
    const response = await assistant.stream([
      { role: 'user', content: input.message }
    ]);
    
    let fullResponse = '';
    for await (const chunk of response.textStream) {
      fullResponse += chunk;
    }
    
    return { response: fullResponse };
  }
});

// Create a workflow
const simpleWorkflow = createWorkflow({
  name: 'Simple Conversation'
})
  .step(responseStep)
  .commit();

// Use the workflow
const run = simpleWorkflow.createRun();
const result = await run.run({
  triggerData: { message: 'Tell me a joke' }
});

console.log(result.results['generate-response'].response);
```

## Core Concepts

### Agents

Agents are the fundamental building blocks of Astro. They encapsulate LLM calls with specific instructions and model configurations.

```typescript
const agent = createAgent({
  name: 'Technical Support',
  instructions: 'You are a technical support specialist...',
  model: openai('gpt-4o')
});
```

### Steps

Steps are the individual units of execution in a workflow. Each step performs a specific task and can take input from previous steps.

```typescript
const analyzeStep = createStep({
  id: 'analyze-data',
  description: 'Analyze user data',
  inputSchema: mySchema, // Optional schema validation
  execute: async ({ input, context }) => {
    // Implementation
    return result;
  }
});
```

### Workflows

Workflows combine steps into a coherent process with defined execution flow, including conditional branching and dependencies.

```typescript
const workflow = createWorkflow({ name: 'Data Analysis' })
  .step(validateStep)
  .then(analyzeStep)
  .then(generateResultStep, {
    when: {
      ref: { step: 'analyze-step', path: 'status' },
      query: { $eq: 'success' }
    }
  })
  .commit();
```

### Tools

Tools are specialized functions that can be used by agents or steps to perform specific tasks.

```typescript
const dataTool = createTool({
  name: 'analyzeData',
  description: 'Analyzes structured data',
  parameters: dataSchema,
  execute: async ({ data }) => {
    // Implementation
    return analysis;
  }
});
```

## Advanced Features

### Dependency Management with `.after()`

Specify custom execution order and dependencies between steps:

```typescript
workflow
  .step(validateUserStep)
  .step(loadUserDataStep)
  .step(processPaymentStep)
  // This step will only run after both validateUserStep and loadUserDataStep are complete
  .after(['validateUserStep', 'loadUserDataStep']).step(sendReceiptStep)
  // You can also depend on a single step
  .after('processPaymentStep').step(updateAccountStep)
```

Here's a complete example of a data processing workflow with custom dependencies:

```typescript
import { createStep, createWorkflow } from 'astor-agent-framework';

// Define steps
const fetchDataStep = createStep({
  id: 'fetch-data',
  description: 'Fetch raw data from API',
  execute: async () => {
    const data = await fetchFromApi('/api/data');
    return { rawData: data };
  }
});

const validateDataStep = createStep({
  id: 'validate-data',
  description: 'Validate data format and structure',
  execute: async ({ input }) => {
    const isValid = validateSchema(input.rawData);
    return { isValid, validatedData: isValid ? input.rawData : null };
  }
});

const transformDataStep = createStep({
  id: 'transform-data',
  description: 'Transform data into required format',
  execute: async ({ input }) => {
    const transformed = transformData(input.rawData);
    return { transformedData: transformed };
  }
});

const saveToDbStep = createStep({
  id: 'save-to-db',
  description: 'Save processed data to database',
  execute: async ({ input }) => {
    await saveToDatabase(input.transformedData);
    return { status: 'success', timestamp: new Date().toISOString() };
  }
});

const notifyUserStep = createStep({
  id: 'notify-user',
  description: 'Send notification to user',
  execute: async ({ input, context }) => {
    const dbStatus = context.getStepResult('save-to-db');
    await sendNotification({
      message: `Data processing complete: ${dbStatus.status}`,
      timestamp: dbStatus.timestamp
    });
    return { notified: true };
  }
});

// Create workflow with custom dependencies
const dataWorkflow = createWorkflow({
  name: 'Data Processing Workflow'
})
  // Start with data fetching
  .step(fetchDataStep)
  
  // Both of these steps depend on fetch-data but run in parallel
  .after('fetch-data').step(validateDataStep)
  .after('fetch-data').step(transformDataStep)
  
  // This step runs only after both validation and transformation are complete
  .after(['validate-data', 'transform-data']).step(saveToDbStep)
  
  // Final notification step
  .after('save-to-db').step(notifyUserStep)
  
  .commit();

// Usage
const run = dataWorkflow.createRun();
await run.run({ triggerData: { userId: '123' } });
```

This example shows how to build a workflow where:
- Validation and transformation can happen in parallel (both after data fetch)
- Saving to database only happens when both validation and transformation are complete
- Notification is sent only after the database save is successful

### Conditional Branching

Create complex workflows with conditional execution paths:

```typescript
workflow
  .step(routeTicketStep)
  .step(technicalResponseStep, {
    when: {
      ref: { step: 'route-ticket', path: 'category' },
      query: { $eq: 'technical' }
    }
  })
  .step(billingResponseStep, {
    when: {
      ref: { step: 'route-ticket', path: 'category' },
      query: { $eq: 'billing' }
    }
  });
```

### Variable Mapping

Control how data flows between steps:

```typescript
.step(validateStep, {
  variables: {
    userId: { step: 'trigger', path: 'userId' },
    query: { step: 'trigger', path: 'searchQuery' }
  }
})
```

### Multiple Model Providers

Astro is designed to work with multiple LLM providers (currently OpenAI, with more coming soon):

```typescript
// Using OpenAI
const openaiAgent = createAgent({
  name: 'OpenAI Agent',
  instructions: '...',
  model: openai('gpt-4o', {
    temperature: 0.7,
    maxTokens: 500
  })
});

// Other providers to be added
```

## Example Use Cases

- **Customer Support**: Route and respond to support tickets based on category and sentiment
- **Content Generation**: Create structured content with multiple specialized agents
- **Data Analysis**: Process and analyze data with custom tools and generate insights
- **Multi-turn Conversations**: Manage complex conversation flows with state tracking

## Examples

Check out complete examples in the `/examples` directory:

- `simple.example.ts`: A basic conversation workflow
- `branching.example.ts`: A support ticket system with conditional routing
- `dependency.example.ts`: A data analysis workflow demonstrating advanced dependency management with `.after()`

## API Reference

For full API documentation, please see [our API reference](https://github.com/cristiandley/astor/docs/api.md).

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.