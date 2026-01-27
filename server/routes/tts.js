/**
 * Text-to-Speech API Routes
 * 
 * Proxies TTS requests to Google Translate's TTS service
 * to avoid CORS issues and provide a clean API
 */

import express from 'express';

const router = express.Router();

// Available languages with their codes and display names
const AVAILABLE_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'sv', name: 'Swedish' },
    { code: 'da', name: 'Danish' },
    { code: 'fi', name: 'Finnish' },
    { code: 'no', name: 'Norwegian' },
    { code: 'tr', name: 'Turkish' },
    { code: 'el', name: 'Greek' },
    { code: 'he', name: 'Hebrew' },
    { code: 'th', name: 'Thai' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'id', name: 'Indonesian' },
    { code: 'cs', name: 'Czech' },
    { code: 'ro', name: 'Romanian' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'mr', name: 'Marathi' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'af', name: 'Afrikaans' },
    { code: 'sw', name: 'Swahili' },
];

/**
 * GET /api/tts/languages
 * Returns list of available TTS languages
 */
router.get('/languages', (req, res) => {
    res.json({
        success: true,
        languages: AVAILABLE_LANGUAGES
    });
});

/**
 * GET /api/tts/speak
 * Proxies TTS request to Google Translate and returns audio
 * Query params:
 *   - text: The text to speak (required)
 *   - lang: Language code (default: 'en')
 */
router.get('/speak', async (req, res) => {
    try {
        const { text, lang = 'en' } = req.query;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Text parameter is required'
            });
        }

        // Limit text length to prevent abuse
        const cleanText = text.trim().slice(0, 500);

        // Validate language code
        const validLang = AVAILABLE_LANGUAGES.find(l => l.code === lang);
        const langCode = validLang ? lang : 'en';

        // Google Translate TTS URL
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${langCode}&client=tw-ob`;

        // Fetch audio from Google
        const response = await fetch(ttsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://translate.google.com/'
            }
        });

        if (!response.ok) {
            throw new Error(`Google TTS returned status ${response.status}`);
        }

        // Get the audio data
        const audioBuffer = await response.arrayBuffer();

        // Set appropriate headers and send audio
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength,
            'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
        });

        res.send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate speech',
            message: error.message
        });
    }
});

export default router;

