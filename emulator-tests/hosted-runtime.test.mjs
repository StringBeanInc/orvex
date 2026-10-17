import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateHostedRuntime} from '../functions/hostedRuntime.mjs';
const env={ORVEX_RUNTIME_MODE:'hosted-beta',GCLOUD_PROJECT:'orvex-2f496'};
test('approved runtime requires app attestation',()=>{assert.doesNotThrow(()=>validateHostedRuntime(env,{app:{appId:'beta'}}));assert.throws(()=>validateHostedRuntime(env,{}));});
for(const overrides of [{GCLOUD_PROJECT:'other'},{ORVEX_RUNTIME_MODE:''},{FUNCTIONS_EMULATOR:'true'},{FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'},{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}])test('rejects '+JSON.stringify(overrides),()=>assert.throws(()=>validateHostedRuntime({...env,...overrides},{app:{appId:'beta'}})));
