const { GoogleGenAI } = require('@google/genai');

const project = "alewood-uk-trinity";
const location = "europe-west2";

async function main() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY" });
        
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: 'Say hello world'
        });

        console.log(response.text);
    } catch (e) {
        console.error(e);
    }
}

main();
