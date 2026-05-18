const updates = [
  { headline: "Woman gets water company letter telling her she's dead and owes them £60 - The Mirror", url: "https://news.google.com/rss/articles/CBMikwFBVV95cUxPRVR4RmpJOUYtWlN3Wk9pZjRzM3p5N0U2ZDFsMUp0eHp4V3l0RklyNnhrS0EwU2I2MWF3Q2hKVkl0c29aR0lYcDF2Y1lWaVlhVnpOVzF6Y1h1WXVwaGR4R0pIdWlfd3Q5R1I3MjFqVzNzcG9NNDBNNDBNNDBNNDBNNDBNNDBNNDBNNDBNNDBNNDBNNA?oc=5" },
  { headline: "Woman gets water company letter telling her she's dead and owes them £60 - The Mirror", url: "https://news.google.com/rss/articles/CBMikwFBVV95cUxPRVR4RmpJOUYtWlN3Wk9pZjRzM3p5N0U2ZDFsMUp0eHp4V3l0RklyNnhrS0EwU2I2MWF3Q2hKVkl0c29aR0lYcDF2Y1lWaVlhVnpOVzF6Y1h1WXVwaGR4R0pIdWlfd3Q5R1I3MjFqVzNzcG9NNDBNNDBNNDBNNDBNNDBNNDBNNDBNNDBNNDBNNDBNNA?oc=5" }
];

const prevUpdates = [
  { headline: "Woman gets water company letter telling her she's dead and owes them £60 - The Mirror", url: "https://news.google.com/rss/articles/different" }
];

const merged = [...updates, ...prevUpdates];
const seen = new Set();
const uniqueUpdates = merged.filter((u) => {
   const cleanHeadline = String(u.headline || '').replace(/<[^>]+>/g, '').trim().toLowerCase();
   const baseUrl = String(u.url || '').split('?')[0].trim().toLowerCase();
   const keyHeadline = String(u.headline || '').trim().toLowerCase();
   const keyUrl = String(u.url || '').trim().toLowerCase();
   
   if ((baseUrl && seen.has(baseUrl)) || (cleanHeadline && seen.has(cleanHeadline))) {
     return false;
   }
   if (baseUrl) seen.add(baseUrl);
   if (keyUrl) seen.add(keyUrl);
   if (cleanHeadline) seen.add(cleanHeadline);
   if (keyHeadline) seen.add(keyHeadline);
   return true;
});

console.log(uniqueUpdates.length);
