import express from "express";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { supabase } from "../config/supabase.js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const router = express.Router();

// Log config for debugging
console.log('📊 Notes-to-Sheets route loaded');
console.log('   AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
console.log('   BEDROCK_MODEL_ID:', process.env.BEDROCK_MODEL_ID ? 'SET' : 'NOT SET');

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

/**
 * Build the prompt based on conversion type
 */
function buildPrompt(noteContent, conversionType, numRows, numColumns, columnHeaders, customPrompt = '') {
  const headersStr = columnHeaders.join(', ');
  const isAutoRows = numRows === 'auto';

  const baseInstruction = isAutoRows
    ? `You are a study sheet generator. Generate as many DATA rows as appropriate for a study sheet based on the content provided.
The columns are: ${headersStr}.
Output ONLY valid JSON - no markdown, no explanation, no code blocks.
The JSON should be an array of arrays, where each inner array has exactly ${numColumns} string elements.

IMPORTANT: Do NOT include column headers as the first row. The headers (${headersStr}) are handled separately.
Generate as many rows as needed to fully cover the content (typically between 5-30 rows depending on content length).
Make sure each cell contains meaningful, educational content.`
    : `You are a study sheet generator. Generate exactly ${numRows} DATA rows for a study sheet.
The columns are: ${headersStr}.
Output ONLY valid JSON - no markdown, no explanation, no code blocks.
The JSON should be an array of arrays, where each inner array has exactly ${numColumns} string elements.

IMPORTANT: Do NOT include column headers as the first row. The headers (${headersStr}) are handled separately.
Only generate the actual data/content rows - ${numRows} rows total, each containing data that corresponds to the columns.
Make sure each cell contains meaningful, educational content.`;

  let specificInstruction = '';

  switch (conversionType) {
    case 'direct':
      specificInstruction = `Extract questions and answers DIRECTLY from the following notes.
Create clear, concise questions based on the exact information provided.
Each question should test recall of specific facts or concepts from the notes.
The answers should come directly from the notes content.`;
      break;
    case 'vocabulary':
      specificInstruction = `Extract key vocabulary terms and their definitions from the following notes.
Focus on important terms, concepts, technical words, and their explanations.
Provide clear, accurate definitions that would help with studying.`;
      break;
    case 'study':
      specificInstruction = `Generate comprehension questions based on the following notes.
Create questions that test UNDERSTANDING of the content, not just recall.
Include questions about:
- Main ideas and themes
- Cause and effect relationships
- Comparisons and contrasts
- Applications of concepts
- Why and how questions
Answers should demonstrate deep understanding of the material.`;
      break;
    case 'theme':
      specificInstruction = `Using the following notes as inspiration, generate related study content.
Identify the main themes and topics, then create additional educational content that:
- Expands on key concepts
- Provides related facts or examples
- Explores connected topics
- Offers deeper insights into the subject matter`;
      break;
    case 'custom':
      specificInstruction = customPrompt
        ? `Follow these custom instructions: ${customPrompt}

Apply these instructions to the notes content below.`
        : 'Generate study content from the following notes.';
      break;
    default:
      specificInstruction = `Generate study content from the following notes.`;
  }

  // Strip HTML tags from note content for cleaner processing
  const cleanContent = noteContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const rowInstruction = isAutoRows
    ? `Generate as many rows as appropriate to fully cover the content. Output only the JSON array, nothing else.`
    : `Generate exactly ${numRows} rows with high-quality, educational content. Output only the JSON array, nothing else.`;

  return `${baseInstruction}

${specificInstruction}

Notes content:
"""
${cleanContent}
"""

${rowInstruction}
Example format: [["cell1", "cell2"], ["cell3", "cell4"]]`;
}

/**
 * Parse AI response to extract grid data
 */
function parseAIResponse(text, numRows, numColumns) {
  try {
    // Try to extract JSON from the response
    let jsonStr = text.trim();

    // Remove any markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Try to find array in the response
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Ensure we have the right structure
    const grid = parsed.slice(0, numRows).map(row => {
      if (!Array.isArray(row)) {
        return Array(numColumns).fill('');
      }
      // Ensure each row has the correct number of columns
      const normalizedRow = row.slice(0, numColumns).map(cell => String(cell || ''));
      while (normalizedRow.length < numColumns) {
        normalizedRow.push('');
      }
      return normalizedRow;
    });

    // Pad with empty rows if needed
    while (grid.length < numRows) {
      grid.push(Array(numColumns).fill(''));
    }

    return grid;
  } catch (err) {
    console.error('Error parsing AI response:', err);
    // Return empty grid on parse failure
    return Array(numRows).fill(null).map(() => Array(numColumns).fill(''));
  }
}

/**
 * POST /api/notes-to-sheets
 * Convert notes to a new study sheet
 */
router.post("/", async (req, res) => {
  try {
    const {
      noteContent,
      noteTitle,
      conversionType,
      numRows,
      numColumns,
      columnHeaders,
      customPrompt,
      userId
    } = req.body;

    // Validate required fields
    if (!noteContent || noteContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Your notes appear to be empty",
        message: "Please add some content to your notes before converting."
      });
    }

    // Validate custom prompt for custom type
    if (conversionType === 'custom' && (!customPrompt || customPrompt.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: "Custom prompt required",
        message: "Please provide instructions for how you want the notes converted."
      });
    }

    // Validate rows
    const safeNumRows = Math.min(Math.max(parseInt(numRows) || 10, 1), 50);
    const safeNumColumns = Math.min(Math.max(parseInt(numColumns) || 2, 2), 6);

    console.log(`Converting notes: type=${conversionType}, rows=${safeNumRows}, cols=${safeNumColumns}`);

    // Build the prompt
    const prompt = buildPrompt(noteContent, conversionType, safeNumRows, safeNumColumns, columnHeaders, customPrompt);

    // Call Bedrock AI
    let text = '';
    try {
      const command = new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 8000, temperature: 0.4 },  // Note: Can't use both temperature and topP
      });

      const resp = await bedrock.send(command);
      text = resp.output?.message?.content?.[0]?.text ?? "";

      if (!text) {
        throw new Error('Empty response from AI');
      }
    } catch (aiError) {
      console.error('AI service error:', aiError);

      // Provide specific error messages based on error type
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

    // Parse the AI response into grid data
    const gridData = parseAIResponse(text, safeNumRows, safeNumColumns);

    // Check if we got meaningful content
    const hasContent = gridData.some(row => row.some(cell => cell && cell.trim().length > 0));
    if (!hasContent) {
      return res.status(422).json({
        success: false,
        error: "Could not generate content",
        message: "The AI couldn't extract meaningful content from your notes. Try adding more detailed notes or using a different conversion type."
      });
    }

    // Create a new sheet with the generated data
    const sessionId = crypto.randomUUID();
    const sheetTitle = noteTitle ? `${noteTitle} - Study Sheet` : 'Generated Study Sheet';

    // Convert grid data to the format expected by the sheets table
    // The sheets table expects rows as array of { data: string[] } objects
    // And the first row should be the headers
    const rowsData = [
      { data: columnHeaders },  // Header row
      ...gridData.map(row => ({ data: row }))  // Data rows
    ];

    // Generate default column widths (150px per column)
    const columnWidthsArray = Array(safeNumColumns).fill(150);

    // Save to Supabase
    const { error: saveError } = await supabase
      .from('sheets')
      .insert({
        session_id: sessionId,
        user_id: userId,
        title: sheetTitle,
        rows: rowsData,
        column_widths: columnWidthsArray,
        last_time_saved: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('Error saving sheet to Supabase:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save generated sheet',
        message: 'There was a problem saving your sheet. Please try again.'
      });
    }

    console.log(`Successfully created sheet: ${sessionId}`);

    res.json({
      success: true,
      sessionId,
      title: sheetTitle,
      gridData,
      columnHeaders
    });

  } catch (err) {
    console.error('Notes to sheet conversion error:', err);
    res.status(500).json({
      success: false,
      error: "Conversion failed",
      message: err.message || "An unexpected error occurred. Please try again."
    });
  }
});

export default router;
