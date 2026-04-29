const fs = require('fs');
const fetchNews = async () => {
    try {
        const url = 'https://news.google.com/rss/articles/CBMixgFBVV95cUxPRDR0N3hjUnU3X3F1V29nUGpXUV91Q1ZDMzNzRktlaDI2alI2cVZKWjRoQmdJRlMxbUtNNUZsQlRxX2Y2SDhvVGNmOW5fX2NMd0lwQU9vUmc5UTkxZWxENzZMQV9pLXZOcTI4MTBMVXVpekNiNTBMYmpvem1tT2p0cURFclppN3JrcEZRb09tTHFRaVZlUG1vYVFfNzRPaGRycmZrNEZMVkpTX201NnV1a3hzbnNaYXVIVDRneWpzb1E5T1N5MFE?oc=5';
        const fetchRes = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        let html = await fetchRes.text();
        fs.writeFileSync('test-news.html', html);
        console.log('done');
    } catch (e) {
        console.error(e);
    }
};
fetchNews();
