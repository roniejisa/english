import {curriculum,nodes,emptyProgress} from './engine';
import type {Progress} from './types';
export function validProgress(v:unknown):v is Progress{
 if(!v||typeof v!=='object')return false;const p=v as Progress;
 if(typeof p.name!=='string'||p.name.length>35||![5,10,15,30].includes(p.dailyGoal)||!Array.isArray(p.attempts)||!Array.isArray(p.reviews)||!p.studySeconds||typeof p.studySeconds!=='object')return false;
 if(p.attempts.some(a=>!a||typeof a.id!=='string'||!nodes.some(n=>n.id===a.nodeId)||!Number.isInteger(a.score)||a.score<0||a.score>100||!Number.isFinite(new Date(a.date).getTime())||!a.answers||typeof a.answers!=='object'||Object.values(a.answers).some(x=>typeof x!=='string')||!['local','cloud'].includes(a.source)))return false;
 if(p.reviews.some(r=>!r||!curriculum.vocabulary.some(w=>w.id===r.wordId)||!Number.isFinite(new Date(r.due).getTime())||!Number.isInteger(r.interval)||r.interval<0||!Number.isFinite(r.ease)||r.ease<1.3||r.ease>5||!Number.isInteger(r.repetitions)||r.repetitions<0))return false;
 if(Object.entries(p.studySeconds).some(([day,n])=>!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(n)||n<0||n>86400))return false;
 return true;
}
export function restoreProgress(v:unknown):Progress{return validProgress(v)?v:emptyProgress();}
