const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('outputs/lista-de-chamada/app.js','utf8');const list={innerHTML:''},status={textContent:''};
const ctx=vm.createContext({document:{querySelector:s=>s==='#class-list'?list:s==='#class-search-status'?status:null},Date,structuredClone});
vm.runInContext(source.slice(0,source.indexOf("document.addEventListener('click'")),ctx);
vm.runInContext("state={classes:[{id:'b',name:'FIP 5'},{id:'a',name:'FIP 4'},{id:'c',name:'ImproIniciantes Júlia Set/26'}],students:[],lessons:[]}; classQuery='fip'; renderClasses();",ctx);
assert(list.innerHTML.includes('FIP 4'));assert(list.innerHTML.includes('FIP 5'));assert(!list.innerHTML.includes('Júlia'));assert(list.innerHTML.indexOf('FIP 4')<list.innerHTML.indexOf('FIP 5'));assert.equal(status.textContent,'2 turmas encontradas');
vm.runInContext("classQuery='fip 4';renderClasses();",ctx);assert(list.innerHTML.includes('FIP 4'));assert(!list.innerHTML.includes('FIP 5'));assert(!list.innerHTML.includes('Júlia'));assert.equal((list.innerHTML.match(/class="card class-card"/g)||[]).length,1);assert.equal(status.textContent,'1 turma encontrada');
vm.runInContext("classQuery='  JULIA ';renderClasses();",ctx);assert(list.innerHTML.includes('Júlia'));assert(!list.innerHTML.includes('FIP'));assert.equal(status.textContent,'1 turma encontrada');
vm.runInContext("classQuery='inexistente';renderClasses();",ctx);assert(list.innerHTML.includes('Nenhuma turma encontrada'));assert.equal(status.textContent,'0 turmas encontradas');
assert(vm.runInContext('classOptions()',ctx).includes('FIP 4'));assert.equal(vm.runInContext('state.classes.length',ctx),3);
vm.runInContext("classQuery='';renderClasses();",ctx);assert.equal((list.innerHTML.match(/class="card class-card"/g)||[]).length,3);
console.log('PASS: busca parcial, letras/acentos/espaços, ordem alfabética, nenhum resultado, limpar pesquisa e seleção de aula sem filtro.');

