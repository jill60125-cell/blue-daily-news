const FEEDS = {
  '台灣':'https://feeds.feedburner.com/rsscna/politics',
  '國際':'https://feeds.feedburner.com/rsscna/intworld',
  '財經':'https://feeds.feedburner.com/rsscna/finance',
  '科技':'https://feeds.feedburner.com/rsscna/technology',
  '生活':'https://feeds.feedburner.com/rsscna/lifehealth',
  '娛樂':'https://feeds.feedburner.com/rsscna/stars'
};
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([a-f0-9]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const tag = (xml,name) => { const m=xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));return m?decode(m[1]).trim():'';};
const strip = s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const safeUrl = s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}};
async function getFeed(category,url){
  const res=await fetch(url,{headers:{'User-Agent':'BlueDailyRSSReader/1.0','Accept':'application/rss+xml, application/xml, text/xml, */*'}});
  if(!res.ok)throw Error('HTTP '+res.status);
  const xml=await res.text();if(xml.length>2000000)throw Error('Feed too large');
  const blocks=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,24);
  return blocks.map(([,b])=>({title:strip(tag(b,'title')),url:safeUrl(tag(b,'link')),date:tag(b,'pubDate'),summary:strip(tag(b,'description')).slice(0,190),category,source:'中央通訊社'})).filter(x=>x.title&&x.url);
}
async function news(){const out=await Promise.allSettled(Object.entries(FEEDS).map(([k,v])=>getFeed(k,v)));let items=out.flatMap(x=>x.status==='fulfilled'?x.value:[]);const seen=new Set();items=items.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0)).slice(0,100);return {items,updatedAt:new Date().toISOString(),sources:[{name:'中央通訊社',url:'https://www.cna.com.tw/about/rss.aspx'}],errors:out.filter(x=>x.status==='rejected').length};}
export default {async fetch(request){const url=new URL(request.url);const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300'};if(request.method==='OPTIONS')return new Response(null,{headers});if(url.pathname!=='/api/news')return new Response(JSON.stringify({message:'Blue Daily API',endpoint:'/api/news'}),{headers});try{const cache=await caches.open('blue-daily-v1');const key=new Request(url.origin+'/api/news');let hit=await cache.match(key);if(hit)return hit;const payload=await news();if(!payload.items.length)return new Response(JSON.stringify({error:'目前無法取得新聞來源，請稍後再試',updatedAt:payload.updatedAt,items:[]}),{status:503,headers:{...headers,'Cache-Control':'no-store'}});const resp=new Response(JSON.stringify(payload),{headers});await cache.put(key,resp.clone());return resp;}catch(e){return new Response(JSON.stringify({error:'新聞來源讀取失敗',items:[]}),{status:502,headers:{...headers,'Cache-Control':'no-store'}})}}};
