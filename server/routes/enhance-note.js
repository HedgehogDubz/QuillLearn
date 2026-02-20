/**
 * Enhance Note API Routes
 * 
 * Uses AWS Bedrock to enhance notes with AI
 */

import express from "express";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const router = express.Router();

console.log('🪄 Enhance Note route loaded');

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

/**
 * Build the prompt based on enhancement type
 */
function buildPrompt(noteContent, enhancementType, customPrompt = '') {
  // Strip HTML tags for cleaner processing (we'll ask AI to return HTML)
  const cleanContent = noteContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  const baseInstruction = `You are a writing enhancement assistant. Your task is to enhance the given notes while preserving their meaning and intent.

IMPORTANT: Return ONLY the enhanced content as valid HTML that can be displayed in a rich text editor. 
- Use <p> tags for paragraphs
- Use <h1>, <h2>, <h3> for headings
- Use <ul> and <li> for bullet lists
- Use <ol> and <li> for numbered lists  
- Use <strong> for bold and <em> for italics
- Use <blockquote> for quotes
- Do NOT include any explanation or commentary, just the enhanced HTML content.`;

  let specificInstruction = '';

  switch (enhancementType) {
    case 'improve':
      specificInstruction = `Improve the writing quality of these notes:
- Fix any grammar or spelling errors
- Improve sentence structure and clarity
- Make the writing more engaging and professional
- Keep the same overall meaning and content`;
      break;
    case 'summarize':
      specificInstruction = `Create a concise summary of these notes:
- Extract the key points and main ideas
- Organize information logically
- Keep it brief but comprehensive
- Use bullet points where appropriate`;
      break;
    case 'expand':
      specificInstruction = `Expand and elaborate on these notes:
- Add more detail and context where helpful
- Include examples to illustrate concepts
- Explain complex ideas more thoroughly
- Add relevant background information`;
      break;
    case 'simplify':
      specificInstruction = `Simplify these notes:
- Use simpler, more accessible language
- Break down complex concepts
- Use shorter sentences
- Make it easier to understand for a general audience`;
      break;
    case 'formalize':
      specificInstruction = `Convert these notes to formal, academic-style writing:
- Use professional and scholarly language
- Structure content with clear sections
- Add appropriate transitions
- Maintain an objective, formal tone`;
      break;
    case 'custom':
      specificInstruction = customPrompt 
        ? `Follow these custom instructions: ${customPrompt}`
        : 'Improve the overall quality of these notes.';
      break;
    default:
      specificInstruction = 'Improve the overall quality of these notes.';
  }

  return `${baseInstruction}

${specificInstruction}

Original notes content:
"""
${cleanContent}
"""

Return ONLY the enhanced HTML content, nothing else.`;
}

/**
 * POST /api/enhance-note
 * Enhance notes using AI
 */
router.post("/", async (req, res) => {
  try {
    const {
      noteContent,
      noteTitle,
      enhancementType,
      customPrompt,
      userId
    } = req.body;

    // Validate required fields
    if (!noteContent || noteContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Your notes appear to be empty",
        message: "Please add some content to your notes before enhancing."
      });
    }

    // Validate custom prompt for custom type
    if (enhancementType === 'custom' && (!customPrompt || customPrompt.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: "Custom prompt required",
        message: "Please provide instructions for how you want the notes enhanced."
      });
    }

    console.log(`Enhancing notes: type=${enhancementType}, title=${noteTitle}`);

    // Build the prompt
    const prompt = buildPrompt(noteContent, enhancementType, customPrompt);

    // Call Bedrock AI
    let text = '';
    try {
      const command = new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 8000, temperature: 0.4 },
      });

      const resp = await bedrock.send(command);
      text = resp.output?.message?.content?.[0]?.text ?? "";

      if (!text) {
        throw new Error('Empty response from AI');
      }
    } catch (aiError) {
      console.error('AI service error:', aiError);

      if (aiError.name === 'CredentialsProviderError' || aiError.message?.includes('credentials')) {
        return res.status(503).json({
          success: false,
          error: "AI service unavailable",
          message: "The AI service is temporarily unavailable. Please try again later."
        });
      }

      if (aiError.name === 'ThrottlingException' || aiError.message?.includes('rate')) {
        return res.status(429).json({
          success: false,
          error: "Too many requests",
          message: "Please wait a moment and try again."
        });
      }

      throw aiError;
    }

    // Clean up the response - remove any markdown code blocks if present
    let enhancedContent = text.trim();
    enhancedContent = enhancedContent.replace(/```html\s*/gi, '').replace(/```\s*/g, '');

    // If the response doesn't look like HTML, wrap it in paragraphs
    if (!enhancedContent.includes('<')) {
      enhancedContent = enhancedContent
        .split('\n\n')
        .map(para => `<p>${para.trim()}</p>`)
        .join('');
    }

    console.log(`Successfully enhanced notes: ${noteTitle}`);

    res.json({
      success: true,
      enhancedContent,
      enhancementType
    });

  } catch (err) {
    console.error('Note enhancement error:', err);
    res.status(500).json({
      success: false,
      error: "Enhancement failed",
      message: err.message || "An unexpected error occurred. Please try again."
    });
  }
});

export default router;

