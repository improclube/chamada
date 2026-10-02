'use strict';
async function createGitHubStorage() {
  const config=window.IMPROCLUBE_CONFIG;
  if(!/^[a-zA-Z0-9-]+$/.test(config.githubOwner)||!/^[a-zA-Z0-9_.-]+$/.test(config.githubRepo)||!config.githubBranch||!config.githubFile?.endsWith('.json')||config.githubFile.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Confira o repositório, a branch e o arquivo JSON em config.js.');
  const base=`https://api.github.com/repos/${encodeURIComponent(config.githubOwner)}/${encodeURIComponent(config.githubRepo)}`;
  const endpoint=`${base}/contents/${config.githubFile.split('/').map(encodeURIComponent).join('/')}`;
  let token='';
  let sha=null;let initial=null;let saving=false;
  async function api(url,method='GET',body){
    let response;
    try{response=await fetch(url,{method,cache:'no-store',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw new Error('Sem conexão com o GitHub. A alteração não foi confirmada. Tente novamente quando estiver conectado.');}
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(response.status===401?'Token inválido ou expirado.':response.status===403?'O GitHub recusou o acesso. Confira as permissões do token, sua autorização na organização e os limites da API.':response.status===404?'Repositório, branch ou arquivo não encontrado. Confira config.js e o acesso do seu token.':[409,422].includes(response.status)?'Não foi possível atualizar o arquivo. Outro professor pode ter salvado alterações. Baixe um backup e recarregue antes de continuar.':'Não foi possível acessar o arquivo no GitHub.');error.status=response.status;throw error;}
    return data;
  }
  function decode(content){const bytes=Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0));return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  function encode(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
  async function load(){const file=await api(endpoint+`?ref=${encodeURIComponent(config.githubBranch)}`);if(file.type!=='file'||file.encoding!=='base64'||!file.content)throw new Error('O arquivo de dados deve ser um JSON com menos de 900 KB.');const data=validateState(JSON.parse(decode(file.content)));sha=file.sha;return data;}
  const dialog=$('#login-dialog');
  dialog.addEventListener('cancel',event=>event.preventDefault());
  dialog.showModal();
  await new Promise(resolve=>{
    const form=$('#login-form');
    const handler=async event=>{
      event.preventDefault();const button=form.querySelector('button');button.disabled=true;$('#login-error').textContent='';token=$('#github-token').value.trim();
      try{
        if(!token)throw new Error('Informe seu token de acesso.');
        const repo=await api(base);
        if(!repo.private)throw new Error('O repositório de dados precisa ser privado. Confira githubOwner e githubRepo em config.js.');
        if(repo.permissions?.push===false)throw new Error('O token precisa de permissão de escrita no repositório de dados.');
        initial=await load();$('#github-token').value='';form.removeEventListener('submit',handler);dialog.close();resolve();
      }catch(error){token='';$('#login-error').textContent=error.message;}
      finally{button.disabled=false;}
    };
    form.addEventListener('submit',handler);
  });
  const adapter={load:async()=>{if(initial){const value=initial;initial=null;return value;}return load();},async save(data){
    if(saving)throw new Error('Aguarde o salvamento anterior terminar.');validateState(data);const text=JSON.stringify(data,null,2);if(new TextEncoder().encode(text).length>900*1024)throw new Error('O arquivo atingiu o limite de 900 KB desta versão. Faça um backup e solicite uma divisão do arquivo por turma/ano.');saving=true;
    try{const current=await api(endpoint+`?ref=${encodeURIComponent(config.githubBranch)}`);if(current.sha!==sha)throw new Error('Outro professor atualizou os registros. Baixe um backup e recarregue antes de continuar.');const result=await api(endpoint,'PUT',{message:'Atualizar registros de chamada Improclube',content:encode(text),sha,branch:config.githubBranch});if(!result.content?.sha)throw new Error('Resposta inesperada do GitHub. Recarregue a página para conferir se a alteração foi salva.');sha=result.content.sha;}finally{saving=false;}
  }};
  $('#storage-note').textContent=`Recarregue para ver alterações de outros professores.`;
  $('#account-label').textContent='Conectado ao GitHub';
  async function logout(){if(busy)return toast('Aguarde o salvamento terminar.');if(dirty&&!await confirmAction('Descartar as alterações não salvas e desconectar?'))return;token='';location.reload();}
  for(const id of ['logout','logout-mobile']){$(`#${id}`).hidden=false;$(`#${id}`).textContent='Desconectar';$(`#${id}`).addEventListener('click',logout);}
  if(localStorage.getItem(STORAGE_KEY)){$('#migrate-local').hidden=false;$('#migrate-local').addEventListener('click',async()=>{try{const old=validateState(JSON.parse(localStorage.getItem(STORAGE_KEY)));if(!await confirmAction('Importar os dados deste navegador substituirá o arquivo compartilhado no GitHub. Faça um backup antes. Deseja continuar?'))return;if(await commit(old)){lesson=null;dirty=false;render();toast('Dados importados para o arquivo do GitHub.');}}catch(error){toast(error.message);}});}
  return adapter;
}
