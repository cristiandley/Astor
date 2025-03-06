import { z } from "zod";

const envSchema = z.object({
    openAiKey: z.string().optional(),
    environment: z
        .enum(["development", "production", "test"])
        .default("development"),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
    defaultModel: z.string().default("gpt-4o-mini"),
    batchConcurrency: z.number().min(1).max(10).default(3),
});

export type Config = z.infer<typeof envSchema>;

function configure(): Config {
    const env = {
        openAiKey: Bun.env.OPENAI_API_KEY,
        environment: Bun.env.NODE_ENV as any,
        logLevel: Bun.env.LOG_LEVEL as any,
        defaultModel: Bun.env.DEFAULT_MODEL,
        batchConcurrency: Number.parseInt(Bun.env.BATCH_CONCURRENCY || "5", 10),
    };

    try {
        return envSchema.parse(env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("Environment validation error:");
            for (const issue of error.issues) {
                console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
            }
        } else {
            console.error("Environment validation error:", error);
        }
        process.exit(1);
    }
}

const config = configure();

export default config;