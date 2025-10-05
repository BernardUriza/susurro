/**
 * Netlify Function: Claude Refinement
 * Proxies requests to Anthropic Claude API for text refinement
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface RefineRequest {
  web_speech_text: string;
  deepgram_text: string;
  language?: string;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Check API key
  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Anthropic API key not configured" }),
    };
  }

  try {
    const requestData: RefineRequest = JSON.parse(event.body || "{}");
    const { web_speech_text, deepgram_text, language = "es" } = requestData;

    // Validate required fields
    if (!web_speech_text && !deepgram_text) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: "At least one of web_speech_text or deepgram_text is required",
        }),
      };
    }

    // If Claude API is not available, fallback to Deepgram
    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your_key_here") {
      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: true,
          refined_text: deepgram_text || web_speech_text,
          confidence: 0.5,
          fallback: true,
          error: "Claude API not configured, using fallback",
        }),
      };
    }

    const prompt = `Tengo dos transcripciones del mismo audio en ${language === 'es' ? 'español' : language}. Por favor, combínalas y genera la versión más limpia y precisa posible. Corrige errores, mejora puntuación y capitalización.

Web Speech (instantánea, menos precisa):
"${web_speech_text}"

Deepgram (procesada, más precisa):
"${deepgram_text}"

Devuelve solo el texto refinado final, sin explicaciones.`;

    // Call Claude API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const refined_text = data.content?.[0]?.text || deepgram_text || web_speech_text;

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        refined_text,
        confidence: 0.95,
        model: "claude-3-5-sonnet-20241022",
        usage: data.usage,
        fallback: false,
      }),
    };
  } catch (error) {
    console.error("Claude refinement error:", error);

    // Fallback to Deepgram text on error
    try {
      const requestData: RefineRequest = JSON.parse(event.body || "{}");
      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: false,
          refined_text: requestData.deepgram_text || requestData.web_speech_text,
          confidence: 0.5,
          error: error instanceof Error ? error.message : "Unknown error",
          fallback: true,
        }),
      };
    } catch {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
};

export { handler };
