/**
 * Claude Service — thin wrapper around @anthropic-ai/sdk
 *
 * callClaude()   — non-streaming single response (schemes Q&A, disease analysis, summaries)
 * summarizeConversation() — generates a rolling summary of a chat session
 */
import Anthropic from '@anthropic-ai/sdk';
import { ENV } from '../config/env.js';

let _client = null;
function client() {
  if (!_client) {
    if (!ENV.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set in .env');
    _client = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });
  }
  return _client;
}

const MODEL = ENV.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

/**
 * Non-streaming Claude call.
 * @param {object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.userMessage
 * @param {number} [opts.maxTokens=800]
 * @returns {Promise<string>} response text
 */
export async function callClaude({ systemPrompt, userMessage, maxTokens = 800 }) {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content[0]?.text || '';
}

/**
 * Generates a rolling summary of a conversation for context compression.
 * Called automatically when a conversation exceeds 20 messages.
 * @param {Array<{role:string, content:string}>} messages
 * @param {string} [existingSummary] - previous summary to extend
 * @returns {Promise<string>} new summary
 */
export async function summarizeConversation(messages, existingSummary = '') {
  const transcript = messages
    .map(m => `${m.role === 'user' ? 'Farmer' : 'FarmMind'}: ${m.content}`)
    .join('\n');

  const prompt = existingSummary
    ? `Previous summary:\n${existingSummary}\n\nNew messages to add:\n${transcript}`
    : transcript;

  return callClaude({
    systemPrompt: `You are summarizing a farming advisory conversation between a farmer and an AI assistant.
Create a concise summary (max 150 words) capturing: the farmer's key problems/questions, the advice given,
any diseases identified, recommendations made, and any follow-up actions discussed.
This summary will be used as context for future messages — keep it factual and specific.`,
    userMessage: `Summarize this conversation:\n\n${prompt}`,
    maxTokens: 250,
  });
}
