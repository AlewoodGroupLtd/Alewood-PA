const url = 'https://news.google.com/rss/articles/CBMinwFBVV95cUxQeDl0TTFJdjh3Xy1KcHZ2ZHBlWGVpUnEtQ1lRMmVzX04tUS1qQzNneDBoYkFfeF9GLVlPSGJON1pxNlFqelRLVVVDdU0wOUd6QmVIdk1sdnlWcmJDb010QXhmWDhseHpXSjhYcUptSklKOE1DSEIxVEdSVUtIREJ1LXZlb1JfbUpwS3pBUmZWT3pKV21HTzM2SFlhUWs3RkU?oc=5';
fetch(url).then(async r => {
  let html = await r.text();
  const cwizMatch = html.match(/<c-wiz[^>]*data-p="([^"]+)"/);
  if (cwizMatch) {
    console.log('c-wiz match found');
    const dataP = cwizMatch[1].replace(/&quot;/g, '"');
    try {
      const obj = JSON.parse(dataP.replace('%.@.', '["garturlreq",'));
      const payload = {
        'f.req': JSON.stringify([[['Fbv4je', JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]), null, 'generic']]])
      };
      const postResponse = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: new URLSearchParams(payload).toString()
      });
      const responseText = await postResponse.text();
      console.log('batchexecute response start:', responseText.substring(0, 100));
      const arrayString = JSON.parse(responseText.replace(")]}'", ""))[0][2];
      console.log('arrayString:', arrayString);
      const finalUrl = JSON.parse(arrayString)[1];
      console.log('finalUrl:', finalUrl);
    } catch(e) { console.error('Parse error:', e) }
  } else { console.log('no match'); }
});
