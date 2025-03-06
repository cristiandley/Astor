import { z } from 'zod';

export type Context = {
    getStepResult: (stepId: string) => any;
    setStepResult: (stepId: string, result: any) => void;
};

export type StepConfig = {
    id: string;
    description: string;
    inputSchema?: z.ZodType;
    execute: (params: { input?: any; context?: Context }) => Promise<any>;
};

export type Step = {
    config: StepConfig;
    execute: (params: { input?: any; context?: Context }) => Promise<any>;
};

export function createStep(config: StepConfig): Step {
    return {
        config,
        execute: config.execute,
    };
}