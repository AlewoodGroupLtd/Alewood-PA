const { OpenAI } = require("openai");

async function main() {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "YOUR_OPENAI_API_KEY"
        });
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "user", content: 'Say hello world' }
            ]
        });

        console.log(completion.choices[0].message.content);
    } catch (e) {
        console.error(e);
    }
}

main();
