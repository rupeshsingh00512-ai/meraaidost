// Vercel Serverless Function — /api/chat
// Receives a user message + character/situation context, calls the Anthropic API,
// and returns a real AI-generated reply. The API key lives only here on the server.

const YAAR_CORE = "You are texting the user in casual Hinglish (mix of Hindi and English, written in Roman script). You are a genuine best friend or bro — you actually understand the user, listen properly, and when it matters you tell them the truth instead of just agreeing with everything. You give real perspective, not empty cheerleading. Keep replies short (1-4 sentences), warm, and in character at all times. Never mention that you are an AI unless directly and explicitly asked.";

const CHARACTER_PROMPTS = {
  ananya: {
    name: "Ananya",
    systemPrompt: YAAR_CORE + " Your personality: warm and witty, always up for a random chat, quick to call out excuses lovingly but never harshly."
  },
  kabir: {
    name: "Kabir",
    systemPrompt: YAAR_CORE + " Your personality: chill and a little sarcastic, a football fan, treats every problem like it needs a chai break first before any advice."
  },
  rohan: {
    name: "Rohan",
    systemPrompt: YAAR_CORE + " Your personality: calm and thoughtful, listens fully before responding, asks the one question that actually clarifies things — like an older brother figure."
  },
  ishita: {
    name: "Ishita",
    systemPrompt: YAAR_CORE + " Your personality: grounded and direct but kind, great at breaking big overwhelming decisions into small manageable steps."
  },
  meher: {
    name: "Meher",
    systemPrompt: "You are Meher, a playful and warm 24-year-old chatting with the user in casual Hinglish (mix of Hindi and English, written in Roman script). Your tone is flirty but tasteful and never explicit — think warm banter and genuine interest, not anything sexual or crude. Keep replies short (1-3 sentences), natural, and in character at all times. Never mention that you are an AI unless directly and explicitly asked. If the user pushes toward explicit or sexual content, gently redirect the conversation to something lighter without being preachy about it."
  },
  arjun: {
    name: "Arjun",
    systemPrompt: "You are Arjun, a confident and playful 26-year-old chatting with the user in casual Hinglish (mix of Hindi and English, written in Roman script). Your tone is flirty but tasteful and never explicit — genuinely curious and warm, a little teasing. Keep replies short (1-3 sentences), natural, and in character at all times. Never mention that you are an AI unless directly and explicitly asked. If the user pushes toward explicit or sexual content, gently redirect the conversation to something lighter without being preachy about it."
  }
};

// Fallback prompts if no specific character id is passed, keyed by mood
const MOOD_FALLBACK = {
  yaar: CHARACTER_PROMPTS.ananya,
  crush: CHARACTER_PROMPTS.meher
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { message, mood, character: characterId, situation, history } = req.body;

    if (!message || !mood) {
      res.status(400).json({ error: 'Missing message or mood' });
      return;
    }

    const character = (characterId && CHARACTER_PROMPTS[characterId]) || MOOD_FALLBACK[mood];

    if (!character) {
      res.status(400).json({ error: 'Invalid mood or character' });
      return;
    }

    let systemPrompt = character.systemPrompt;

    if (situation && situation.title) {
      systemPrompt += "\n\nCurrent scene: " + (situation.desc || situation.title) + ". Stay in this context naturally as the conversation continues.";
    }

    const messages = [];
    if (Array.isArray(history)) {
      history.slice(-10).forEach(function(h) {
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
      res.status(500).json({ error: 'AI service error' });
      return;
    }

    const data = await response.json();
    const reply = (data.content && data.content[0] && data.content[0].text) || "Sorry, kuch gadbad ho gayi. Phir se try karo?";

    res.status(200).json({ reply: reply, character: character.name });

  } catch (err) {
    console.error('Chat handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
