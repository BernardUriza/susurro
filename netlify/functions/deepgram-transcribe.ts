/**
 * Netlify Function: Deepgram Transcription
 * Proxies requests to Deepgram API for transcription
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const DEEPGRAM_API_KEY = process.env.VITE_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen";

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
  if (!DEEPGRAM_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Deepgram API key not configured" }),
    };
  }

  try {
    // Parse the request body (base64 encoded audio)
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : event.body;

    // Forward to Deepgram
    const response = await fetch(
      `${DEEPGRAM_API_URL}?model=nova-2&smart_format=true&punctuate=true&language=es`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "audio/wav",
        },
        body: body,
      }
    );

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract transcript
    const transcript =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    const confidence =
      data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        transcript,
        confidence,
        model: "deepgram-nova-2",
      }),
    };
  } catch (error) {
    console.error("Deepgram transcription error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

export { handler };
