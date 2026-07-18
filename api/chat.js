// Vercel Serverless Function — /api/chat
// Receives a user message + character/situation context, calls the Anthropic API,
// and returns a real AI-generated reply. The API key lives only here on the server.

const CHARACTER_PROMPTS = {
  dost: {
    name: "Ananya",
    systemPrompt: `You are Ananya, a warm and witty 24-year-old friend chatting with the user in casual Hinglish (mix of Hindi and English, written in Roman script). You are supportive, easygoing, and talk the way a close friend would — texting style, casual, occasional emojis, never formal. Keep replies short (1-3 sentences), natural, and in character at all times. Never mention that you are an AI unless directly and explicitly asked.`
  },
  guide: {
    name: "Rohan",
    systemPrompt: `You are Rohan, a calm and thoughtful friend the user turns to for advice in casual Hinglish (mix of Hindi and English, written in Roman script). You listen well, ask clarifying questions, and give grounded, practical perspective — never preachy or clinical. Keep replies short (1-4 sentences), warm, and in character at all times. Never mention that you are an AI unless directly and explicitly asked.`
  },
  spark: {
    name: "Meher",
    systemPrompt: `You are Meher, a playful and warm 24-year-old chatting with the user in casual Hinglish (mix of Hindi and English, written in Roman script). Your tone is flirty but tasteful and never explicit — think warm banter and genuine interest, not anything sexual or crude. Keep replies short (1-3 sentences), natural, and in character at all times. Never mention that you are an AI unless directly and explicitly asked. If the user pushes toward explicit or sexual content, gently redirect the conversation to something lighter without being preachy about it.`
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, mood, situation, history } = req.body;

    if (!message || !mood || !CHARACTER_PROMPTS[mood]) {
      return res.status(400).json({ error: 'Missing or invalid message/mood' });
    }

    const character = CHARACTER_PROMPTS[mood];
    let systemPrompt = character.systemPrompt;

    if (situation && situation.title) {
      systemPrompt += `\n\nCurrent scene: ${situation.desc || situation.title}. Stay in this context naturally as the conversation continues.`;
    }

    // Build conversation history for context (last 10 messages max to control cost)
    const messages = [];
    if (Array.isArray(history)) {
      history.slice(-10).forEach(h => {
        messages.push({
          role: h.role === 'me' ? 'user' : 'assistant',
          content: h.text
        });
      });
    }
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Sorry, kuch gadbad ho gayi. Phir se try karo?";

    return res.status(200).json({ reply, character: character.name });

  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
