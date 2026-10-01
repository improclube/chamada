# Publicar com credencial informada na tela

## Preparar os dados

Use o repositório privado improclube/chamada-dados, branch main, arquivo chamada.json. Esses nomes ficam em config.js e podem ser ajustados.

Se o arquivo ainda não existir, envie chamada-inicial.json ao repositório privado renomeando para chamada.json. Não substitua registros reais por um arquivo vazio.

## Criar a credencial

Use um token de acesso GitHub válido com Contents: Read and write no repositório de dados. Um token revogado ou expirado não funciona. A senha da conta GitHub não substitui o token.

Crie tokens em https://github.com/settings/personal-access-tokens/new. Cada token só pode acessar os recursos permitidos à conta proprietária. Tokens fine-grained têm limitações para colaboradores externos; confira a documentação se o repositório não aparecer.

Nunca publique o token em config.js, código ou arquivos de documentação. Digite-o somente na tela de conexão do site.

## Atualizar o site

1. Baixe um backup dos registros antigos.
2. Extraia o ZIP atualizado.
3. Substitua os arquivos na raiz do repositório chamada, incluindo index.html, styles.css, config.js, github-storage.js, storage.js, app.js e favicon.svg.
4. Preserve a configuração funcional do GitHub Pages.
5. Aguarde a publicação e recarregue com Ctrl + F5.
6. A tela Conectar ao GitHub será exibida. Informe o token e clique em Conectar.

Não é necessária hospedagem de servidor adicional. Esta versão não usa apiUrl nem conexão automática com credencial incluída no código. Os arquivos possuem referências de versão para evitar reutilizar scripts antigos.

## Uso

O token fica apenas na memória da página. O campo é limpo depois da conexão. Não há persistência de credencial em localStorage, sessionStorage ou cookies. Recarregar a página ou abrir outro dispositivo exige informar a credencial novamente.

Use Desconectar para encerrar a conexão desta página. Havendo mudanças não salvas, o site pede confirmação antes de descartá-las.

Todos que se conectarem com permissão no repositório leem o mesmo arquivo de turmas e chamadas. Use Restaurar backup ou Importar dados deste navegador para migrar registros antigos; a operação substitui o arquivo, sem mesclar backups.

Ao salvar, o site atualiza chamada.json e cria um commit. Alterações de outros professores aparecem ao recarregar e conectar novamente. Versões diferentes do arquivo causam recusa de salvamento para evitar sobrescrita.

O arquivo tem limite de 900 KB. Excluir um registro na interface não elimina versões anteriores do histórico Git.

## Verificação

Esta entrega foi verificada com GitHub simulado: conexão manual, credencial inválida com nova tentativa, leitura, gravação, caracteres UTF-8, conflitos, desconexão e ausência de token nos arquivos do site. O acesso ao repositório real não foi testado.

Se um token foi publicado anteriormente, revogue-o. Remover o token da versão atual do site não o remove do histórico de commits.

[Documentação de tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
