import "server-only";
import { embedMany, gateway, transcribe } from "ai";
import { EMBEDDING_DIMENSIONS } from "../db/schema";
import { aiMock, EMBEDDING_MODEL, TRANSCRIPTION_MODEL } from "./config";
import { recordUsage } from "./usage";

/**
 * Embeddings and transcription through Vercel AI Gateway. In AI_MOCK mode,
 * vectors are hashed bags of words: crude, but similar texts land close
 * together, which is enough to exercise hybrid search locally.
 */
export async function embedTexts(workspaceId: string, values: string[], purpose: "document" | "query" = "document") {
  if (values.length === 0) return [];
  if (aiMock()) return values.map(mockVector);
  const { embeddings, usage } = await embedMany({
    model: gateway.embeddingModel(EMBEDDING_MODEL),
    values,
    providerOptions: { voyage: { inputType: purpose } },
  });
  await recordUsage({
    workspaceId,
    feature: "embed",
    provider: "gateway",
    model: EMBEDDING_MODEL,
    inputTokens: usage?.tokens ?? 0,
  });
  return embeddings;
}

export type Transcript = {
  text: string;
  segments: { text: string; start: number; end: number }[];
  durationSec?: number;
  language?: string;
};

export async function transcribeAudio(workspaceId: string, audio: Uint8Array): Promise<Transcript> {
  if (aiMock()) {
    return {
      text: "Transcription simulée (AI_MOCK). Mon mentor m'a conseillé de publier trois reels par semaine. J'ai décidé de tester un nouveau fournisseur. Je dois lui envoyer le bilan des ventes vendredi.",
      segments: [{ text: "Transcription simulée.", start: 0, end: 4 }],
      durationSec: 4,
      language: "fr",
    };
  }
  const result = await transcribe({
    model: gateway.transcriptionModel(TRANSCRIPTION_MODEL),
    audio,
    providerOptions: { elevenlabs: { languageCode: "fra", diarize: true } },
  });
  await recordUsage({
    workspaceId,
    feature: "transcribe",
    provider: "gateway",
    model: TRANSCRIPTION_MODEL,
    inputTokens: Math.round(result.durationInSeconds ?? 0),
  });
  return {
    text: result.text,
    segments: result.segments.map((segment) => ({ text: segment.text, start: segment.startSecond, end: segment.endSecond })),
    durationSec: result.durationInSeconds,
    language: result.language,
  };
}

const STOPWORDS = new Set(
  "le la les un une des du de d l et ou a au aux en dans sur pour par avec sans ce cet cette ces mon ma mes ton ta tes son sa ses je tu il elle on nous vous ils elles que qui quoi est sont etre avoir ai as a pas ne plus tres".split(" "),
);

function mockVector(text: string) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  for (const word of words) {
    const stem = word.slice(0, 6);
    vector[hash(stem) % EMBEDDING_DIMENSIONS] += 1;
    for (let i = 0; i + 3 <= stem.length; i++) vector[hash(`#${stem.slice(i, i + 3)}`) % EMBEDDING_DIMENSIONS] += 0.3;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
