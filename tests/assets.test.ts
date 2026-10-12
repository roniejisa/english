import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync,readFileSync} from 'node:fs';
import {curriculum} from '../src/lib/engine';
import ipa from '../src/data/ipa.json';
test('Every vocabulary, lesson, reader, IPA and dialogue audio has bundled non-empty files',()=>{const files=[...curriculum.vocabulary.map(w=>w.audio),...curriculum.lessons.map(l=>l.audio),...curriculum.readers.map(r=>r.audio),...ipa.map(s=>`/audio/ipa-${s.id}.mp3`),...Array.from({length:3},(_,i)=>[`/audio/role-a-${i}.mp3`,`/audio/role-b-${i}.mp3`]).flat()];for(const file of files){assert.ok(existsSync('public'+file),file);assert.ok(statSync('public'+file).size>800,file);}assert.equal(ipa.length,41);});
test('Reader timings map every word and run monotonically with real duration',()=>{for(const r of curriculum.readers){assert.equal(r.timings.length,r.text.split(' ').length,r.id);for(let i=0;i<r.timings.length;i++){const t=r.timings[i];assert.equal(t.text,r.text.split(' ')[i]);assert.ok(t.end>t.start,`${r.id} ${t.text}`);if(i)assert.ok(t.start>=r.timings[i-1].start,`${r.id} ${t.text}`);}}});
test('Every word in each reader has an immediate contextual glossary meaning',()=>{const glossary=JSON.parse(readFileSync('src/data/glossary.json','utf8'));for(const r of curriculum.readers){for(const word of r.text.split(' ')){const key=word.toLowerCase().replace(/[^a-z'-]/g,'');assert.ok(glossary[key],`${r.id}: ${key}`);}}});
