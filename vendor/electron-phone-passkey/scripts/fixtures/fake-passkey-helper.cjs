#!/usr/bin/env node
let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>{
 const r=JSON.parse(data);
 const client={type:'webauthn.get',challenge:r.publicKey.challenge,origin:r.origin,crossOrigin:!!r.topOrigin};if(r.topOrigin)client.topOrigin=r.topOrigin;
 console.log(JSON.stringify({type:'result',credential:{id:'AQID',rawId:'AQID',type:'public-key',authenticatorAttachment:'cross-platform',clientExtensionResults:{},response:{clientDataJSON:Buffer.from(JSON.stringify(client)).toString('base64url'),authenticatorData:Buffer.alloc(37).toString('base64url'),signature:'AQID',userHandle:null}}}));
});
