'use strict';
const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'});
const uid = () => crypto.randomUUID();
let state = {classes:[],students:[],lessons:[]};
let lesson = null;
let dirty = false;
let busy = false;
let toastTimer;
let storage;
let historyDate = '';
let classQuery = '';
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4500); }
function confirmAction(message) { return new Promise(resolve => { const dialog = $('#confirm-dialog'); $('#confirm-message').textContent = message; dialog.returnValue = 'cancel'; dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {once:true}); dialog.showModal(); }); }
async function commit(next) { if (busy) return false; busy = true; try { await storage.save(next); state = next; return true; } catch(error) { toast(error.message || 'Não foi possível salvar. Tente novamente.'); return false; } finally { busy = false; } }
function sortedClasses() { return [...state.classes].sort((a,b)=>a.name.trim().localeCompare(b.name.trim(),'pt-BR',{sensitivity:'base',numeric:true})); }
function normalizeSearch(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim(); }
function setupClassSearch() {
  if($('#class-search'))return;
  const panel=document.createElement('div');panel.className='card';panel.style.marginTop='24px';
  panel.innerHTML='<form id="class-search-form" class="form-row"><label>Pesquisar turma<input id="class-search" type="search" placeholder="Digite o nome da turma" autocomplete="off" aria-controls="class-list"></label><button id="clear-class-search" type="button" class="button secondary">Ver todas as turmas</button></form><p id="class-search-status" role="status" aria-live="polite" style="margin-top:16px;font-size:.875rem"></p>';
  $('#class-list').before(panel);
  $('#class-search-form').addEventListener('submit',event=>event.preventDefault());
  $('#class-search').addEventListener('input',event=>{classQuery=event.target.value;renderClasses();});
  $('#clear-class-search').addEventListener('click',()=>{classQuery='';$('#class-search').value='';renderClasses();$('#class-search').focus();});
}
function classOptions() { return '<option value="">Selecione uma turma</option>' + sortedClasses().map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join(''); }
function updateSelects() { for (const id of ['lesson-class','student-class']) { const select = $(`#${id}`); const selected = select.value; select.innerHTML = classOptions(); select.value = selected; } }
function empty(title, message, action = '') { return `<div class="empty"><div class="empty-icon" aria-hidden="true">☑</div><h2>${title}</h2><p>${message}</p>${action}</div>`; }
function renderAttendance() {
  const area = $('#attendance-area');
  if (!lesson) { area.innerHTML = empty(state.classes.length ? 'Pronto para a próxima aula' : 'Sua primeira chamada começa aqui', state.classes.length ? 'Selecione uma turma e uma data acima para abrir a lista de alunos.' : 'Cadastre uma turma e seus alunos. Depois, volte aqui para registrar a presença.', '<button class="button secondary" data-go-classes>Gerenciar turmas</button>'); return; }
  const present = lesson.roster.filter(s => lesson.present.includes(s.id)).length;
  area.innerHTML = `<div class="stats"><div class="stat"><div><span>Alunos na aula</span><strong>${lesson.roster.length}</strong></div><div class="stat-icon" aria-hidden="true">♧</div></div><div class="stat present"><div><span>Presentes</span><strong>${present}</strong></div><div class="stat-icon" aria-hidden="true">✓</div></div><div class="stat absent"><div><span>Ausentes</span><strong>${lesson.roster.length-present}</strong></div><div class="stat-icon" aria-hidden="true">−</div></div></div>
  <div class="card roster"><div class="roster-heading"><div><h2>${escapeHTML(lesson.className)}</h2><p>${formatDate(lesson.date)} · ${state.lessons.some(l=>l.id===lesson.id) ? 'Chamada salva' : 'Nova chamada'}</p></div><div class="roster-tools"><button class="text-button" data-mark="all">Marcar todos</button><button class="text-button" data-mark="none">Desmarcar todos</button></div></div>
  <div class="table-head"><span></span><span>ALUNO</span><span>PRESENÇA</span></div>
  ${lesson.roster.map(student => { const checked = lesson.present.includes(student.id); const initials = student.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase(); return `<div class="student-row"><div class="avatar" aria-hidden="true">${escapeHTML(initials)}</div><span class="student-name">${escapeHTML(student.name)}</span><label class="presence-toggle"><input type="checkbox" data-student="${student.id}" ${checked ? 'checked' : ''} aria-label="Presença de ${escapeHTML(student.name)}"><span>${checked ? 'Presente' : 'Ausente'}</span></label></div>`; }).join('')}
  ${!lesson.roster.length ? empty('Esta turma ainda não tem alunos','Cadastre alunos em Turmas e alunos e abra a aula novamente.') : ''}
  <div class="save-row"><p>Desmarque quem faltou e salve a chamada.</p><button class="button primary" id="save-lesson" ${!lesson.roster.length ? 'disabled' : ''}>Salvar chamada</button></div></div>`;
}
function renderClasses() {
  const visibleClasses=sortedClasses().filter(c=>normalizeSearch(c.name).includes(normalizeSearch(classQuery)));
  const searchStatus=$('#class-search-status');
  if(searchStatus)searchStatus.textContent=classQuery.trim()?`${visibleClasses.length} ${visibleClasses.length===1?'turma encontrada':'turmas encontradas'}`:`${state.classes.length} ${state.classes.length===1?'turma cadastrada':'turmas cadastradas'}`;
  if(state.classes.length&&!visibleClasses.length){$('#class-list').innerHTML=empty('Nenhuma turma encontrada','Tente outro nome ou clique em Ver todas as turmas.');return;}
  $('#class-list').innerHTML = state.classes.length ? state.classes.map(c => { const students = state.students.filter(s=>s.classId===c.id).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')); return `<div class="card class-card"><div class="class-title"><h2>${escapeHTML(c.name)} <span class="pill">${students.length} alunos</span></h2><button class="text-button" data-delete-class="${c.id}">Excluir turma</button></div>${students.length ? students.map(s => `<div class="student-chip"><span>${escapeHTML(s.name)}</span><button class="text-button" data-delete-student="${s.id}" aria-label="Excluir ${escapeHTML(s.name)}">Excluir</button></div>`).join('') : '<p>Nenhum aluno cadastrado nesta turma.</p>'}</div>`; }).join('') : empty('Nenhuma turma cadastrada','Dê um nome à sua primeira turma no formulário acima.');
}
function renderHistory() {
  const lessons = state.lessons.filter(l => !historyDate || l.date === historyDate);
  $('#history-search-summary').textContent = historyDate ? `${lessons.length} ${lessons.length === 1 ? 'aula encontrada' : 'aulas encontradas'} em ${formatDate(historyDate)}` : 'Todas as aulas registradas';
  $('#history-list').innerHTML = lessons.length ? [...lessons].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt)).map(l => `<article class="card history-card"><div><h2>${escapeHTML(l.className)}</h2><p>${formatDate(l.date)} · ${l.present.length} presentes · ${l.roster.length-l.present.length} ausentes</p></div><div class="roster-tools"><button class="button secondary" data-edit="${l.id}">Consultar chamada</button><button class="text-button" data-delete-lesson="${l.id}">Excluir</button></div></article>`).join('') : historyDate ? empty('Nenhuma aula nesta data','Não há chamada salva em '+formatDate(historyDate)+'. Escolha outra data ou veja todas as aulas.') : empty('Nenhuma aula registrada','As chamadas aparecerão aqui depois que você salvar a presença de uma aula.');
}
function render() { updateSelects(); renderAttendance(); renderClasses(); renderHistory(); }
function showView(view) { document.querySelectorAll('.view').forEach(el=>el.hidden = el.id!==view); document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view)); }
async function openLesson(classId,date) {
  if (dirty && !await confirmAction('Há alterações não salvas nesta chamada. Deseja descartá-las e abrir outra aula?')) return;
  const c = state.classes.find(c=>c.id===classId); if (!c) return toast('Selecione uma turma válida.');
  const saved = state.lessons.find(l=>l.classId===classId && l.date===date);
  const roster = state.students.filter(s=>s.classId===classId).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(s=>({id:s.id,name:s.name}));
  lesson = saved ? structuredClone(saved) : {id:uid(),classId,className:c.name,date,roster,present:roster.map(s=>s.id),updatedAt:new Date().toISOString()};
  dirty = false; renderAttendance();
}
document.addEventListener('click', async event => {
  const target = event.target.closest('button'); if (!target) return;
  if (target.dataset.view) showView(target.dataset.view);
  if (target.hasAttribute('data-go-classes')) showView('classes');
  if (target.dataset.mark && lesson) { lesson.present = target.dataset.mark==='all' ? lesson.roster.map(s=>s.id) : []; dirty = true; renderAttendance(); }
  if (target.id==='save-lesson' && lesson && !busy) {
    target.disabled = true; const saved = {...structuredClone(lesson),updatedAt:new Date().toISOString()};
    const next = {...state,lessons:[...state.lessons.filter(l=>l.id!==saved.id),saved]};
    if (await commit(next)) { lesson = saved; dirty = false; render(); toast('Chamada salva. Presenças e faltas registradas.'); } else target.disabled = false;
  }
  if (target.dataset.edit) { if (dirty && !await confirmAction('Descartar as alterações não salvas para consultar esta chamada?')) return; lesson = structuredClone(state.lessons.find(l=>l.id===target.dataset.edit)); dirty=false; $('#lesson-class').value=lesson.classId; $('#lesson-date').value=lesson.date; showView('attendance'); renderAttendance(); }
  if (target.dataset.deleteStudent) {
    if (!await confirmAction('Excluir este aluno do cadastro? As chamadas já salvas serão preservadas.')) return;
    if (await commit({...state,students:state.students.filter(s=>s.id!==target.dataset.deleteStudent)})) {renderClasses();toast('Aluno excluído.');}
  }
  if (target.dataset.deleteClass) {
    if (!await confirmAction('Excluir esta turma e seus alunos do cadastro? O histórico das aulas será preservado.')) return;
    if (await commit({...state,classes:state.classes.filter(c=>c.id!==target.dataset.deleteClass),students:state.students.filter(s=>s.classId!==target.dataset.deleteClass)})) {render();toast('Turma excluída.');}
  }
  if (target.dataset.deleteLesson) {
    if (!await confirmAction('Excluir definitivamente esta chamada do histórico?')) return;
    if (await commit({...state,lessons:state.lessons.filter(l=>l.id!==target.dataset.deleteLesson)})) {if(lesson?.id===target.dataset.deleteLesson){lesson=null;dirty=false;}render();toast('Chamada excluída.');}
  }
});
document.addEventListener('change', event => { if (event.target.dataset.student && lesson) { const id=event.target.dataset.student; lesson.present = event.target.checked ? [...new Set([...lesson.present,id])] : lesson.present.filter(s=>s!==id); dirty = true; const focusId=id; renderAttendance(); document.querySelector(`[data-student="${focusId}"]`).focus(); } });
$('#lesson-form').addEventListener('submit', event => {event.preventDefault(); openLesson($('#lesson-class').value,$('#lesson-date').value);});
$('#history-search-form').addEventListener('submit', event => { event.preventDefault(); historyDate = $('#history-date').value; renderHistory(); });
$('#clear-history-search').addEventListener('click', () => { historyDate = ''; $('#history-date').value = ''; renderHistory(); });
$('#class-form').addEventListener('submit', async event => { event.preventDefault(); const name=$('#class-name').value.trim(); if(!name)return toast('Informe o nome da turma.'); if(state.classes.some(c=>c.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))return toast('Já existe uma turma com esse nome.'); if(await commit({...state,classes:[...state.classes,{id:uid(),name}]})){event.target.reset();render();toast('Turma cadastrada. Agora você pode adicionar alunos.');} });
$('#student-form').addEventListener('submit', async event => { event.preventDefault(); const name=$('#student-name').value.trim(),classId=$('#student-class').value; if(!name||!state.classes.some(c=>c.id===classId))return toast('Informe o nome e selecione uma turma.'); if(state.students.some(s=>s.classId===classId&&s.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))&&!await confirmAction('Já existe um aluno com esse nome nesta turma. Cadastrar outro aluno com o mesmo nome?'))return; if(await commit({...state,students:[...state.students,{id:uid(),name,classId}]})){$('#student-name').value='';render();$('#student-name').focus();toast('Aluno cadastrado.');} });
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
$('#lesson-date').value=today(); $('#today-label').textContent=new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
async function initialize() {
  try { setupClassSearch(); storage = await createStorage(); state = await storage.load(); render(); registerTools(); }
  catch(error) { $('#attendance-area').innerHTML=empty('Não foi possível carregar os dados',escapeHTML(error.message || 'Verifique a conexão e recarregue a página. Seus cadastros não foram substituídos.')); toast(error.message); document.querySelectorAll('form button').forEach(b=>b.disabled=true); }
}
initialize();
function registerTools() {
  const context=document.modelContext;if(!context?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  try { Promise.resolve(context.registerTool({name:'list_classes',title:'Consultar turmas',description:'Consulta as turmas cadastradas e seus alunos, sem alterar os dados.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('Esta consulta não recebe parâmetros.');return state.classes.map(c=>({id:c.id,name:c.name,students:state.students.filter(s=>s.classId===c.id).map(s=>({id:s.id,name:s.name}))}));}},{signal:lifecycle.signal})).catch(()=>{}); } catch {}
}
