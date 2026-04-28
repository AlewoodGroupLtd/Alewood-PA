const { GoogleGenAI } = require("@google/genai");

async function testGemini() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY" });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Say hello world'
        });
        console.log(response.text);
    } catch (e) {
        console.error(e.message);
    }
}
testGemini();
