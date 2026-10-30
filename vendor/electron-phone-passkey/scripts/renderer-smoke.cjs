// This script is launched by Electron, so require('electron') resolves its API.
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root=__dirname;
const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'phone-passkey-smoke-'));
app.setPath('userData', profile);
app.whenReady().then(async()=>{
  const {createPhonePasskeySupport}=require('..');
  const helper=path.join(root,'fixtures/fake-passkey-helper.cjs');
  fs.chmodSync(helper,0o755);
  const support=createPhonePasskeySupport({electron:require('electron'),helperPath:helper});
  const handler=request=>{
    const url=new URL(request.url);
    const top=url.hostname==='login.microsoftonline.com';
    return new Response(`<!doctype html><html><body>${top?'<iframe src="https://login.microsoft.com/frame" allow="publickey-credentials-get"></iframe>':''}<script>
      window.result='pending';
      navigator.credentials.get({publicKey:{challenge:new Uint8Array([1,2,3]),rpId:${JSON.stringify(url.hostname)},userVerification:'required',timeout:5000}}).then(c=>{
        window.result={id:c.id,credential:c instanceof PublicKeyCredential,response:c.response instanceof AuthenticatorAssertionResponse,origin:JSON.parse(new TextDecoder().decode(c.response.clientDataJSON)).origin,extensions:c.getClientExtensionResults(),json:c.toJSON()};
      }).catch(e=>window.result={error:e.name,message:e.message});
    </script></body></html>`,{headers:{'content-type':'text/html','Permissions-Policy':'publickey-credentials-get=(self "https://login.microsoft.com")'}});
  };
  const windows=[true,false].map(contextIsolation=>{
    const isolatedSession=session.fromPartition('passkey-smoke-'+contextIsolation);
    isolatedSession.protocol.handle('https',handler);
    const win=new BrowserWindow({show:false,webPreferences:{session:isolatedSession,contextIsolation,sandbox:contextIsolation,nodeIntegration:false,nodeIntegrationInSubFrames:true}});
    support.attach(win.webContents);return win;
  });
  await Promise.all(windows.map(w=>w.loadURL('https://login.microsoftonline.com/probe')));
  await new Promise(r=>setTimeout(r,2000));
  for(const w of windows){
    const main=await w.webContents.executeJavaScript('window.result');
    console.log('main mode',w.webContents.getLastWebPreferences().contextIsolation,'credential',main.credential,'response',main.response);
    assert.equal(main.credential,true);assert.equal(main.response,true);assert.equal(main.origin,'https://login.microsoftonline.com');
    const frames=w.webContents.mainFrame.frames;
    assert.equal(frames.length,1);
    const child=await frames[0].executeJavaScript('window.result');
    const exposure=await frames[0].executeJavaScript('({bridge:typeof window.phonePasskey,requireType:typeof require,processType:typeof process})');console.log('iframe bridge',exposure);assert.equal(exposure.requireType,'undefined');assert.equal(exposure.processType,'undefined');
    assert.equal(child.credential,true);assert.equal(child.origin,'https://login.microsoft.com');
    assert.equal(JSON.parse(Buffer.from(child.json.response.clientDataJSON,'base64url')).topOrigin,'https://login.microsoftonline.com');
  }
  support.dispose();for(const w of windows)w.destroy();
  console.log('PASS: isolated and non-isolated main frames and iframes.');finish(0);
}).catch(e=>{console.error(e);finish(1)});
const deadline = setTimeout(()=>{console.error('Smoke test timed out');finish(1)},15000);

function finish(code) {
  clearTimeout(deadline);
  for (const win of BrowserWindow.getAllWindows()) win.destroy();
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(code);
}
