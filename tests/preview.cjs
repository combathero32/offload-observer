// Generate a standalone preview from the shipped UI, not a separate mock layout.
const fs=require('fs'),path=require('path');
function sample(now=Math.floor(Date.now()/1000)){
    const names=['Unknown','netify.fastly','netify.microsoft-authentication','netify.github','netify.discord','netify.office-365','netify.facebook','netify.spotify','netify.google-play','netify.akamai'];
    const apps=names.map((name,i)=>({name,label:name,down:(10-i)*180000,up:(10-i)*40000,down_bps:Math.max(0,6600-i*650),up_bps:Math.max(0,3000-i*280)}));
    const clients=[
        {name:'192.168.19.243',label:'Laptop',down:23960000,up:13540000,down_bps:15020,up_bps:8800},
        {name:'192.168.19.104',label:'Living-room TV',down:4800000,up:280000,down_bps:1870,up_bps:310},
        {name:'192.168.19.80',label:'Phone',down:2200000,up:460000,down_bps:750,up_bps:190}
    ];
    const total={down:30960000,up:14280000};
    const countries=[['US',.474],['SG',.278],['Unknown',.107],['JP',.073],['Local/private',.028],['DE',.027],['AU',.013]]
        .map(([name,p])=>({name,label:name,down:total.down*p,up:total.up*p,down_bps:0,up_bps:0}));
    return {started_at:now-3266,sampled_at:now,total,rates:{down:16900,up:10020},applications:apps,clients,countries,application_coverage:82.4,
        health:{netify_connected:true,netify_last_event:now,country_database:true,hw_flows:19,active_flows:116,networks:['192.168.19.0/24']}};
}
function html(){
    const root=path.join(__dirname,'../root/www/luci-static/resources/offload_observer');
    const css=fs.readFileSync(path.join(root,'observer.css'),'utf8');
    const source=fs.readFileSync(path.join(root,'ui.js'),'utf8');
    const encoded=JSON.stringify(source).replace(/</g,'\\u003c');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offload Observer preview</title>'+
        '<style>body{margin:0;background:#1b2127;padding:18px;} .preview-label{max-width:1500px;margin:0 auto 12px;color:#94a7be;font:12px system-ui,sans-serif}</style>'+
        '<style id="offload-observer-style">'+css+'</style></head><body>'+
        '<div class="preview-label">VISUAL PREVIEW · Sample data</div><script>'+
        'window.E=function(tag,attrs,children){const n=document.createElement(tag);Object.entries(attrs||{}).forEach(function(pair){n.setAttribute(pair[0],pair[1]);});(children||[]).forEach(function(c){n.appendChild(typeof c==="string"?document.createTextNode(c):c);});return n;};'+
        'window.L={resource:function(p){return p;}};window.observerUI=new Function("baseclass",'+encoded+')({extend:function(x){return x;}});'+
        'window.controller=observerUI.create();document.body.appendChild(controller.root);'+
        'window.fixture='+JSON.stringify(sample())+';'+
        'const now=Math.floor(Date.now()/1000);fixture.started_at=now-3266;fixture.health.netify_last_event=now;'+
        'for(let i=0;i<=60;i++){fixture.sampled_at=now-300+i*5;fixture.rates={down:Math.max(0,11000+6500*Math.sin(i*.19)+i*47),up:Math.max(0,6000+3500*Math.sin(i*.19-.5))};controller.update(fixture);}'+
        '</script></body></html>';
}
module.exports={html,sample};
if(require.main===module){fs.writeFileSync(process.argv[2],html());console.log('Standalone preview written.');}
