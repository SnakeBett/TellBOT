# Extensão Telegram Bulk Video Downloader

## Visão Geral

Esta é uma extensão de navegador projetada para facilitar o download em massa de vídeos de grupos ou canais específicos dentro do Telegram Web (`web.telegram.org`). Ela adiciona um botão à interface do Telegram Web que, quando clicado, tenta identificar todos os vídeos na seção de mídia visível (e rolando para carregar mais), extrai seus links de download e os baixa sequencialmente para o seu computador usando o gerenciador de downloads do navegador.

## Arquivos da Extensão

*   `manifest.json`: Define a estrutura, permissões e scripts da extensão.
*   `content.js`: Script injetado na página do Telegram Web. Responsável por adicionar o botão, detectar vídeos, rolar a página e extrair os links.
*   `background.js`: Service worker que roda em segundo plano. Recebe a lista de links do `content.js` e gerencia a fila e o processo de download de cada vídeo, adaptando a lógica do script original fornecido.
*   `styles.css`: Define a aparência do botão "Baixar Vídeos em Massa".
*   `icons/`: Contém os ícones da extensão (atualmente placeholders).

## Instalação (Como Extensão Desempacotada)

Como esta extensão não está publicada em uma loja oficial, você precisará carregá-la manualmente no seu navegador:

**Para Google Chrome (ou navegadores baseados em Chromium como Edge, Brave):**

1.  Baixe e descompacte o arquivo `telegram_downloader_ext.zip` em uma pasta permanente no seu computador.
2.  Abra o Chrome e digite `chrome://extensions` na barra de endereços.
3.  Ative o "Modo do desenvolvedor" no canto superior direito.
4.  Clique no botão "Carregar sem compactação".
5.  Navegue até a pasta onde você descompactou a extensão (`telegram_downloader_ext`) e selecione-a.
6.  A extensão deve aparecer na lista.

**Para Mozilla Firefox:**

1.  Baixe e descompacte o arquivo `telegram_downloader_ext.zip` em uma pasta permanente.
2.  Abra o Firefox e digite `about:debugging#/runtime/this-firefox` na barra de endereços.
3.  Clique em "Carregar suplemento temporário...".
4.  Navegue até a pasta da extensão e selecione o arquivo `manifest.json`.
5.  A extensão será carregada temporariamente (será removida ao fechar o Firefox, a menos que você a assine para desenvolvimento).

## Como Usar

1.  Após instalar a extensão, acesse o Telegram Web (`web.telegram.org`) e faça login.
2.  Navegue até o grupo ou canal de onde deseja baixar os vídeos.
3.  Abra as informações do grupo/canal (clicando no nome no topo).
4.  Vá para a seção de Mídia. Idealmente, filtre para mostrar apenas "Vídeos" (a localização exata e a forma de filtrar podem variar na interface do Telegram).
5.  Você deverá ver um botão **"Abrir Vídeos em Sequência"** adicionado pela extensão.
6.  Clique neste botão.
7.  O botão mudará para "Abrindo Vídeos...". O script começará a identificar os vídeos na visualização atual e rolará a página para baixo automaticamente para carregar e encontrar mais vídeos (até um limite de tentativas para evitar loops).
8.  A extensão abrirá cada vídeo sequencialmente, executará um clique automático no botão especificado (por exemplo, botão de download) após abrir cada vídeo, e depois fechará o vídeo e passará para o próximo.
9.  Quando o processo terminar, você receberá um alerta informando quantos vídeos foram processados.
10. Se necessário, você pode pausar a sequência a qualquer momento usando o botão "Pausar Sequência" que aparece durante o processo.

## Personalização

### Funcionalidade de Clique Automático

A extensão está configurada para clicar automaticamente no botão de opções de download após abrir cada vídeo e selecionar a opção de melhor qualidade disponível. Como nem todos os vídeos apresentam menu de opções de qualidade, a extensão foi otimizada para lidar com diferentes cenários. A sequência de ações é a seguinte:

