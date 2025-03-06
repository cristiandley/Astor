import {z} from 'zod';
import type {Context, Step} from './step.core';
import type {Logger} from './shared/logger.shared';

export type StepReference = {
    step: string;
    path?: string;
};

export type ConditionalQuery = {
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

export type StepCondition = {
    ref: StepReference;
    query: ConditionalQuery;
};

export type VariableMapping = {
    [key: string]: StepReference | any;
};

export type StepOptions = {
    when?: StepCondition;
    variables?: VariableMapping;
};

export type WorkflowConfig = {
    name: string;
    triggerSchema?: z.ZodType;
    logger?: Logger;
};

export type Workflow = {
    config: WorkflowConfig;
    steps: Step[];
    dependencies: Record<string, string[]>;
    conditions: Record<string, StepCondition>;
    variables: Record<string, VariableMapping>;
    currentDependency: string | null;

    // Builder methods
    step: (stepDefinition: Step, options?: StepOptions) => Workflow;
    then: (stepDefinition: Step, options?: StepOptions) => Workflow;
    after: (stepId: string | string[]) => Workflow;

    // Execution methods
    createRun: () => { run: (params: { triggerData: any }) => Promise<{ results: Record<string, any> }> };
    commit: () => Workflow;
};

// Helper function to get value from an object using a dot path
function getValueByPath(obj: any, path?: string): any {
    if (!path) return obj;
    return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
}

// Helper function to evaluate a condition
function evaluateCondition(condition: ConditionalQuery, value: any): boolean {
    if (condition.$eq !== undefined) return value === condition.$eq;
    if (condition.$neq !== undefined) return value !== condition.$neq;
    if (condition.$gt !== undefined) return typeof value === 'number' && value > condition.$gt;
    if (condition.$gte !== undefined) return typeof value === 'number' && value >= condition.$gte;
    if (condition.$lt !== undefined) return typeof value === 'number' && value < condition.$lt;
    if (condition.$lte !== undefined) return typeof value === 'number' && value <= condition.$lte;
    if (condition.$in !== undefined) return Array.isArray(condition.$in) && condition.$in.includes(value);
    if (condition.$nin !== undefined) return Array.isArray(condition.$nin) && !condition.$nin.includes(value);
    if (condition.$exists !== undefined) return (value !== undefined && value !== null) === condition.$exists;

    if (condition.$and !== undefined) {
        return condition.$and.every(subCondition => evaluateCondition(subCondition, value));
    }

    if (condition.$or !== undefined) {
        return condition.$or.some(subCondition => evaluateCondition(subCondition, value));
    }

    return true; // No conditions
}

export function createWorkflow(config: WorkflowConfig): Workflow {
    const workflow: Workflow = {
        config,
        steps: [],
        dependencies: {},
        conditions: {},
        variables: {},
        currentDependency: null,

        step(stepDefinition: Step, options?: StepOptions) {
            workflow.steps.push(stepDefinition);

            // Initialize dependencies if they don't exist
            if (!workflow.dependencies[stepDefinition.config.id]) {
                workflow.dependencies[stepDefinition.config.id] = [];
            }

            // Add dependency if we're in an "after" chain
            if (workflow.currentDependency) {
                if (Array.isArray(workflow.currentDependency)) {
                    // Multiple dependencies
                    workflow.dependencies[stepDefinition.config.id] =
                        [...workflow.dependencies[stepDefinition.config.id], ...workflow.currentDependency];
                } else {
                    // Single dependency
                    workflow.dependencies[stepDefinition.config.id].push(workflow.currentDependency);
                }
                workflow.currentDependency = null;
            }

            // Store condition if provided
            if (options?.when) {
                workflow.conditions[stepDefinition.config.id] = options.when;
            }

            // Store variable mappings if provided
            if (options?.variables) {
                workflow.variables[stepDefinition.config.id] = options.variables;
            }

            return workflow;
        },

        then(stepDefinition: Step, options?: StepOptions) {
            if (workflow.steps.length === 0) {
                throw new Error('Cannot call "then" without a previous step');
            }

            const previousStepId = workflow.steps[workflow.steps.length - 1].config.id;
            workflow.steps.push(stepDefinition);

            // Initialize dependencies array if needed
            if (!workflow.dependencies[stepDefinition.config.id]) {
                workflow.dependencies[stepDefinition.config.id] = [];
            }

            // Add the previous step as a dependency
            workflow.dependencies[stepDefinition.config.id].push(previousStepId);

            // Store condition if provided
            if (options?.when) {
                workflow.conditions[stepDefinition.config.id] = options.when;
            }

            // Store variable mappings if provided
            if (options?.variables) {
                workflow.variables[stepDefinition.config.id] = options.variables;
            }

            return workflow;
        },

        after(stepId) {
            // @ts-ignore
            workflow.currentDependency = stepId;
            return workflow;
        },

        createRun() {
            const steps = [...workflow.steps];
            const dependencies = { ...workflow.dependencies };
            const conditions = { ...workflow.conditions };
            const variables = { ...workflow.variables };
            const logger = config.logger || console;
            const triggerSchema = config.triggerSchema;

            return {
                run: async (params: { triggerData: any }) => {
                    const { triggerData } = params;

                    // Validate trigger data if schema exists
                    if (triggerSchema) {
                        try {
                            triggerSchema.parse(triggerData);
                        } catch (error) {
                            if (error instanceof Error) {
                                logger.error(`Trigger data validation failed: ${error.message}`);
                                throw new Error(`Invalid trigger data: ${error.message}`);
                            } else {
                                logger.error('Unknown error');
                                // TODO: Improve & Handle non-Error objects
                            }
                        }
                    }

                    // Context for storing step results
                    const results: Record<string, any> = {
                        trigger: triggerData,
                    };

                    const context: Context = {
                        getStepResult: (stepId: string) => results[stepId],
                        setStepResult: (stepId: string, result: any) => {
                            results[stepId] = result;
                        },
                    };

                    // Execute steps in dependency order
                    const executedSteps = new Set<string>();
                    const pendingSteps = new Set(steps.map(step => step.config.id));
                    const skippedSteps = new Set<string>();

                    while (pendingSteps.size > 0) {
                        let progress = false;

                        for (const step of steps) {
                            if (!pendingSteps.has(step.config.id)) continue;

                            // Check if all dependencies are satisfied
                            const deps = dependencies[step.config.id] || [];
                            const depsReady = deps.every(depId =>
                                executedSteps.has(depId) || skippedSteps.has(depId)
                            );

                            if (depsReady) {
                                // Check if step has a condition
                                const condition = conditions[step.config.id];
                                let shouldRun = true;

                                if (condition) {
                                    const { ref, query } = condition;
                                    const refStepId = ref.step;

                                    // Special case for "trigger"
                                    const refValue = refStepId === "trigger"
                                        ? getValueByPath(triggerData, ref.path)
                                        : getValueByPath(results[refStepId], ref.path);

                                    shouldRun = evaluateCondition(query, refValue);

                                    if (!shouldRun) {
                                        logger.info(`Skipping step: ${step.config.id} (condition not met)`);
                                        skippedSteps.add(step.config.id);
                                        pendingSteps.delete(step.config.id);
                                        progress = true;
                                        continue;
                                    }
                                }

                                logger.info(`Executing step: ${step.config.id}`);

                                try {
                                    // Process variable mappings if they exist
                                    let input: any;
                                    const stepVariables = variables[step.config.id];

                                    if (stepVariables) {
                                        // Build input object from variable mappings
                                        input = {};

                                        for (const [key, mapping] of Object.entries(stepVariables)) {
                                            if (typeof mapping === 'object' && 'step' in mapping) {
                                                const mapStepId = mapping.step;
                                                const mapPath = mapping.path;

                                                if (mapStepId === "trigger") {
                                                    input[key] = getValueByPath(triggerData, mapPath);
                                                } else {
                                                    input[key] = getValueByPath(results[mapStepId], mapPath);
                                                }
                                            } else {
                                                // Direct value
                                                input[key] = mapping;
                                            }
                                        }
                                    } else if (deps.length > 0) {
                                        // Default to first dependency result as input if no variables defined
                                        input = results[deps[0]];
                                    }

                                    // Execute step
                                    // Store result
                                    results[step.config.id] = await step.execute({input, context});
                                    executedSteps.add(step.config.id);
                                    pendingSteps.delete(step.config.id);

                                    logger.info(`Completed step: ${step.config.id}`);
                                    progress = true;
                                } catch (error) {
                                    //TODO: nasty ... fix.
                                    // @ts-ignore
                                    logger.error(`Error in step ${step.config.id}: ${error.message}`);
                                    results[step.config.id] = {
                                        status: 'failed',
                                        // @ts-ignore
                                        error: error.message
                                    };
                                    executedSteps.add(step.config.id);
                                    pendingSteps.delete(step.config.id);
                                    progress = true;
                                }
                            }
                        }

                        if (!progress && pendingSteps.size > 0) {
                            const remainingSteps = Array.from(pendingSteps).join(', ');
                            throw new Error(`Deadlock detected in workflow execution. Remaining steps: ${remainingSteps}`);
                        }
                    }

                    return { results };
                }
            };
        },

        commit() {
            // Validate workflow configuration
            if (workflow.steps.length === 0) {
                throw new Error('Workflow must have at least one step');
            }

            // Check for circular dependencies
            const visited = new Set<string>();
            const recursionStack = new Set<string>();

            const checkCycle = (stepId: string): boolean => {
                if (recursionStack.has(stepId)) return true;
                if (visited.has(stepId)) return false;

                visited.add(stepId);
                recursionStack.add(stepId);

                const deps = workflow.dependencies[stepId] || [];
                for (const dep of deps) {
                    if (checkCycle(dep)) return true;
                }

                recursionStack.delete(stepId);
                return false;
            };

            for (const step of workflow.steps) {
                if (checkCycle(step.config.id)) {
                    throw new Error(`Circular dependency detected in workflow`);
                }
            }

            return workflow;
        }
    };

    return workflow;
}