import { z } from "zod";

/**
 * Configuration schema
 */
export const configSchema = z.object({
	openAIKey: z.string().optional(),
	environment: z
		.enum(["development", "production", "test"])
		.default("development"),
	logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
	defaultModel: z.string().default("gpt-4o"),
	batchConcurrency: z.number().min(1).max(10).default(3),
});

/**
 * Configuration type
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Default configuration
 */
export const defaultConfig: Config = {
	openAIKey: undefined,
	environment: "development",
	logLevel: "info",
	defaultModel: "gpt-4o",
	batchConcurrency: 3,
};

/**
 * Validate and merge configuration
 */
export function createConfig(userConfig: Partial<Config> = {}): Config {
	try {
		return configSchema.parse({
			...defaultConfig,
			...userConfig,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error("Configuration validation error:");
			for (const issue of error.issues) {
				console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
			}
		} else {
			console.error("Configuration error:", error);
		}
		throw new Error("Invalid configuration");
	}
}
