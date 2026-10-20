import { AppError } from "@/lib/errors";
import type { ProductContentAnalysisDTO, SeoContentDraftDTO, SeoContentDraftResultDTO } from "@/types/dto";
import {
  buildSeoDraftPrompt,
  parseSeoDraftResponse,
  SEO_DRAFT_JSON_SCHEMA,
  type SeoDraftProductContext,
} from "./seo-draft";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

function openAiConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      "OPENAI_API_KEY is not set. Add it to .env to generate SEO drafts.",
      503,
      "OPENAI_NOT_CONFIGURED",
    );
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  return { apiKey, model };
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

/** Builds the prompt from the analysis and asks OpenAI for structured SEO copy. */
export async function generateSeoContentDraft(
  product: SeoDraftProductContext,
  analysis: ProductContentAnalysisDTO,
): Promise<SeoContentDraftResultDTO> {
  if (analysis.status === "NO_CONTENT") {
    throw new AppError("Capture page content before generating an SEO draft.", 400, "NO_CONTENT");
  }

  const prompt = buildSeoDraftPrompt(product, analysis);
  const { apiKey, model } = openAiConfig();

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write original SEO product copy for cosmetics retailers. Respond only with JSON matching the schema. Never invent product facts.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: SEO_DRAFT_JSON_SCHEMA,
        },
      }),
    });
  } catch {
    throw new AppError("Could not reach OpenAI. Check your network and try again.", 502, "OPENAI_NETWORK_ERROR");
  }

  const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
  if (!response.ok) {
    const message = body?.error?.message ?? `OpenAI request failed (${response.status})`;
    throw new AppError(message, response.status >= 400 && response.status < 600 ? response.status : 502, "OPENAI_ERROR");
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new AppError("OpenAI returned an empty response. Please try again.", 502, "OPENAI_EMPTY");
  }

  const draft: SeoContentDraftDTO = parseSeoDraftResponse(content);
  return { prompt, draft };
}
