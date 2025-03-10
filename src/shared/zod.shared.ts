/**
 * Helper function to convert Zod schema to JSON Schema
 * This is a simplified version that works with the most common Zod schema types
 */
export function zodToJsonSchema(schema: any): any {
	// Check if the schema has a _def property (common in Zod schemas)
	if (!schema || typeof schema !== "object") {
		return { type: "object", properties: {} };
	}

	try {
		// Try to use the built-in method if available
		if (typeof schema.toJSON === "function") {
			return schema.toJSON();
		}

		// For Zod objects, try to extract the shape
		if (schema._def?.typeName === "ZodObject" && schema._def.shape) {
			const properties: Record<string, any> = {};
			const required: string[] = [];

			// biome-ignore lint/complexity/noForEach: <explanation>
			Object.entries(schema._def.shape()).forEach(
				([key, value]: [string, any]) => {
					properties[key] = zodToJsonSchema(value);

					// Check if the property is required
					if (!value._def?.isOptional) {
						required.push(key);
					}
				},
			);

			return {
				type: "object",
				properties,
				...(required.length > 0 ? { required } : {}),
			};
		}

		// For Zod enums
		if (
			schema._def?.typeName === "ZodEnum" &&
			Array.isArray(schema._def.values)
		) {
			return {
				type: "string",
				enum: schema._def.values,
			};
		}

		// For Zod strings
		if (schema._def?.typeName === "ZodString") {
			return { type: "string" };
		}

		// For Zod numbers
		if (schema._def?.typeName === "ZodNumber") {
			return { type: "number" };
		}

		// For Zod booleans
		if (schema._def?.typeName === "ZodBoolean") {
			return { type: "boolean" };
		}

		// For Zod arrays
		if (schema._def?.typeName === "ZodArray" && schema._def.type) {
			return {
				type: "array",
				items: zodToJsonSchema(schema._def.type),
			};
		}

		// Default fallback
		return { type: "object", properties: {} };
	} catch (error) {
		console.error("Error converting Zod schema to JSON Schema:", error);
		return { type: "object", properties: {} };
	}
}
