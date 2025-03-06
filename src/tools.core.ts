import { z } from 'zod';
import type { Logger } from './shared/logger.shared';

export type ToolDefinition = {
    name: string;
    description: string;
    parameters: z.ZodType;
    execute: (params: any) => Promise<any>;
};

export type Tool = {
    definition: ToolDefinition;
    execute: (params: any) => Promise<any>;
};

export function createTool(definition: ToolDefinition): Tool {
    return {
        definition,
        execute: definition.execute
    };
}

export type ToolkitConfig = {
    name: string;
    description?: string;
    logger?: Logger;
};

export type Toolkit = {
    config: ToolkitConfig;
    tools: Record<string, Tool>;
    addTool: (tool: Tool) => Toolkit;
    getTool: (name: string) => Tool | undefined;
    getToolsSchema: () => Record<string, any>;
};

export function createToolkit(config: ToolkitConfig): Toolkit {
    const toolkit: Toolkit = {
        config,
        tools: {},

        addTool(tool: Tool) {
            this.tools[tool.definition.name] = tool;
            return this;
        },

        getTool(name: string) {
            return this.tools[name];
        },

        getToolsSchema() {
            const schema: Record<string, any> = {};

            for (const [name, tool] of Object.entries(this.tools)) {
                schema[name] = {
                    description: tool.definition.description,
                    // @ts-ignore
                    parameters: tool.definition.parameters.toJSON()
                };
            }

            return schema;
        }
    };

    return toolkit;
}