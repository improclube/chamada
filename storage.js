'use strict';
const STORAGE_KEY='presenca-dados-v1';
const initialState=()=>({classes:[],students:[],lessons:[]});
function validateState(data) {
  if(!data||!['classes','students','lessons'].every(key=>Array.isArray(data[key])))throw new Error('Arquivo de dados inválido.');
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id);
  const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=120;
  const unique=items=>new Set(items.map(i=>i.id)).size===items.length;
  if(!unique(data.classes)||!unique(data.students)||!unique(data.lessons))throw new Error('Há registros duplicados no arquivo.');
  if(!data.classes.every(c=>validId(c.id)&&text(c.name)))throw new Error('Turmas inválidas.');
  if(!data.students.every(s=>validId(s.id)&&text(s.name)&&data.classes.some(c=>c.id===s.classId)))throw new Error('Alunos inválidos.');
  if(!data.lessons.every(l=>validId(l.id)&&validId(l.classId)&&text(l.className)&&typeof l.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(l.date)&&!isNaN(Date.parse(l.date))&&new Date(l.date).toISOString().slice(0,10)===l.date&&typeof l.updatedAt==='string'&&!isNaN(Date.parse(l.updatedAt))&&Array.isArray(l.roster)&&unique(l.roster)&&l.roster.every(s=>validId(s.id)&&text(s.name))&&Array.isArray(l.present)&&new Set(l.present).size===l.present.length&&l.present.every(id=>l.roster.some(s=>s.id===id))))throw new Error('Chamadas inválidas.');
  if(new Set(data.lessons.map(l=>`${l.classId}/${l.date}`)).size!==data.lessons.length)throw new Error('Existe mais de uma chamada para a mesma turma e data.');
  return {classes:data.classes,students:data.students,lessons:data.lessons};
}
if(typeof module!=='undefined')module.exports={validateState};
async function createStorage() {
  if(window.IMPROCLUBE_CONFIG?.storageMode === 'github'){
    const github = await createGitHubStorage();
    setupBackupActions();
    return github;
  }
  if(window.IMPROCLUBE_CONFIG?.storageMode !== 'local')throw new Error('A configuração carregada é de uma versão antiga. Substitua index.html, config.js, github-storage.js, storage.js e app.js pelo pacote atualizado e recarregue a página.');
  let revision=null;
  let response;
  if(location.protocol!=='file:')response=await fetch('api/state',{cache:'no-store'});
  let adapter;
  if(response?.ok&&response.headers.get('content-type')?.includes('application/json')){
    const payload=await response.json(); revision=payload.revision; const loaded=validateState(payload.data);
    adapter={load:async()=>loaded,save:async data=>{validateState(data);const res=await fetch('api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision})});if(!res.ok){throw new Error(res.status===409?'Os dados mudaram em outra aba ou dispositivo. Baixe um backup das alterações e recarregue a página.':'Não foi possível salvar no servidor. Tente novamente.');}revision=(await res.json()).revision;}};
    $('#storage-note').textContent='Dados salvos no servidor. Baixe backups regularmente.';
  } else {
    if(response&&!response.ok&&response.status!==404)throw new Error('O servidor está indisponível. Recarregue a página para tentar novamente.');
    if(localStorage.getItem('presenca-modo-local')!=='accepted'){
      const accept=await confirmAction('Neste site, os cadastros e chamadas ficarão somente neste navegador. Eles não são sincronizados entre dispositivos e podem ser perdidos ao limpar os dados do navegador. Você pode baixar e restaurar backups. Deseja usar este modo?');
      if(!accept)throw new Error('Modo local não ativado. Para armazenamento online, use a versão com servidor descrita no README.');
      localStorage.setItem('presenca-modo-local','accepted');
    }
    adapter={load:async()=>{const raw=localStorage.getItem(STORAGE_KEY);return raw?validateState(JSON.parse(raw)):initialState();},save:async data=>{validateState(data);localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}};
    $('#storage-note').textContent='Dados salvos somente neste navegador. Baixe um backup para não perdê-los.';
    window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){toast('Os dados foram alterados em outra aba. Recarregue esta página antes de continuar.');document.querySelectorAll('button').forEach(b=>b.disabled=true);}});
  }
  setupBackupActions();
  return adapter;
}
function setupBackupActions() {
  $('#backup-actions').hidden=false;
  $('#export-data').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`presenca-backup-${today()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('#import-data').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('O backup deve ter no máximo 5 MB.');const data=validateState(JSON.parse(await file.text()));if(!await confirmAction('Restaurar este backup substituirá todos os cadastros e chamadas atuais, incluindo alterações não salvas. Deseja continuar?'))return;if(await commit(data)){lesson=null;dirty=false;render();toast('Backup restaurado.');}}catch(error){toast(error.message||'Não foi possível ler o backup.');}finally{event.target.value='';}});
}
