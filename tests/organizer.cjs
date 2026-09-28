const {readFileSync}=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,firstChild:{textContent:''},classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this[type]=fn;}});return elements.get(id);}
const group={id:'group-1',name:'ETE 221 OC FL 26',slug:'ete-221-oc-fl-26',kind:'Class'};let writes=[];
const client = {
  from(table) {
    return {
      select() { return this; },
      order() { return Promise.resolve({data:[group]}); },
      insert(data) { writes.push({table,data}); return Promise.resolve({data:[data]}); },
      update(data) {
        writes.push({table,data});
        return { eq() { return { select() { return Promise.resolve({data:[{id:'current'}]}); } }; } };
      }
    };
  },
  storage: { from() { return { upload: async () => ({data:{}}) }; } }
};
const context=vm.createContext({window:{supabase:{createClient:()=>client},scrollTo(){}},document:{querySelector:element,addEventListener(){},body:{style:{}}},location:{search:'?class=ete-221-oc-fl-26'},URLSearchParams,crypto:require('node:crypto').webcrypto,setTimeout(){},console});
vm.runInContext(readFileSync('app.js','utf8'),context);
(async()=>{await new Promise(setImmediate);assert.equal(element('#collectionSelect').value,group.id);
vm.runInContext(`state.submissions=[{id:'old',full_name:'Old',email:'old@example.invalid',files:[],status:'new',collection_id:null,archived_at:'2026-09-28',created_at:'2026-07-09'},{id:'current',full_name:'Current',email:'now@example.invalid',files:[],status:'new',collection_id:'group-1',archived_at:null,created_at:'2026-09-28'}];`,context);
element('#statusFilter').value='all';element('#collectionFilter').value='all';element('#archiveFilter').value='active';vm.runInContext('renderDashboard()',context);assert(element('#submissionList').innerHTML.includes('Current'));assert(!element('#submissionList').innerHTML.includes('old@example.invalid'));
element('#archiveFilter').value='archived';vm.runInContext('renderDashboard()',context);assert(element('#submissionList').innerHTML.includes('Old'));assert.equal(element('#totalSubmissions').textContent,1);
element('#collectionFilter').value=group.id;vm.runInContext('renderDashboard()',context);assert(element('#submissionList').innerHTML.includes('No matching'));
element('#collectionSelect').value=group.id;element('#fullName').value='Student';element('#email').value='test@example.invalid';element('#message').value='Assignment';vm.runInContext(`state.files=[{name:'work.txt',size:12,type:'text/plain'}]`,context);
await element('#uploadForm').submit({preventDefault(){},target:{reset(){}}});assert.equal(writes.at(-1).data.collection_id,group.id);assert.equal(element('#successCollection').textContent,group.name);assert.equal(element('#successView').hidden,false);
const button={dataset:{archiveId:'current'}};await element('#submissionList').click({target:{closest(selector){return selector==='[data-archive-id]'?button:null}}});assert(writes.at(-1).data.archived_at);
console.log('PASS: class link selection, inbox/archive/group filters, upload class and receipt, archive update');})().catch(e=>{console.error(e);process.exitCode=1});
