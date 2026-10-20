let input = ['ipv4 2 tcp 6 src=192.168.19.243 dst=203.0.113.10 sport=8188 dport=8080 packets=31 bytes=4764 src=203.0.113.10 dst=192.168.16.128 sport=8080 dport=8188 packets=31 bytes=37045 [HW_OFFLOAD] zone=0'];
let db_enabled = false;
let station_text = 'Station 02:00:00:00:00:01 (on phy0-sta0)\n rx bytes: 1000000\n tx bytes: 2000000\n connected time: 100 seconds\n', station_status = 0;
const fs = {
 stderr:{write:s=>null,flush:()=>null}, error:()=>null,
 readfile:p=>'0 00:11:22:33:44:55 192.168.19.243 Test-client *',
 stat:p=>db_enabled ? {} : null,
 open:(p,m)=>{let i=0; return {read:n=>input[i++], close:()=>true};},
 popen:(c,m)=>({read:n=>index(c,'iw dev ') == 0 ? station_text : '"SG" <utf8_string>',close:()=>index(c,'iw dev ') == 0 ? station_status : 0})
};
let reads = [], socket_error = 11, socket_closes = 0, receive_calls = 0;
const test_socket = {recv:(n,f)=>{receive_calls++;return shift(reads);},close:()=>{socket_closes++;}};
const socket = {connect:p=>null,MSG_DONTWAIT:64,error:n=>socket_error};
let timers = [];
const uloop = {init:()=>null,done:()=>null,end:()=>null,run:()=>null,
 timer:(ms,cb)=>{let timer;timer={delay:ms,callback:cb,set:n=>{timer.delay=n;return true;}};push(timers,timer);return timer;},
 signal:(n,cb)=>null};
const ubus = {connect:()=>({call:(o,m,a)=>({interface:[]}),publish:(n,m)=>({methods:m})})};
function cursor() {return {get_all:(p,s)=>({subnet:['192.168.19.0/24']}),foreach:(p,t,cb)=>null};}
