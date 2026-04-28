const { GoogleAuth } = require('google-auth-library');

async function listModels() {
  try {
    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const client = await auth.getClient();
    const projectId = "alewood-uk-trinity";
    const location = "europe-west2";
    
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models`;

    console.log(`Checking ${url}...`);

    const res = await client.request({
      url,
      method: 'GET'
    });

    console.log("Models:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
    if (err.response) {
      console.error("Details:", err.response.data);
    }
  }
}

listModels();
