# Astor
"Prompts that flow in a graceful dance"

<img width="469" alt="Screenshot 2025-03-06 at 05 56 05" src="https://github.com/user-attachments/assets/5179ef49-efe8-44a6-bd97-87eb00337577" />

A lightweight, flexible library for building AI agent workflows with LLMs.

## Overview

Astor provides a clean, composable API for creating AI agent workflows. It allows you to:

- Build multi-step workflows with complex branching logic.
- Define custom tools and toolkits for agent use.
- Chain multiple agents together for complex tasks.
- Handle validation, error management, and logging consistently.
- - ~~Create agents using various LLM providers~~ is a desire, rn only openai.

## Installation

```bash
bun add astor-agentic
# or
npm install astor-agentic
```

## Table of Contents
- [Core Components](#core-components)
    - [Agents](#agents)
    - [Steps](#steps)
    - [Workflows](#workflows)
    - [Tools](#tools)
    - [Chains](#chains)
- [Shared Utilities](#shared-utilities)
    - [Logger](#logger)
    - [Configuration](#configuration)
- [Types](#types)

## Core Components

### Agents

Agents encapsulate LLM calls with specific instructions and model configurations.

#### `createAgent(config: AgentConfig): Agent`

Creates a new agent that can process messages using an LLM.

```typescript
import { createAgent, openai } from 'astor-agentic';

const agent = createAgent({
  name: 'My Assistant',
  instructions: 'You are a helpful AI assistant...',
  model: openai('gpt-4o')
});
```

**Parameters:**
- `config`: The agent configuration object
    - `name`: A descriptive name for the agent
    - `instructions`: System prompt instructions for the agent
    - `model`: The model provider (e.g., from `openai()`)

**Returns:**
- An `Agent` object with:
    - `config`: The original configuration
    - `stream(messages: Message[])`: Method to stream responses from the LLM

#### `openai(modelName?: string, options?: OpenAIConfig): ModelProvider`

Creates an OpenAI model provider for use with an agent.

```typescript
import { openai } from 'astor-agentic';

const model = openai('gpt-4o', {
  temperature: 0.7,
  maxTokens: 500
});
```

**Parameters:**
- `modelName`: OpenAI model name (defaults to config.defaultModel)
- `options`: Configuration options
    - `apiKey`: OpenAI API key (defaults to environment variable)
    - `baseUrl`: API base URL (defaults to 'https://api.openai.com/v1')
    - `organization`: OpenAI organization ID
    - `temperature`: Sampling temperature (0-1)
    - `maxTokens`: Maximum tokens to generate

**Returns:**
- A `ModelProvider` object that can be used with `createAgent()`

### Steps

Steps are individual units of execution in a workflow.

#### `createStep(config: StepConfig): Step`

Creates a new step that can be added to a workflow.

```typescript
import { createStep } from 'astor-agentic';
import { z } from 'zod';

const myStep = createStep({
  id: 'process-data',
  description: 'Process input data',
  inputSchema: z.object({
    data: z.array(z.string())
  }),
  execute: async ({ input, context }) => {
    // Process the data
    return { processed: true, result: input.data.map(item => item.toUpperCase()) };
  }
});
```

**Parameters:**
- `config`: The step configuration object
    - `id`: Unique identifier for the step
    - `description`: Description of what the step does
    - `inputSchema` (optional): Zod schema for input validation
    - `execute`: Async function that performs the step's operation

**Returns:**
- A `Step` object with:
    - `config`: The original configuration
    - `execute({ input, context })`: Method to execute the step

### Workflows

Workflows combine steps into a coherent process with defined execution flow.

#### `createWorkflow(config: WorkflowConfig): Workflow`

Creates a new workflow that can execute a series of steps.

```typescript
import { createWorkflow } from 'astor-agentic';
import { z } from 'zod';

const workflow = createWorkflow({
  name: 'Data Processing',
  triggerSchema: z.object({
    userId: z.string(),
    data: z.array(z.string())
  }),
  logger: myLogger
});
```

**Parameters:**
- `config`: The workflow configuration object
    - `name`: A descriptive name for the workflow
    - `triggerSchema` (optional): Zod schema for validating trigger data
    - `logger` (optional): Logger instance

**Returns:**
- A `Workflow` object with builder methods:
    - `step(stepDefinition, options?)`: Add a step to the workflow
    - `then(stepDefinition, options?)`: Add a step that runs after the previous step
    - `after(stepId | stepIds[])`: Specify dependencies for the next step
    - `createRun()`: Creates a runnable instance of the workflow
    - `commit()`: Finalizes the workflow definition

#### Workflow Builder Methods

##### `step(stepDefinition: Step, options?: StepOptions): Workflow`

Adds a step to the workflow.

**Parameters:**
- `stepDefinition`: The step to add
- `options` (optional):
    - `when`: Conditional execution rule
    - `variables`: Variable mappings

**Returns:**
- The workflow instance (for chaining)

##### `then(stepDefinition: Step, options?: StepOptions): Workflow`

Adds a step that runs after the previous step.

**Parameters:**
- `stepDefinition`: The step to add
- `options` (optional): Same as `step()` options

**Returns:**
- The workflow instance (for chaining)

##### `after(stepId: string | string[]): Workflow`

Specifies dependencies for the next step to be added.

**Parameters:**
- `stepId`: ID of the step(s) that must complete before the next step

**Returns:**
- The workflow instance (for chaining)

##### `commit(): Workflow`

Finalizes the workflow definition and checks for validity.

**Returns:**
- The validated workflow instance

#### Workflow Execution

##### `createRun()`

Creates a runnable instance of the workflow.

**Returns:**
- An object with a `run()` method:
    - `run({ triggerData: any }): Promise<{ results: Record<string, any> }>`

### Tools

Tools are specialized functions that can be used by agents or steps.

#### `createTool(definition: ToolDefinition): Tool`

Creates a new tool that can be added to a toolkit.

```typescript
import { createTool } from 'astor-agentic';
import { z } from 'zod';

const weatherTool = createTool({
  name: 'getWeather',
  description: 'Get weather information for a location',
  parameters: z.object({
    location: z.string(),
    units: z.enum(['metric', 'imperial']).default('metric')
  }),
  execute: async ({ location, units }) => {
    // Fetch weather data
    return { temperature: 22, conditions: 'sunny' };
  }
});
```

**Parameters:**
- `definition`: The tool definition object
    - `name`: Unique identifier for the tool
    - `description`: Description of what the tool does
    - `parameters`: Zod schema for parameters
    - `execute`: Async function that performs the tool's operation

**Returns:**
- A `Tool` object with:
    - `definition`: The original definition
    - `execute(params)`: Method to execute the tool

#### `createToolkit(config: ToolkitConfig): Toolkit`

Creates a new toolkit to group related tools.

```typescript
import { createToolkit } from 'astor-agentic';

const weatherToolkit = createToolkit({
  name: 'Weather Tools',
  description: 'Tools for weather data',
  logger: myLogger
});

weatherToolkit.addTool(weatherTool);
```

**Parameters:**
- `config`: The toolkit configuration object
    - `name`: A descriptive name for the toolkit
    - `description` (optional): Description of the toolkit
    - `logger` (optional): Logger instance

**Returns:**
- A `Toolkit` object with:
    - `config`: The original configuration
    - `tools`: Record of contained tools
    - `addTool(tool)`: Method to add a tool
    - `getTool(name)`: Method to retrieve a tool
    - `getToolsSchema()`: Method to get schema for all tools

### Chains

Chains are collections of agents and workflows.

#### `createChain(config: ChainConfig): Chain`

Creates a new chain that can manage multiple agents and workflows.

```typescript
import { createChain } from 'astor-agentic';

const chain = createChain({
  agents: { 
    assistant: myAgent 
  },
  workflows: { 
    dataProcessing: myWorkflow 
  },
  logger: myLogger
});
```

**Parameters:**
- `config`: The chain configuration object
    - `agents` (optional): Record of agents
    - `workflows` (optional): Record of workflows
    - `logger` (optional): Logger instance

**Returns:**
- A `Chain` object with:
    - `config`: The original configuration
    - `agents`: Record of agents
    - `workflows`: Record of workflows
    - `getWorkflow(name)`: Method to get a workflow
    - `getAgent(name)`: Method to get an agent
    - `registerAgent(name, agent)`: Method to add an agent
    - `registerWorkflow(name, workflow)`: Method to add a workflow

## Shared Utilities

### Logger

#### `createLogger(config?: LoggerConfig): Logger`

Creates a new logger instance.

```typescript
import { createLogger } from 'astor-agentic';

const logger = createLogger({
  level: 'debug',
  colors: true,
  timestamp: true
});
```

**Parameters:**
- `config` (optional): The logger configuration object
    - `level`: Log level ('debug', 'info', 'warn', 'error')
    - `colors`: Enable colored output
    - `compact`: Use compact output format
    - `timestamp`: Include timestamps

**Returns:**
- A `Logger` object with methods:
    - `debug(message, ...args)`
    - `info(message, ...args)`
    - `warn(message, ...args)`
    - `error(message, ...args)`
    - `success(message, ...args)`
    - `fatal(message, ...args)`
    - `trace(message, ...args)`

### Configuration

#### `config`

Global configuration object loaded from environment variables.

```typescript
import { config } from 'astor-agentic';

console.log(config.defaultModel);
```

**Properties:**
- `serverPort`: HTTP server port (default: 3000)
- `openAiKey`: OpenAI API key
- `environment`: Runtime environment ('development', 'production', 'test')
- `logLevel`: Default log level ('debug', 'info', 'warn', 'error')
- `defaultModel`: Default LLM model
- `batchConcurrency`: Maximum concurrent operations (1-10)

## Types

### Agent Types

```typescript
type Message = {
  role: string;
  content: string;
};

type StreamResponse = {
  textStream: AsyncIterable<string>;
};

type ModelProvider = {
  stream: (messages: Message[]) => Promise<StreamResponse>;
};

type AgentConfig = {
  name: string;
  instructions: string;
  model: ModelProvider;
};

type Agent = {
  config: AgentConfig;
  stream: (messages: Message[]) => Promise<StreamResponse>;
};

type OpenAIConfig = {
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  temperature?: number;
  maxTokens?: number;
};
```

### Step Types

```typescript
type Context = {
  getStepResult: (stepId: string) => any;
  setStepResult: (stepId: string, result: any) => void;
};

type StepConfig = {
  id: string;
  description: string;
  inputSchema?: z.ZodType;
  execute: (params: { input?: any; context?: Context }) => Promise<any>;
};

type Step = {
  config: StepConfig;
  execute: (params: { input?: any; context?: Context }) => Promise<any>;
};
```

### Workflow Types

```typescript
type StepReference = {
  step: string;
  path?: string;
};

type ConditionalQuery = {
  $eq?: any;
  $neq?: any;
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
  $in?: any[];
  $nin?: any[];
  $exists?: boolean;
  $and?: ConditionalQuery[];
  $or?: ConditionalQuery[];
};

type StepCondition = {
  ref: StepReference;
  query: ConditionalQuery;
};

type VariableMapping = {
  [key: string]: StepReference | any;
};

type StepOptions = {
  when?: StepCondition;
  variables?: VariableMapping;
};

type WorkflowConfig = {
  name: string;
  triggerSchema?: z.ZodType;
  logger?: Logger;
};

type Workflow = {
  config: WorkflowConfig;
  steps: Step[];
  dependencies: Record<string, string[]>;
  conditions: Record<string, StepCondition>;
  variables: Record<string, VariableMapping>;
  currentDependency: string | null;
  
  step: (stepDefinition: Step, options?: StepOptions) => Workflow;
  then: (stepDefinition: Step, options?: StepOptions) => Workflow;
  after: (stepId: string | string[]) => Workflow;
  createRun: () => { run: (params: { triggerData: any }) => Promise<{ results: Record<string, any> }> };
  commit: () => Workflow;
};
```

### Tool Types

```typescript
type ToolDefinition = {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute: (params: any) => Promise<any>;
};

type Tool = {
  definition: ToolDefinition;
  execute: (params: any) => Promise<any>;
};

type ToolkitConfig = {
  name: string;
  description?: string;
  logger?: Logger;
};

type Toolkit = {
  config: ToolkitConfig;
  tools: Record<string, Tool>;
  addTool: (tool: Tool) => Toolkit;
  getTool: (name: string) => Tool | undefined;
  getToolsSchema: () => Record<string, any>;
};
```

### Chain Types

```typescript
type ChainConfig = {
  agents?: Record<string, Agent>;
  workflows?: Record<string, Workflow>;
  logger?: Logger;
};

type Chain = {
  config: ChainConfig;
  agents: Record<string, Agent>;
  workflows: Record<string, Workflow>;
  getWorkflow: (name: string) => Workflow | undefined;
  getAgent: (name: string) => Agent | undefined;
  registerAgent: (name: string, agent: Agent) => void;
  registerWorkflow: (name: string, workflow: Workflow) => void;
};
```

### Logger Types

```typescript
type LogLevel = 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'success' | 'debug' | 'trace';

type LoggerConfig = {
  level?: LogLevel;
  colors?: boolean;
  compact?: boolean;
  timestamp?: boolean;
};

interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
  fatal(message: string, ...args: any[]): void;
  trace(message: string, ...args: any[]): void;
}
```
