// Airport order and coordinates from the reviewed prototype data, matched by airport code.
const fs=require("fs");const sb={};new Function("window",fs.readFileSync("src/data.js","utf8"))(sb);
const ALIAS={"washington-d-c":"washington-dc","minneapolis-st-paul-mn":"minneapolis-mn","monaco":"monaco-monaco","black-car-service-zurich-switzerland":"zurich-switzerland","riyadh-saudia-arabia":"riyadh-saudi-arabia","jeddah":"jeddah-saudi-arabia","kuwait-city-kuwait-2":"kuwait-city-kuwait","muscat-oman-2":"muscat-oman"};
const proto={};for(const r of sb.SVC_ROWS){proto[r[4]]=r[8]?r[8].split(";").map(s=>{const p=s.split("|");return {code:p[0],name:p[1],la:p[2]?+p[2]:null,lo:p[3]?+p[3]:null,sl:p[4]||null}}):[]}
const d=JSON.parse(fs.readFileSync("prod/service-areas.json","utf8"));let m=0,pins=0;
for(const x of d){const pa=proto[ALIAS[x.s]||x.s];
 if(pa){m++;const byCode={};pa.forEach((a,i)=>byCode[a.code]=Object.assign({i},a));
  x.a.forEach(a=>{const p=byCode[a.code];if(p){if(p.la!=null){a.la=p.la;a.lo=p.lo}if(p.sl)a.sl=p.sl;a._i=p.i}else a._i=999});
 } else x.a.forEach(a=>a._i=/international|intercontinental/i.test(a.name)?0:999);
 x.a.forEach((a,j)=>a._j=j); x.a.sort((a,b)=>a._i-b._i||a._j-b._j); x.a.forEach(a=>{delete a._i;delete a._j;if(a.la!=null)pins++});}
fs.writeFileSync("prod/service-areas.json",JSON.stringify(d));
console.log("matched",m,"airport pins",pins);
