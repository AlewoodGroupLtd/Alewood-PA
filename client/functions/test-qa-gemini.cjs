const { GoogleGenAI } = require("@google/genai");

async function testGemini() {
    try {
        const ai = new GoogleGenAI({ vertexai: { project: "alewood-uk-trinity", location: "us-central1" } });
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
