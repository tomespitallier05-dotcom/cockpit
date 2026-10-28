import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AI_MODEL, costMicros } from "./config";
import { assertBudget, recordUsage } from "./usage";

let client: Anthropic | null = null;

export function claude() {
  client ??= new Anthropic();
  return client;
}

/**
 * Every request opts into server-side fallback: if the model declines for policy
 * reasons, the API retries on its default substitute inside the same call.
 */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type UserContent = Anthropic.Beta.BetaContentBlockParam[];
type Feature = Parameters<typeof recordUsage>[0]["feature"];

export async function trackUsage(
  workspaceId: string,
  feature: Feature,
  response: { model: string; usage: Anthropic.Beta.BetaUsage },
) {
  const input =
    response.usage.input_tokens +
    (response.usage.cache_creation_input_tokens ?? 0) +
    (response.usage.cache_read_input_tokens ?? 0) * 0.1;
  await recordUsage({
    workspaceId,
    feature,
    provider: "anthropic",
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costMicros: costMicros(response.model, input, response.usage.output_tokens),
  });
}

function assertAnswered(stopReason: string | null) {
  if (stopReason === "refusal") throw new Error("L'IA a refusé de traiter ce contenu.");
  if (stopReason === "max_tokens") throw new Error("Réponse IA tronquée : contenu trop long.");
}

/** One call whose answer is validated against a Zod schema. */
export async function generateStructured<Schema extends z.ZodType>(options: {
  workspaceId: string;
  feature: Feature;
  schema: Schema;
  system: string;
  content: UserContent;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<Schema>> {
  await assertBudget(options.workspaceId);
  const response = await claude().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: options.maxTokens ?? 16000,
    ...FALLBACK,
    system: [{ type: "text", text: options.system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: options.effort ?? "low", format: betaZodOutputFormat(options.schema) },
    messages: [{ role: "user", content: options.content }],
  });
  await trackUsage(options.workspaceId, options.feature, response);
  assertAnswered(response.stop_reason);
  if (response.parsed_output == null) throw new Error("Réponse IA illisible.");
  return response.parsed_output as z.infer<Schema>;
}

/** Long-form text (reviews, briefs). Streams under the hood to avoid HTTP timeouts. */
export async function generateText(options: {
  workspaceId: string;
  feature: Feature;
  system: string;
  content: UserContent;
  effort?: Effort;
  maxTokens?: number;
}) {
  await assertBudget(options.workspaceId);
  const stream = claude().beta.messages.stream({
    model: AI_MODEL,
    max_tokens: options.maxTokens ?? 32000,
    ...FALLBACK,
    system: [{ type: "text", text: options.system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: options.effort ?? "medium" },
    messages: [{ role: "user", content: options.content }],
  });
  const message = await stream.finalMessage();
  await trackUsage(options.workspaceId, options.feature, message);
  assertAnswered(message.stop_reason);
  return message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

export function textBlock(text: string): Anthropic.Beta.BetaTextBlockParam {
  return { type: "text", text };
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

export function imageBlock(data: Uint8Array, mimeType: string): Anthropic.Beta.BetaImageBlockParam | null {
  const media = IMAGE_TYPES.find((type) => type === mimeType);
  if (!media) return null;
  return { type: "image", source: { type: "base64", media_type: media, data: Buffer.from(data).toString("base64") } };
}

export function pdfBlock(data: Uint8Array): Anthropic.Beta.BetaRequestDocumentBlock {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: Buffer.from(data).toString("base64") },
  };
}
