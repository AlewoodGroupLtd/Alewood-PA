const fs = require('fs');

async function test() {
  try {
    const html = fs.readFileSync('test_news.html', 'utf8');
    const match = html.match(/<c-wiz[^>]*data-p="([^"]+)"/);
    if (!match) throw new Error('No data-p found');
    let dataP = match[1].replace(/&quot;/g, '"');
    
    // StackOverflow says: JSON.parse(dataP.replace('%.@.', '["garturlreq",'))
    // Let's look at the actual string: "%.@.[["en-GB"...
    // If we replace "%.@." with "["garturlreq"," it becomes "["garturlreq", [["en-GB"...]
    const parsedArray = JSON.parse(dataP.replace('%.@.', '["garturlreq",'));
    console.log("Parsed array length:", parsedArray.length);

    const reqPayload = [
      "Fbv4je",
      JSON.stringify([
         "garturlreq",
         [
            parsedArray[1], // "en-GB"
            parsedArray[2], // "GB"
            parsedArray[3], // ["FINANCE_TOP_INDICES"...]
            parsedArray[4],
            parsedArray[5],
            parsedArray[6],
            parsedArray[7],
            parsedArray[8],
            parsedArray[9],
            parsedArray[10],
            parsedArray[11],
            parsedArray[12],
            parsedArray[13],
            parsedArray[14],
            parsedArray[15],
            parsedArray[16],
            parsedArray[17],
            parsedArray[18],
            parsedArray[19],
            parsedArray[20],
            parsedArray[21],
            parsedArray[22],
            parsedArray[23],
            parsedArray[24],
            parsedArray[25],
            parsedArray[26]
         ],
         parsedArray[27], // "CBMi..."
         parsedArray[28],
         parsedArray[29],
         parsedArray[30],
         parsedArray[31],
         parsedArray[32],
         parsedArray[33] // "AaLI4..."
      ]),
      null,
      "generic"
    ];

    // the stackoverflow article said: JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)])
    // Let's just use what they said exactly
    const obj = JSON.parse(dataP.replace('%.@.', '["garturlreq",'));
    const payload = {
      'f.req': JSON.stringify([[
        ['Fbv4je', JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]), null, 'generic']
      ]])
    };

    console.log("Payload:", payload);

    const postResponse = await fetch(
      'https://news.google.com/_/DotsSplashUi/data/batchexecute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
        },
        body: new URLSearchParams(payload).toString()
      }
    );

    const responseText = await postResponse.text();
    console.log("Response text length:", responseText.length);
    // Parse the response to extract the final URL
    // It comes back like: )]}'\n\n[["wrb.fr","Fbv4je","[\"url\",\"https://www.theguardian.com/...\"]"...
    const arrayString = JSON.parse(responseText.replace(")]}'", ""))[0][2];
    const finalUrl = JSON.parse(arrayString)[1];
    
    console.log('Final URL:', finalUrl);
  } catch (e) {
    console.error(e);
  }
}

test();
