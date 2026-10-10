const net=require('node:net'),fs=require('node:fs'),path=require('node:path');
const reservations=path.join(__dirname,'port-reservations');fs.mkdirSync(reservations,{recursive:true});
const log=(value)=>fs.appendFileSync(path.join(__dirname,'network-bindings.jsonl'),JSON.stringify({pid:process.pid,time:new Date().toISOString(),...value})+'\n');
const listen=net.Server.prototype.listen;
net.Server.prototype.listen=function(...args){
 let opts=typeof args[0]==='object'?{...args[0]}:typeof args[0]==='number'?{port:args[0],host:typeof args[1]==='string'?args[1]:'127.0.0.1'}:null;
 if(!opts)throw Error('checker refuses nonTCP listen');opts.host??='127.0.0.1';
 if(opts.host!=='127.0.0.1')throw Error('checker refuses listen host '+opts.host);
 let reservation;
 if(opts.port===0){for(let p=49720;p<=49739;p++){const f=path.join(reservations,String(p));try{fs.writeFileSync(f,String(process.pid),{flag:'wx'});reservation=f;opts.port=p;break}catch(e){if(e.code!=='EEXIST')throw e}}if(!reservation)throw Error('checker exhausted ports')}
 if(!Number.isInteger(opts.port)||opts.port<49720||opts.port>49739)throw Error('checker refuses listen port '+opts.port);
 const release=()=>{if(reservation){fs.unlinkSync(reservation);reservation=undefined}};this.once('close',release);this.once('error',release);this.once('listening',()=>log({bind:this.address()}));
 const cb=args.find(x=>typeof x==='function');return listen.call(this,opts,...(cb?[cb]:[]));
};
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){const a=Array.isArray(args[0])?args[0][0]:args[0];const host=typeof a==='object'?a.host:typeof args[1]==='string'?args[1]:'127.0.0.1';const port=typeof a==='object'?a.port:a;
 if(host&&!['localhost','127.0.0.1','::1'].includes(host))throw Error('checker refuses external connect '+host);
 if(!Number.isInteger(Number(port))||Number(port)<49720||Number(port)>49739)throw Error('checker refuses connect port '+port);
 return connect.apply(this,args);
};
const dgram=require('node:dgram');dgram.createSocket=()=>{throw Error('checker refuses UDP')};
const dns=require('node:dns');for(const key of ['lookup','resolve','resolve4','resolve6']){const original=dns[key];dns[key]=function(host,...args){if(!['localhost','127.0.0.1','::1'].includes(host))throw Error('checker refuses DNS '+host);return original.call(this,host,...args)}}
