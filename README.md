# Astor
"Prompts that flow in a graceful dance"

<p align="center">
  <img width="768" alt="Screenshot 2025-03-06 at 07 40 27" src="https://github.com/user-attachments/assets/79df47f3-5ea0-4b8a-a9af-960b92539e83" />
</p>

Astor is a flexible TypeScript library for building AI workflows with a simple, intuitive API. It combines the power of workflow orchestration with the latest AI capabilities from the AI SDK.

## Features

- **Workflow System**: Build complex, multi-step workflows with dependencies, branching, and conditional execution
- **Intuitive API**: Natural API design with method names like `Workflow()`, `Step()`, and `Tool()`
- **AI-Native**: Seamless integration with the AI SDK for text generation, structured data, and ~~streaming responses~~
- **Type-Safe**: Full TypeScript support with generics for schema validation
- **Extensible**: Build your own custom steps, tools, and workflows
- **Easy to Use**: Simple, declarative syntax for defining complex AI pipelines

## Installation

```bash
bun add astor 
# or
npm install astor
```

## Quick Start

```typescript
import Astor from 'astor';
import { z } from 'zod';

// Initialize Astor
const astor = new Astor({
  openAIKey: Bun.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4o'
});

// Create a simple AI workflow
const workflow = astor.SimpleWorkflow({
  name: 'Quick Responder',
  model: astor.openai('gpt-4o'),
  systemPrompt: 'You are a helpful assistant.'
});

// Run the workflow
async function main() {
  const run = workflow.createRun();
  const result = await run.run({
    triggerData: {
      message: 'What are three interesting facts about quantum computing?'
    }
  });
  
  console.log(result.results['generate-response'].response);
}

main().catch(console.error);
```

## Creating Custom Workflows

```typescript
import Astor from 'astor';
import { z } from 'zod';

const astor = new Astor({
  openAIKey: Bun.env.OPENAI_API_KEY
});

// Define a schema for structured data
const recipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string(),
    unit: z.string().optional()
  })),
  steps: z.array(z.string()),
  prepTime: z.number(),
  cookTime: z.number()
});

// Create a custom workflow
const recipeWorkflow = astor.Workflow({
  name: 'Recipe Generator',
  triggerSchema: z.object({
    cuisine: z.string(),
    dietary: z.string().optional(),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'dessert'])
  })
})
// First step: generate recipe ideas
.step(astor.TextStep({
  id: 'generate-ideas',
  description: 'Generate recipe ideas',
  model: astor.openai('gpt-4o'),
  systemPrompt: 'You are a chef specialized in various cuisines.'
}), {
  variables: {
    message: { step: 'trigger', path: 'cuisine' }
  }
})
// Second step: create structured recipe data
.then(astor.ObjectStep({
  id: 'generate-recipe',
  description: 'Generate a structured recipe',
  model: astor.openai('gpt-4o'),
  schema: recipeSchema,
  systemPrompt: 'You are a recipe writer creating detailed recipes.'
}), {
  variables: {
    message: { step: 'generate-ideas', path: 'response' }
  }
})
.commit();

// Run the workflow
async function main() {
  const run = recipeWorkflow.createRun();
  const result = await run.run({
    triggerData: {
      cuisine: 'Italian',
      dietary: 'vegetarian',
      mealType: 'dinner'
    }
  });
  
  const recipe = result.results['generate-recipe'].response;
  console.log(`Recipe: ${recipe.name}`);
  console.log(`Prep Time: ${recipe.prepTime} minutes`);
  console.log(`Cook Time: ${recipe.cookTime} minutes`);
  
  console.log('Ingredients:');
  recipe.ingredients.forEach(ing => {
    console.log(`- ${ing.amount} ${ing.unit || ''} ${ing.name}`);
  });
  
  console.log('Steps:');
  recipe.steps.forEach((step, i) => {
    console.log(`${i+1}. ${step}`);
  });
}

main().catch(console.error);
```

## Creating and Using Tools

```typescript
import Astor from 'astor';
import { z } from 'zod';

const astor = new Astor({
  openAIKey: Bun.env.OPENAI_API_KEY
});

// Create an AI-powered tool
const nutritionTool = astor.AITool({
  name: 'analyze-nutrition',
  description: 'Analyze the nutritional content of ingredients',
  parameters: z.object({
    ingredients: z.array(z.string()),
    servings: z.number().default(1)
  }),
  model: astor.openai('gpt-4o-mini'),
  systemPrompt: 'You are a nutritionist specializing in food analysis.'
});

// Use the tool
async function main() {
  const result = await nutritionTool.execute({
    ingredients: [
      '200g pasta',
      '150g spinach',
      '100g feta cheese',
      '2 tbsp olive oil'
    ],
    servings: 2
  });
  
  console.log(result.result);
}

main().catch(console.error);
```

## Advanced Features

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

### Conditional Execution

```typescript
const workflow = astor.Workflow({
  name: 'Conditional Workflow'
})
.step(analyzeStep)
// Only run this step if condition is met
.step(specialStep, {
  when: {
    ref: { step: 'analyze', path: 'sentiment' },
    query: { $eq: 'positive' }
  }
})
.commit();
```

### Custom Steps

```typescript
const customStep = astor.Step({
  id: 'custom-processor',
  description: 'Custom data processing step',
  execute: async ({ input, context }) => {
    // Custom processing logic here
    return {
      processed: true,
      data: input.data.map(item => item.toUpperCase())
    };
  }
});
```

## Why Astor?

- **Simplified AI Development**: Build complex AI workflows without the boilerplate
- **Composable**: Chain together steps and tools to create sophisticated pipelines
- **Maintainable**: Logical separation of concerns keeps your code clean
- **Testable**: Each step can be tested independently
- **Reproducible**: Workflows execute consistently with deterministic results
- **Future-Proof**: Uses the AI SDK for model interactions, keeping up with the latest AI capabilities

## License

MIT