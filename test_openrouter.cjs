const OpenAI = require('openai');

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "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",
});

async function run() {
  try {
    const response = await openai.audio.speech.create({
      model: 'openai/gpt-audio',
      voice: 'onyx',
      input: "test",
      response_format: 'opus',
    });
    console.log("Success");
  } catch (err) {
    console.log("Error:", err.message);
  }
}
run();
