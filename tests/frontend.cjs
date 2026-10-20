const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
const {html}=require('./preview.cjs');
const {chromium}=require(process.argv[2]||'playwright');
(async()=>{
    const outputDir=path.resolve(__dirname,'../test-output');
    fs.mkdirSync(outputDir,{recursive:true});
    const output=path.join(outputDir,'preview.html');
    fs.writeFileSync(output,html());
    const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{})});
    try{
        const page=await browser.newPage({viewport:{width:1280,height:1050},deviceScaleFactor:1});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(pathToFileURL(output).href);
        await page.locator('.oo-donut').waitFor();
        assert.equal(await page.locator('.oo-app-table tbody tr').count(),8);
        assert.equal(await page.locator('.oo-client-table tbody tr').count(),3);
        assert.equal(await page.locator('.oo-plot polyline').count(),2);
        assert.equal(await page.locator('.oo-country-row').count(),7);
        assert((await page.locator('.oo-country-legend').innerText()).includes('Singapore'));
        assert((await page.locator('.oo-badges').innerText()).includes('82.4%'));
        const originalRate=await page.evaluate(()=>fixture.rates.down);
        await page.evaluate(()=>{fixture.rates.down=125000;controller.update(fixture);});
        assert.equal(await page.locator('.oo-metric strong').first().innerText(),'1.00 Mbps');
        assert((await page.locator('.oo-metric strong').nth(2).innerText()).includes('MiB'));
        assert((await page.locator('.oo-app-table').innerText()).includes('Kbps'));
        assert((await page.locator('.oo-client-table').innerText()).includes('Kbps'));
        assert((await page.locator('.oo-plot').textContent()).includes('Mbps'));
        for(const [input,expected] of [[0,'0 bps'],[1,'8 bps'],[125,'1.00 Kbps'],[125000000,'1.00 Gbps'],[125000000000,'1.00 Tbps']]){
            await page.evaluate(value=>{fixture.rates.down=value;controller.update(fixture);},input);
            assert.equal(await page.locator('.oo-metric strong').first().innerText(),expected);
        }
        await page.evaluate(value=>{fixture.rates.down=value;controller.update(fixture);},originalRate);
        await page.evaluate(()=>{
            fixture.measurement={source:'wifi_station',interface:'phy0-sta0',valid:true};
            fixture.breakdowns_verified=false;controller.update(fixture);
        });
        assert((await page.locator('.oo-panel-head').allTextContents()).some(text=>text.includes('Wi-Fi uplink throughput')));
        assert.equal(await page.locator('.oo-note').filter({hasText:'Unverified usage estimates'}).count(),3);
        assert((await page.locator('.oo-alerts').innerText()).includes('separate connection counters'));
        assert.equal(await page.evaluate(()=>controller.history.length),1);
        const validHistory=await page.evaluate(()=>controller.history.length);
        await page.evaluate(()=>{
            fixture.sampled_at+=5;
            fixture.measurement.valid=false;fixture.measurement.error='Wi-Fi station counters unavailable';
            fixture.rates={up:null,down:null};controller.update(fixture);
        });
        assert.equal(await page.locator('.oo-metric strong').first().innerText(),'Unavailable');
        assert((await page.locator('.oo-chart-legend').innerText()).includes('Unavailable'));
        assert((await page.locator('.oo-alerts').innerText()).includes('Wi-Fi station counters unavailable'));
        assert.equal(await page.evaluate(()=>controller.history.length),validHistory);
        await page.evaluate(value=>{
            delete fixture.measurement;delete fixture.breakdowns_verified;
            fixture.rates={up:10020,down:value};controller.update(fixture);
        },originalRate);
        await page.locator('.oo-more').click();
        assert.equal(await page.locator('.oo-app-table tbody tr').count(),10);
        const search=page.getByRole('searchbox',{name:'Filter by application or service'});
        await search.fill('github');
        assert.equal(await page.locator('.oo-app-table tbody tr').count(),1);
        assert((await page.locator('.oo-app-table tbody').innerText()).includes('GitHub'));
        await page.evaluate(()=>{fixture.sampled_at+=5;controller.update(fixture);});
        assert.equal(await search.inputValue(),'github');
        assert.equal(await search.evaluate(n=>document.activeElement===n),true);
        await search.fill('-unknown');
        assert(!(await page.locator('.oo-app-table tbody').innerText()).includes('No matching label'));
        await search.fill('does-not-exist');
        assert((await page.locator('.oo-app-table tbody').innerText()).includes('No matching applications'));
        await search.fill('');
        const clientSearch=page.getByRole('searchbox',{name:'Filter by device name or IP address'});
        await clientSearch.fill('192.168.19.104');
        assert.equal(await page.locator('.oo-client-table tbody tr').count(),1);
        assert((await page.locator('.oo-client-table tbody').innerText()).includes('Living-room TV'));
        await clientSearch.fill('');
        await page.evaluate(()=>{
            fixture.clients[0].label='<img src=x onerror=alert(1)>';
            controller.update(fixture);
        });
        assert.equal(await page.locator('.oo-client-table img').count(),0);
        assert((await page.locator('.oo-client-table').innerText()).includes('<img src=x'));
        await page.evaluate(()=>{fixture.clients[0].label='Laptop';controller.update(fixture);});
        const countBefore=await page.evaluate(()=>controller.history.length);
        await page.evaluate(()=>controller.update(fixture));
        assert.equal(await page.evaluate(()=>controller.history.length),countBefore);
        await page.evaluate(()=>controller.update({}));
        assert((await page.locator('.oo-alerts').innerText()).includes('last received data'));
        await page.evaluate(()=>{fixture.started_at+=1;controller.update(fixture);});
        assert.equal(await page.evaluate(()=>controller.history.length),1);
        await page.evaluate(()=>{
            const end=Math.floor(Date.now()/1000);
            fixture.started_at=end-3266;
            controller.history=[];
            controller.origin=fixture.started_at;
            for(let i=0;i<=60;i++){
                fixture.sampled_at=end-300+i*5;
                fixture.rates={down:Math.max(0,11000+6500*Math.sin(i*.19)+i*47),up:Math.max(0,6000+3500*Math.sin(i*.19-.5))};
                controller.update(fixture);
            }
            controller.showAllApps=false;controller.drawApps();
        });
        assert.equal(await page.evaluate(()=>controller.history.length),61);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
        await page.screenshot({path:path.join(outputDir,'desktop.png'),fullPage:true});
        await page.evaluate(()=>{
            fixture.measurement={source:'wifi_station',interface:'phy0-sta0',valid:true};
            fixture.breakdowns_verified=false;controller.update(fixture);
        });
        await page.screenshot({path:path.join(outputDir,'wifi.png'),fullPage:true});
        await page.setViewportSize({width:390,height:844});
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
        assert((await page.locator('.oo-plot svg').getAttribute('viewBox')).startsWith('0 0 330'));
        await page.screenshot({path:path.join(outputDir,'mobile.png'),fullPage:true});
        for(const filename of [
            path.join(__dirname,'../root/www/luci-static/resources/view/offload_observer/index.js'),
            path.join(__dirname,'../dashboard/90_offload_observer.js')])new Function(fs.readFileSync(filename,'utf8'));
        assert.deepEqual(errors,[]);
        console.log('PASS: browser rendering, charts, filters, polling focus, safe labels, history restart, desktop/mobile layout and view syntax');
    }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
