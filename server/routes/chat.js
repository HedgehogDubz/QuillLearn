/**
 * Chat API Routes
 *
 * Handles AI chat requests using AWS Bedrock (Claude)
 */

import express from "express";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const router = express.Router();


const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});

const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "global.anthropic.claude-sonnet-4-5-20250929-v1:0";


router.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "Missing prompt"
      });
    }

    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 800, temperature: 0.2, topP: 0.9 },
    });

    const resp = await bedrock.send(command);
    const text = resp.output?.message?.content?.[0]?.text ?? "";

    res.json({
      success: true,
      text
    });
  } catch (err) {
    console.error('Bedrock chat error:', err);
    res.status(500).json({
      success: false,
      error: "Bedrock request failed",
      message: err.message
    });
  }
});

export default router;
