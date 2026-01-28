/**
 * Email Service Utility
 * 
 * Handles sending emails for verification and password reset
 * Uses Resend API (https://resend.com)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'QuillLearn <noreply@quilllearn.com>';
const APP_URL = process.env.APP_URL || 'http://localhost:5174';

/**
 * Send an email using Resend API
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendEmail(to, subject, html) {
    if (!RESEND_API_KEY) {
        console.error('RESEND_API_KEY not configured');
        return { success: false, error: 'Email service not configured' };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [to],
                subject,
                html
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Resend API error:', data);
            return { success: false, error: data.message || 'Failed to send email' };
        }

        return { success: true, id: data.id };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: 'Failed to send email' };
    }
}

/**
 * Send email verification email
 * @param {string} email - User's email
 * @param {string} token - Verification token
 * @param {string} username - User's username
 */
export async function sendVerificationEmail(email, token, username) {
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px 0; }
                .logo { font-size: 28px; font-weight: bold; color: #667eea; }
                .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin: 20px 0; }
                .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
                .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">QuillLearn</div>
                </div>
                <div class="content">
                    <h2>Verify your email address</h2>
                    <p>Hi ${username},</p>
                    <p>Thanks for signing up for QuillLearn! Please verify your email address by clicking the button below:</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${verifyUrl}" class="button">Verify Email</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #667eea;">${verifyUrl}</p>
                    <p>This link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>If you didn't create an account with QuillLearn, you can safely ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(email, 'Verify your QuillLearn email', html);
}

/**
 * Send password reset email
 * @param {string} email - User's email
 * @param {string} token - Reset token
 * @param {string} username - User's username
 */
export async function sendPasswordResetEmail(email, token, username) {
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px 0; }
                .logo { font-size: 28px; font-weight: bold; color: #667eea; }
                .content { background: #f9fafb; border-radius: 12px; padding: 30px; margin: 20px 0; }
                .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
                .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">QuillLearn</div>
                </div>
                <div class="content">
                    <h2>Reset your password</h2>
                    <p>Hi ${username},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                    <p>This link will expire in 1 hour.</p>
                </div>
                <div class="footer">
                    <p>If you didn't request a password reset, you can safely ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(email, 'Reset your QuillLearn password', html);
}

