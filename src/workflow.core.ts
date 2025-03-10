import type { Logger } from "@shared/logger.shared";
import type { z } from "zod";
import type { Context, Step } from "./step.core";

/**
 * Reference to a step and optional path within the step result
 */
export type StepReference = {
	step: string;
	path?: string;
};

/**
 * Query for conditional execution
 */
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

/**
 * Condition for step execution
 */
export type StepCondition = {
	ref: StepReference;
	query: ConditionalQuery;
};

/**
 * Variable mapping for step inputs
 */
export type VariableMapping = {
	[key: string]: StepReference | any;
};

/**
 * Options for step configuration
 */
export type StepOptions = {
	when?: StepCondition;
	variables?: VariableMapping;
};

/**
 * Workflow configuration
 */
export type WorkflowConfig = {
	name: string;
	triggerSchema?: z.ZodType;
	logger?: Logger;
};

/**
 * Workflow interface
 */
export interface Workflow {
	config: WorkflowConfig;
	steps: Step[];
	dependencies: Record<string, string[]>;
	conditions: Record<string, StepCondition>;
	variables: Record<string, VariableMapping>;
	currentDependency: string | string[] | null;

	step(stepDefinition: Step, options?: StepOptions): Workflow;
	then(stepDefinition: Step, options?: StepOptions): Workflow;
	after(stepId: string | string[]): Workflow;
	commit(): Workflow;
	createRun(): {
		run: (params: { triggerData: any }) => Promise<{
			results: Record<string, any>;
		}>;
	};
}

/**
 * Helper function to get value from an object using a dot path
 */
function getValueByPath(obj: any, path?: string): any {
	if (!path) return obj;
	return path.split(".").reduce((o, i) => (o ? o[i] : undefined), obj);
}

/**
 * Helper function to evaluate a condition
 */
function evaluateCondition(condition: ConditionalQuery, value: any): boolean {
	if (condition.$eq !== undefined) return value === condition.$eq;
	if (condition.$neq !== undefined) return value !== condition.$neq;
	if (condition.$gt !== undefined)
		return typeof value === "number" && value > condition.$gt;
	if (condition.$gte !== undefined)
		return typeof value === "number" && value >= condition.$gte;
	if (condition.$lt !== undefined)
		return typeof value === "number" && value < condition.$lt;
	if (condition.$lte !== undefined)
		return typeof value === "number" && value <= condition.$lte;
	if (condition.$in !== undefined)
		return Array.isArray(condition.$in) && condition.$in.includes(value);
	if (condition.$nin !== undefined)
		return Array.isArray(condition.$nin) && !condition.$nin.includes(value);
	if (condition.$exists !== undefined)
		return (value !== undefined && value !== null) === condition.$exists;

	if (condition.$and !== undefined) {
		return condition.$and.every((subCondition) =>
			evaluateCondition(subCondition, value),
		);
	}

	if (condition.$or !== undefined) {
		return condition.$or.some((subCondition) =>
			evaluateCondition(subCondition, value),
		);
	}

	return true; // No conditions
}

/**
 * Creates a workflow
 */
