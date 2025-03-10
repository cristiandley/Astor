# Astor API Reference

This document provides detailed information about the Astor API, including classes, methods, and configuration options.

## Table of Contents

- [Initialization](#initialization)
- [Configuration](#configuration)
- [Workflows](#workflows)
    - [Step Creation](#step-creation)
    - [Workflow Creation](#workflow-creation)
    - [Workflow Execution](#workflow-execution)
- [AI Integration](#ai-integration)
    - [Text Generation](#text-generation)
    - [Object Generation](#object-generation)
    - [Streaming](#streaming)
- [Tools](#tools)
    - [Tool Creation](#tool-creation)
    - [AI Tools](#ai-tools)
    - [Toolkits](#toolkits)
- [Chains](#chains)
- [Advanced Features](#advanced-features)
    - [Conditional Execution](#conditional-execution)
    - [Variable Mapping](#variable-mapping)
    - [Parallel Execution](#parallel-execution)

## Initialization

### Creating an Astor Instance

```typescript
import Astor from 'astor';

const astor = new Astor({
  openAIKey: 'your-openai-api-key',
  defaultModel: 'gpt-4o',
  logLevel: 'info'
});
```

## Configuration

### AstorConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `openAIKey` | `string` | `undefined` | OpenAI API key |
| `defaultModel` | `string` | `'gpt-4o'` | Default model name for OpenAI |
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'` | Logging level |
| `environment` | `'development' \| 'production' \| 'test'` | `'development'` | Environment setting |
| `batchConcurrency` | `number` | `3` | Maximum concurrent operations (1-10) |

## Workflows

Workflows are sequences of steps that process data or generate content.

### Step Creation

#### Creating a Basic Step

```typescript
const myStep = astor.Step({
  id: 'process-data',
  description: 'Process the input data',
  execute: async ({ input, context }) => {
    // Processing logic
    return { processed: true, data: input };
  }
});
```

#### Step Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Unique identifier for the step |
| `description` | `string` | Description of what the step does |
| `inputSchema` | `z.ZodType` | (Optional) Zod schema for validating input |
| `execute` | `Function` | Async function that executes the step logic |

### Workflow Creation

#### Creating a Workflow

```typescript
const workflow = astor.Workflow({
  name: 'Data Processing',
  triggerSchema: z.object({
    data: z.string()
  })
})
.step(firstStep, {
  variables: {
    message: { step: 'trigger', path: 'data' }
  }
})
.then(secondStep)
.commit();
```

#### Workflow Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Name of the workflow |
| `triggerSchema` | `z.ZodType` | (Optional) Zod schema for validating trigger data |

### Workflow Execution

#### Running a Workflow

```typescript
const run = workflow.createRun();
const result = await run.run({
  triggerData: {
    data: 'input data'
  }
});

console.log(result.results);
```

## AI Integration

### Text Generation

#### Creating a Text Generation Step

```typescript
const textStep = astor.TextStep({
  id: 'generate-text',
  description: 'Generate text with AI',
  model: astor.openai('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  inputSchema: z.object({
    message: z.string()
  })
});
```

#### TextStep Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Unique identifier for the step |
| `description` | `string` | Description of what the step does |
| `model` | `any` | Model from AI SDK |
| `systemPrompt` | `string` | (Optional) System prompt for the AI |
| `inputSchema` | `z.ZodType` | (Optional) Zod schema for validating input |
| `onChunk` | `Function` | (Optional) Callback for streaming chunks |

### Object Generation

#### Creating an Object Generation Step

```typescript
const recipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string())
});

const objectStep = astor.ObjectStep({
  id: 'generate-recipe',
  description: 'Generate a recipe',
  model: astor.openai('gpt-4o'),
  schema: recipeSchema,
  systemPrompt: 'You are a chef.'
});
```

#### ObjectStep Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Unique identifier for the step |
| `description` | `string` | Description of what the step does |
| `model` | `any` | Model from AI SDK |
| `schema` | `z.ZodType` | Zod schema for the output structure |
| `systemPrompt` | `string` | (Optional) System prompt for the AI |
| `inputSchema` | `z.ZodType` | (Optional) Zod schema for validating input |

### Streaming

#### Creating a Streaming Text Step

```typescript
const streamStep = astor.StreamTextStep({
  id: 'stream-text',
  description: 'Stream text generation',
  model: astor.openai('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.',
  onChunk: (chunk) => {
    console.log('Received chunk:', chunk);
  }
});
```

## Tools

### Tool Creation

#### Creating a Basic Tool

```typescript
const calculator = astor.Tool({
  name: 'calculator',
  description: 'Performs calculations',
  parameters: z.object({
    expression: z.string()
  }),
  execute: async ({ expression }) => {
    return { result: eval(expression) };
  }
});
```

#### Tool Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Tool name |
| `description` | `string` | Tool description |
| `parameters` | `z.ZodType` | Zod schema for parameters |
| `execute` | `Function` | Async function that executes the tool logic |

### AI Tools

#### Creating an AI-Powered Tool

```typescript
const translator = astor.AITool({
  name: 'translate',
  description: 'Translates text to another language',
  parameters: z.object({
    text: z.string(),
    targetLanguage: z.string()
  }),
  model: astor.openai('gpt-4o'),
  systemPrompt: 'You are a professional translator.'
});
```

#### AITool Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Tool name |
| `description` | `string` | Tool description |
| `parameters` | `z.ZodType` | Zod schema for parameters |
| `model` | `any` | Model from AI SDK |
| `systemPrompt` | `string` | (Optional) System prompt for the AI |

### Toolkits

#### Creating a Toolkit

```typescript
const analyticTools = astor.Toolkit({
  name: 'Analytics Tools',
  description: 'Tools for data analysis'
})
.addTool(calculator)
.addTool(statisticsTool);
```

## Chains

Chains allow you to organize and manage multiple workflows.

```typescript
const chain = astor.Chain({
  name: 'Analysis Chain',
  workflows: {
    dataPrep: dataPreparationWorkflow,
    analysis: analysisWorkflow
  }
});

// Access a workflow from the chain
const workflow = chain.getWorkflow('dataPrep');
```

## Advanced Features

### Conditional Execution

```typescript
const workflow = astor.Workflow({
  name: 'Conditional Workflow'
})
.step(analyzeStep)
.step(specialStep, {
  when: {
    ref: { step: 'analyze', path: 'sentiment' },
    query: { $eq: 'positive' }
  }
})
.commit();
```

### Variable Mapping

```typescript
const workflow = astor.Workflow({
  name: 'Variable Mapping Example'
})
.step(firstStep)
.then(secondStep, {
  variables: {
    // Map from trigger data
    userId: { step: 'trigger', path: 'id' },
    // Map from previous step result
    processedData: { step: 'first-step', path: 'result.data' },
    // Direct value
    constant: 'some-value'
  }
})
.commit();
```

### Parallel Execution

```typescript
const workflow = astor.Workflow({
  name: 'Parallel Processing'
})
.step(initialStep)
// Run these steps in parallel after the initial step
.after('initial-step').step(stepA)
.after('initial-step').step(stepB)
// This step waits for both stepA and stepB to complete
.after(['step-a', 'step-b']).step(finalStep)
.commit();
```