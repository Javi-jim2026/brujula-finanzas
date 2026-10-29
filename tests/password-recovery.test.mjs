import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hasRecoveryIntent,validNewPassword,PASSWORD_RECOVERY_RETURN_URL} from '../password-recovery.mjs';

test('El enlace oficial de recuperación apunta a Brújula, nunca localhost',()=>{
 assert.equal(PASSWORD_RECOVERY_RETURN_URL,'https://javi-jim2026.github.io/brujula-finanzas/');
 assert.ok(!PASSWORD_RECOVERY_RETURN_URL.includes('localhost'));
});
test('Distingue enlaces de recuperación de otros inicios de sesión',()=>{
 const url='https://javi-jim2026.github.io/brujula-finanzas/';
 assert.equal(hasRecoveryIntent(url),false);
 assert.equal(hasRecoveryIntent(url+'#access_token=ficticio&type=recovery'),true);
 assert.equal(hasRecoveryIntent(url+'?type=recovery'),true);
 assert.equal(hasRecoveryIntent(url+'?recovery=1'),true);
 assert.equal(hasRecoveryIntent(url+'#type=signup'),false);
});
test('Rechaza contraseñas débiles, mal confirmadas o excesivas',()=>{
 assert.match(validNewPassword('1234567','1234567'),/ocho/);
 assert.match(validNewPassword('contraseñaNueva123','otraClave123'),/no coinciden/);
 assert.match(validNewPassword('a'.repeat(73),'a'.repeat(73)),/72/);
 assert.equal(validNewPassword('UnaClaveUnica2026','UnaClaveUnica2026'),'');
});
test('El flujo se integra en Brújula sin credenciales ni modificadores de datos',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const worker=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const id of ['forgot-password','recovery-request-form','recovery-update-form','recovery-new-password','recovery-repeat-password','recovery-error-panel'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(js.includes("passwordRecovery.bindClient(sb)"));
 assert.ok(js.includes("passwordRecovery.handleInitialSession(session)"));
 assert.ok(js.includes("passwordRecovery.setup();"));
 assert.ok(worker.includes("'./password-recovery.mjs'"));
 assert.ok(worker.includes("'password-recovery.mjs'"));
});
test('Cambio de contraseña requiere recuperación validada y no altera tablas financieras',()=>{
 const code=fs.readFileSync(new URL('../password-recovery.mjs',import.meta.url),'utf8');
 assert.match(code,/event==='PASSWORD_RECOVERY'&&session/);
 assert.match(code,/if\(!sb\|\|!recoveryVerified\)/);
 assert.match(code,/sb\.auth\.updateUser\(\{password:pass\}\)/);
 assert.match(code,/sb\.auth\.signOut\(\{scope:'local'\}\)/);
 assert.match(code,/sb\.auth\.resetPasswordForEmail\(email,\{redirectTo:PASSWORD_RECOVERY_RETURN_URL\}\)/);
 assert.ok(!code.includes('sb.from('));
 assert.ok(!code.includes('service_role'));
});
