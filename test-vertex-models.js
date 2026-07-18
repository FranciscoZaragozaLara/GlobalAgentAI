const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: 'D:/Arcadevs/GlobalDMS/GlobalAgentAI/.env' });

async function run() {
  const projectId = 'ai-agent-501320';
  const credentialsPath = 'D:/Arcadevs/GlobalDMS/GlobalAgentAI/ai-agent-501320-e302eb4aa510.json';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

  console.log('Initializing Vertex AI client with global region...');
  const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: 'global' });
  
  try {
    console.log('Testing general text generation with gemini-2.5-flash...');
    const flashRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello, respond with OK.',
    });
    console.log('gemini-2.5-flash Success! Response:', flashRes.text);
  } catch (err) {
    console.error('gemini-2.5-flash Failed:', err.message);
  }

  try {
    console.log('Testing general text generation with gemini-3.5-flash...');
    const flashRes = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Hello, respond with OK.',
    });
    console.log('gemini-3.5-flash Success! Response:', flashRes.text);
  } catch (err) {
    console.error('gemini-3.5-flash Failed:', err.message);
  }

  try {
    console.log('Testing general text generation with gemini-3.1-pro-preview...');
    const proRes = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: 'Hello, respond with OK.',
    });
    console.log('gemini-3.1-pro-preview Success! Response:', proRes.text);
  } catch (err) {
    console.error('gemini-3.1-pro-preview Failed:', err.message);
  }

  try {
    console.log('Testing general text generation with gemini-2.5-pro...');
    const proRes = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: 'Hello, respond with OK.',
    });
    console.log('gemini-2.5-pro Success! Response:', proRes.text);
  } catch (err) {
    console.error('gemini-2.5-pro Failed:', err.message);
  }
}
run();