1. Abre o vídeo na galeria
2. Aguarda o carregamento completo do visualizador de mídia
3. Clica no botão de opções de download (menu de qualidade)
4. Verifica se um menu com opções de qualidade apareceu:
   - **Se o menu com opções de qualidade aparecer**: 
     - Procura pela opção de 1080p e clica nela, se disponível
     - Se não encontrar 1080p, procura por 720p e clica nela
     - Se não encontrar resolução específica, usa a primeira opção (geralmente a de maior qualidade)
   - **Se nenhum menu aparecer ou se o menu não contiver opções de qualidade**:
     - Fecha o menu (se estiver aberto)
     - Procura por um botão de download direto e clica nele como alternativa
5. Aguarda o tempo de visualização configurado
6. Fecha o vídeo e segue para o próximo

Esta abordagem adaptativa garante que a extensão funcione corretamente tanto para vídeos que têm opções de qualidade quanto para aqueles que não têm, maximizando a compatibilidade com diferentes tipos de mídia no Telegram.

Os seletores atuais estão configurados para encontrar os elementos corretos no Telegram Web:

```javascript
const AUTO_CLICK_BUTTON_SELECTOR = ".media-viewer-buttons .quality-download-options-button-menu"; // Botão de opções de download
```

Se a estrutura HTML do Telegram Web mudar, você pode precisar atualizar estes seletores. Para encontrar os seletores corretos:

1. Abra o Telegram Web e navegue até um vídeo
2. Pressione F12 para abrir as ferramentas de desenvolvedor
3. Use o inspetor de elementos (ícone de seta no canto superior esquerdo das ferramentas de desenvolvedor) para clicar no botão desejado
4. Observe o código HTML e identifique o seletor CSS apropriado (classe, ID ou outro atributo)

### Ajustando o Tempo de Espera e Tentativas

Você também pode ajustar o tempo de espera e o número de tentativas para encontrar e clicar no botão:

```javascript
const AUTO_CLICK_DELAY = 2000; // Tempo em ms para aguardar antes de tentar clicar no botão
```

Na função `autoClickButton()`, a extensão tenta encontrar o botão várias vezes (por padrão, 5 tentativas) com um pequeno intervalo entre cada tentativa. Após clicar no botão de opções, a extensão aguarda 1 segundo para o menu aparecer antes de tentar selecionar a melhor qualidade disponível.

## Considerações Importantes e Limitações

*   **!!! SELETORES CSS CRÍTICOS !!!**: Os seletores CSS usados em `content.js` para encontrar o local do botão (`BUTTON_CONTAINER_SELECTOR`), os itens de vídeo (`VIDEO_ITEM_SELECTOR`), o link de download (`VIDEO_LINK_SELECTOR_OR_ATTRIBUTE`) e o container rolável (`.scrollable-container`) são **exemplos hipotéticos**. A estrutura HTML do Telegram Web muda com frequência. **É muito provável que você precise inspecionar o código HTML do Telegram Web (usando as ferramentas de desenvolvedor do navegador - F12) para encontrar os seletores corretos e atualizá-los no arquivo `content.js` para que a extensão funcione.** Sem os seletores corretos, o botão pode não aparecer ou os vídeos não serão encontrados.
*   **Seletor de Botão Automático**: O seletor para o botão de clique automático (`AUTO_CLICK_BUTTON_SELECTOR`) deve ser ajustado conforme a estrutura atual do Telegram Web. Se o seletor estiver incorreto, o clique automático não funcionará.
*   **Atualizações do Telegram**: Qualquer atualização na interface do Telegram Web pode quebrar a funcionalidade da extensão, principalmente os seletores CSS. Manutenção periódica pode ser necessária.
*   **Rolagem Automática**: A rolagem tem um limite de tentativas (`maxScrollAttempts` em `content.js`). Em grupos com milhares de vídeos, pode ser que a extensão não consiga carregar todos de uma vez.
*   **Erros**: Embora haja tratamento básico de erros, problemas de rede, mudanças no Telegram ou vídeos indisponíveis podem causar falhas. Verifique o console do navegador (F12 -> Console) e o console da extensão (`chrome://extensions/` -> Detalhes -> Inspecionar views: service worker) para mensagens de erro.
*   **Ícones**: Os ícones fornecidos são placeholders. Você pode substituí-los por imagens PNG reais nos tamanhos 16x16, 48x48 e 128x128 na pasta `icons/`.

Esta extensão é um ponto de partida e provavelmente exigirá ajustes técnicos (principalmente nos seletores) para funcionar corretamente com a versão atual do Telegram Web.