export function Workflow({
	name,
	triggerSchema,
	logger,
}: WorkflowConfig): Workflow {
	const steps: Step[] = [];
	const dependencies: Record<string, string[]> = {};
	const conditions: Record<string, StepCondition> = {};
	const variables: Record<string, VariableMapping> = {};
	const currentDependency: string | string[] | null = null;

	const workflow: Workflow = {
		config: {
			name,
			triggerSchema,
			logger,
		},
		steps,
		dependencies,
		conditions,
		variables,
		currentDependency,

		step(stepDefinition: Step, options: StepOptions = {}) {
			steps.push(stepDefinition);

			// Initialize dependencies if they don't exist
			if (!dependencies[stepDefinition.config.id]) {
				dependencies[stepDefinition.config.id] = [];
			}

			// Add dependency if we're in an "after" chain
			if (workflow.currentDependency) {
				if (Array.isArray(workflow.currentDependency)) {
					// Multiple dependencies
					dependencies[stepDefinition.config.id] = [
						...dependencies[stepDefinition.config.id],
						...workflow.currentDependency,
					];
				} else {
					// Single dependency
					dependencies[stepDefinition.config.id].push(
						workflow.currentDependency,
					);
				}
				workflow.currentDependency = null;
			}

			// Store condition if provided
			if (options?.when) {
				conditions[stepDefinition.config.id] = options.when;
			}

			// Store variable mappings if provided
			if (options?.variables) {
				variables[stepDefinition.config.id] = options.variables;
			}

			return workflow;
		},

		// biome-ignore lint/suspicious/noThenProperty: <explanation>
		then(stepDefinition: Step, options: StepOptions = {}) {
			if (steps.length === 0) {
				throw new Error('Cannot call "then" without a previous step');
			}

			const previousStepId = steps[steps.length - 1].config.id;
			steps.push(stepDefinition);

			// Initialize dependencies array if needed
			if (!dependencies[stepDefinition.config.id]) {
				dependencies[stepDefinition.config.id] = [];
			}

			// Add the previous step as a dependency
			dependencies[stepDefinition.config.id].push(previousStepId);

			// Store condition if provided
			if (options?.when) {
				conditions[stepDefinition.config.id] = options.when;
			}

			// Store variable mappings if provided
			if (options?.variables) {
				variables[stepDefinition.config.id] = options.variables;
			}

			return workflow;
		},

		after(stepId: string | string[]) {
			workflow.currentDependency = stepId;
			return workflow;
		},

		commit() {
			// Validate workflow configuration
			if (steps.length === 0) {
				throw new Error("Workflow must have at least one step");
			}

			// Check for circular dependencies
			const visited = new Set<string>();
			const recursionStack = new Set<string>();

			const checkCycle = (stepId: string): boolean => {
				if (recursionStack.has(stepId)) return true;
				if (visited.has(stepId)) return false;

				visited.add(stepId);
				recursionStack.add(stepId);

				const deps = dependencies[stepId] || [];
				for (const dep of deps) {
					if (checkCycle(dep)) return true;
				}

				recursionStack.delete(stepId);
				return false;
			};

			for (const step of steps) {
				if (checkCycle(step.config.id)) {
					throw new Error("Circular dependency detected in workflow");
				}
			}

			return workflow;
		},

		createRun() {
			const workflowSteps = [...steps];
			const workflowDependencies = { ...dependencies };
			const workflowConditions = { ...conditions };
			const workflowVariables = { ...variables };
			const triggerSchemaObj = triggerSchema;
			const workflowLogger = logger || console;

			return {
				async run({ triggerData }) {
					// Validate trigger data if schema exists
					if (triggerSchemaObj) {
						try {
							triggerSchemaObj.parse(triggerData);
						} catch (error) {
							workflowLogger.error(
								// @ts-ignore
								`Trigger data validation failed: ${error.message}`,
							);
							// @ts-ignore
							throw new Error(`Invalid trigger data: ${error.message}`);
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
					const pendingSteps = new Set(
						workflowSteps.map((step) => step.config.id),
					);
					const skippedSteps = new Set<string>();

					while (pendingSteps.size > 0) {
						let progress = false;

						for (const step of workflowSteps) {
							if (!pendingSteps.has(step.config.id)) continue;

							// Check if all dependencies are satisfied
							const deps = workflowDependencies[step.config.id] || [];
							const depsReady = deps.every(
								(depId) => executedSteps.has(depId) || skippedSteps.has(depId),
							);

							if (depsReady) {
								// Check if step has a condition
								const condition = workflowConditions[step.config.id];
								let shouldRun = true;

								if (condition) {
									const { ref, query } = condition;
									const refStepId = ref.step;

									// Special case for "trigger"
									const refValue =
										refStepId === "trigger"
											? getValueByPath(triggerData, ref.path)
											: getValueByPath(results[refStepId], ref.path);

									shouldRun = evaluateCondition(query, refValue);

									if (!shouldRun) {
										workflowLogger.info(
											`Skipping step: ${step.config.id} (condition not met)`,
										);
										skippedSteps.add(step.config.id);
										pendingSteps.delete(step.config.id);
										progress = true;
										continue;
									}
								}

								workflowLogger.info(`Executing step: ${step.config.id}`);

								try {
									// Process variable mappings if they exist
									let input: any;
									const stepVariables = workflowVariables[step.config.id];

									if (stepVariables) {
										// Build input object from variable mappings
										input = {};

										for (const [key, mapping] of Object.entries(
											stepVariables,
										)) {
											if (typeof mapping === "object" && "step" in mapping) {
												const mapStepId = mapping.step;
												const mapPath = mapping.path;

												if (mapStepId === "trigger") {
													input[key] = getValueByPath(triggerData, mapPath);
												} else {
													input[key] = getValueByPath(
														results[mapStepId],
														mapPath,
													);
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
									results[step.config.id] = await step.execute({
										input,
										context,
									});
									executedSteps.add(step.config.id);
									pendingSteps.delete(step.config.id);

									workflowLogger.info(`Completed step: ${step.config.id}`);
									progress = true;
								} catch (error) {
									workflowLogger.error(
										// @ts-ignore
										`Error in step ${step.config.id}: ${error.message}`,
									);
									results[step.config.id] = {
										status: "failed",
										// @ts-ignore
										error: error.message,
									};
									executedSteps.add(step.config.id);
									pendingSteps.delete(step.config.id);
									progress = true;
								}
							}
						}

						if (!progress && pendingSteps.size > 0) {
							const remainingSteps = Array.from(pendingSteps).join(", ");
							throw new Error(
								`Deadlock detected in workflow execution. Remaining steps: ${remainingSteps}`,
							);
						}
					}

					return { results };
				},
			};
		},
	};

	return workflow;
}
