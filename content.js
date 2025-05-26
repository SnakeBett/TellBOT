console.log("Telegram Bulk Video Downloader: Content script loaded.");

// --- Constants ---
const OPEN_VIDEOS_BUTTON_ID = "sequential-open-videos-button";
const OPEN_VIDEOS_BUTTON_TEXT = "Abrir Vídeos em Sequência";
const PAUSE_BUTTON_ID = "pause-sequence-button";
const PAUSE_BUTTON_TEXT = "Pausar Sequência";
const RESUME_BUTTON_TEXT = "Continuar Sequência";
// --- Seletores (PRECISAM SER AJUSTADOS COM BASE NA ESTRUTURA REAL DO TELEGRAM WEB) ---
// Seletor para as miniaturas de vídeo
const VIDEO_ITEMS_SELECTOR = ".search-super-container-media.active .grid-item";
// Seletor para o botão que deve ser clicado após abrir o vídeo (ajuste conforme necessário)
const AUTO_CLICK_BUTTON_SELECTOR = ".media-viewer-buttons .quality-download-options-button-menu"; // Botão de opções de download

// --- Variáveis Globais ---
let isOpeningVideos = false;
let isPaused = false;
let currentVideoIndex = 0;
let videoItems = []; // Para armazenar os itens encontrados
const VIDEO_VIEW_DURATION = 5000; // 5 segundos em ms para visualizar cada vídeo
const AUTO_CLICK_DELAY = 2000; // Tempo em ms para aguardar antes de clicar no botão

/**
 * Adiciona botões flutuantes na interface.
 */
function addFloatingButtons() {
    // Adiciona o botão para abrir vídeos em sequência
    if (!document.getElementById(OPEN_VIDEOS_BUTTON_ID)) {
        const button = document.createElement("button");
        button.id = OPEN_VIDEOS_BUTTON_ID;
        button.textContent = OPEN_VIDEOS_BUTTON_TEXT;
        button.classList.add("custom-button", "floating", "open-videos"); // Adiciona classes
        button.onclick = handleOpenVideosClick;
        
        // Adiciona diretamente ao body
        document.body.appendChild(button);
        console.log("Botão para abrir vídeos em sequência adicionado.");
    }
}

/**
 * Adiciona botão de pausar/continuar.
 */
function addPauseButton() {
    removePauseButton(); // Remove qualquer botão existente primeiro
    
    const button = document.createElement("button");
    button.id = PAUSE_BUTTON_ID;
    button.textContent = PAUSE_BUTTON_TEXT;
    button.classList.add("custom-button", "floating", "pause-button");
    button.onclick = togglePauseResume;
    
    document.body.appendChild(button);
    console.log("Botão de pausar/continuar adicionado.");
}

/**
 * Remove botão de pausar/continuar.
 */
function removePauseButton() {
    const button = document.getElementById(PAUSE_BUTTON_ID);
    if (button) {
        button.remove();
        console.log("Botão de pausar/continuar removido.");
    }
}

/**
 * Alterna entre pausar e continuar a sequência.
 */
function togglePauseResume() {
    isPaused = !isPaused;
    const button = document.getElementById(PAUSE_BUTTON_ID);
    if (button) {
        button.textContent = isPaused ? RESUME_BUTTON_TEXT : PAUSE_BUTTON_TEXT;
        button.style.backgroundColor = isPaused ? "#4CAF50" : "#ff9800"; // Verde quando pausado (para continuar), laranja quando ativo
    }
    console.log(isPaused ? "Sequência pausada." : "Sequência retomada.");
}

/**
 * Lida com o clique no botão de abrir vídeos em sequência.
 */
async function handleOpenVideosClick() {
    if (isOpeningVideos) {
        console.log("Já estamos abrindo vídeos em sequência.");
        return;
    }
    isOpeningVideos = true;
    updateOpenVideosButtonState(true);
    console.log("Iniciando abertura sequencial de vídeos...");

    try {
        // Reinicia as variáveis de controle
        isPaused = false;
        currentVideoIndex = 0;
        videoItems = [];
        
        // Adiciona o botão de pausar/continuar
        addPauseButton();
        
        const videoCount = await processVideosSequentially();
        if (videoCount > 0) {
            console.log(`Abertos ${videoCount} vídeos em sequência.`);
            alert(`Foram abertos ${videoCount} vídeos em sequência.`);
        } else {
            console.log("Nenhum vídeo encontrado na visualização atual.");
            alert("Nenhum vídeo encontrado. Certifique-se de estar na seção de mídia correta e role a página se necessário.");
        }
    } catch (error) {
        console.error("Erro ao abrir vídeos em sequência:", error);
        alert("Ocorreu um erro ao abrir vídeos em sequência. Verifique o console da extensão.");
    } finally {
        isOpeningVideos = false;
        updateOpenVideosButtonState(false);
        removePauseButton();
        
        // Limpa as variáveis
        videoItems = [];
        currentVideoIndex = 0;
        isPaused = false;
    }
}

/**
 * Atualiza a aparência/estado do botão de abrir vídeos.
 * @param {boolean} loading - Indica se o estado é de carregamento.
 */
function updateOpenVideosButtonState(loading) {
    const button = document.getElementById(OPEN_VIDEOS_BUTTON_ID);
    if (button) {
        button.disabled = loading;
        button.textContent = loading ? "Abrindo Vídeos..." : OPEN_VIDEOS_BUTTON_TEXT;
    }
}

/**
 * Rola a página para baixo para carregar mais mídias.
 * @returns {Promise<boolean>} - Retorna true se novos itens foram potencialmente carregados, false caso contrário.
 */
async function scrollDown() {
    const scrollableElement = document.querySelector(".sidebar-content .scrollable.scrollable-y"); // Atualizado com base no HTML
    if (!scrollableElement) {
        console.warn("Elemento rolável não encontrado.");
        return false;
    }
    const initialScrollTop = scrollableElement.scrollTop;
    scrollableElement.scrollTop = scrollableElement.scrollHeight;
    // Espera um pouco para o conteúdo carregar
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    return scrollableElement.scrollTop > initialScrollTop;
}

/**
 * Verifica se existe algum visualizador de mídia aberto e o fecha.
 * @returns {Promise<boolean>} - Retorna true se um visualizador foi fechado, false caso contrário.
 */
async function closeMediaViewer() {
    const mediaViewer = document.querySelector('.media-viewer, .MessageMediaViewer, .mediaViewerModal, [class*="mediaViewer"]');
    if (mediaViewer) {
        console.log("Fechando visualizador de mídia...");
        // Tenta primeiro clicar em qualquer botão de fechar visível
        const closeButton = document.querySelector('.media-viewer-close, .btn-close, [aria-label="Fechar"], [aria-label="Close"]');
        if (closeButton) {
            closeButton.click();
        } else {
            // Se não encontrar botão de fechar, simula a tecla ESC
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
            }));
        }
        
        // Espera um momento para garantir que o visualizador foi fechado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verifica novamente se o visualizador foi fechado
        const stillOpen = document.querySelector('.media-viewer, .MessageMediaViewer, .mediaViewerModal, [class*="mediaViewer"]');
        if (stillOpen) {
            console.warn("Visualizador ainda aberto, tentando novamente...");
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
            }));
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        return true;
    }
    
    return false;
}

/**
 * Tenta clicar automaticamente em um botão após abrir o vídeo
 * @returns {Promise<boolean>} - Retorna true se o botão foi encontrado e clicado, false caso contrário
 */
async function autoClickButton() {
    try {
        console.log("Iniciando nova estratégia de clique baseada em posições...");
        
        // Espera inicial para garantir que o visualizador de mídia está completamente carregado
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 1. Primeiro, vamos encontrar o visualizador de mídia
        const mediaViewer = document.querySelector('.media-viewer, .MessageMediaViewer, .mediaViewerModal, [class*="mediaViewer"]');
        if (!mediaViewer) {
            console.log("Visualizador de mídia não encontrado.");
            return false;
        }
        
        console.log("Visualizador de mídia encontrado. Dimensões:", mediaViewer.offsetWidth, "x", mediaViewer.offsetHeight);
        
        // 2. Tenta localizar o botão de download pelo ícone ou outra característica visual
        const downloadButtons = document.querySelectorAll('button, .btn-icon, [class*="download"], [title*="Download"]');
        let downloadButton = null;
        
        console.log(`Encontrados ${downloadButtons.length} possíveis botões`);
        
        // Procura por um botão que pareça ser de download na barra superior ou barra de controles
        for (const btn of downloadButtons) {
            const rect = btn.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            
            // Verifica se este elemento tem alguma propriedade que indique que é um botão de download
            const text = btn.textContent || '';
            const hasDownloadIndicator = 
                text.includes('Download') || 
                text.includes('Baixar') || 
                btn.className.includes('download') ||
                btn.className.includes('quality') ||
                btn.title?.includes('Download') ||
                btn.getAttribute('aria-label')?.includes('Download');
            
            if (isVisible && hasDownloadIndicator) {
                downloadButton = btn;
                console.log("Possível botão de download encontrado:", btn.className);
                break;
            }
        }
        
        // Se não encontrou nada específico, procura um botão na barra superior do visualizador
        if (!downloadButton) {
            console.log("Procurando na barra superior...");
            const topBar = document.querySelector('.media-viewer-topbar, .media-viewer-buttons, [class*="topbar"], [class*="controls"]');
            
            if (topBar) {
                const buttons = topBar.querySelectorAll('button, .btn-icon, [class*="Button"]');
                console.log(`Encontrados ${buttons.length} botões na barra superior`);
                
                // Pega o último ou o penúltimo botão, que geralmente é o de download
                if (buttons.length > 1) {
                    downloadButton = buttons[buttons.length - 1]; // ou buttons[buttons.length - 2] se o último for o de fechar
                }
            }
        }
        
        // 3. Se encontrou o botão, clica nele
        if (downloadButton) {
            console.log("Botão de download encontrado. Clicando...");
            simulateClick(downloadButton);
            
            // 4. Aguarda o menu aparecer
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 5. Agora procura o menu de opções
            const menus = document.querySelectorAll('.btn-menu, [class*="menu"], [role="menu"], .popup');
            console.log(`Encontrados ${menus.length} possíveis menus`);
            
            let qualityMenu = null;
            
            for (const menu of menus) {
                // Verifica se o menu está visível
                const rect = menu.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                 rect.left >= 0 && rect.right <= window.innerWidth &&
                                 rect.top >= 0 && rect.bottom <= window.innerHeight;
                
                if (isVisible) {
                    qualityMenu = menu;
                    console.log("Menu visível encontrado:", menu.className);
                    break;
                }
            }
            
            // 6. Se encontrou o menu, clica no primeiro item
            if (qualityMenu) {
                console.log("Menu de qualidade encontrado!");
                
                // Aguarda para garantir que o menu está estável
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Tenta encontrar itens do menu
                const items = qualityMenu.querySelectorAll('*');
                let firstItem = null;
                
                // Procura por elementos que parecem ser itens de menu
                for (const item of items) {
                    const rect = item.getBoundingClientRect();
                    // Verifica se o elemento tem tamanho razoável para ser um item de menu
                    if (rect.width > 50 && rect.height > 20) {
                        const text = item.textContent || '';
                        // Verifica se o texto contém indicadores de qualidade de vídeo
                        if (text.includes('p') || text.includes('MB') || text.includes('Save')) {
                            firstItem = item;
                            console.log("Item de menu encontrado:", text);
                            break;
                        }
                    }
                }
                
                // Se não encontrou com o método anterior, simplesmente pega o primeiro filho direto
                if (!firstItem && qualityMenu.children.length > 0) {
                    firstItem = qualityMenu.children[0];
                    console.log("Usando primeiro filho do menu:", firstItem.textContent);
                }
                
                // Clica no item encontrado ou diretamente no menu se não encontrou itens
                if (firstItem) {
                    console.log("Clicando no primeiro item do menu...");
                    simulateClick(firstItem);
                } else {
                    // Como último recurso, clica na coordenada relativa ao menu onde provavelmente está o primeiro item
                    console.log("Nenhum item específico encontrado. Clicando em coordenada relativa ao menu...");
                    const menuRect = qualityMenu.getBoundingClientRect();
                    // Clica no meio horizontalmente e a 25% da altura do topo (aproximadamente onde estaria o primeiro item)
                    const x = menuRect.left + menuRect.width / 2;
                    const y = menuRect.top + menuRect.height * 0.25;
                    simulateMouseClick(x, y);
                }
                
                console.log("Sequência de cliques concluída!");
                return true;
            } else {
                console.log("Menu de qualidade não encontrado. A ação de download pode já ter sido iniciada.");
                return true;
            }
        } else {
            console.log("Botão de download não encontrado.");
            
            // Como último recurso, tenta clicar em coordenadas comuns onde os botões geralmente estão
            console.log("Tentando clicar em posições típicas de botões...");
            
            // Obtém as dimensões do visualizador
            const viewerRect = mediaViewer.getBoundingClientRect();
            
            // Coordenadas típicas para o botão de download (canto superior direito, aproximadamente)
            const x = viewerRect.right - 100; // 100px da borda direita
            const y = viewerRect.top + 30;   // 30px do topo
            
            console.log(`Clicando em coordenadas absolutas: ${x}, ${y}`);
            simulateMouseClick(x, y);
            
            // Aguarda um pouco para ver se o menu aparece
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Tenta encontrar qualquer menu que tenha aparecido
            const anyMenu = document.querySelector('.btn-menu, [class*="menu"][style*="display: block"], [role="menu"]');
            if (anyMenu) {
                console.log("Menu encontrado após clique posicional!");
                
                // Clica na parte superior do menu (onde geralmente está o primeiro item)
                const menuRect = anyMenu.getBoundingClientRect();
                const menuX = menuRect.left + menuRect.width / 2;
                const menuY = menuRect.top + 30; // aproximadamente onde estaria o primeiro item
                
                console.log(`Clicando no menu em: ${menuX}, ${menuY}`);
                simulateMouseClick(menuX, menuY);
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error("Erro ao tentar clicar no botão automaticamente:", error);
        return false;
    }
}

/**
 * Simula um clique em um elemento usando diferentes métodos, com comportamento mais humano
 * @param {Element} element - O elemento a ser clicado
 */
function simulateClick(element) {
    try {
        // Obtém a posição do elemento
        const rect = element.getBoundingClientRect();
        const centerX = Math.floor(rect.left + rect.width / 2);
        const centerY = Math.floor(rect.top + rect.height / 2);
        
        // Adiciona uma pequena variação aleatória para parecer mais humano
        const offsetX = Math.floor(Math.random() * 5) - 2; // -2 a +2 pixels
        const offsetY = Math.floor(Math.random() * 5) - 2; // -2 a +2 pixels
        
        const targetX = centerX + offsetX;
        const targetY = centerY + offsetY;
        
        console.log(`Simulando clique humano no elemento em: ${targetX}, ${targetY}`);
        
        // Simula o movimento do mouse para o elemento
        simulateHumanMouseMovement(targetX, targetY).then(() => {
            // Após o movimento, realiza o clique
            simulateHumanMouseClick(targetX, targetY);
            
            // Como fallback, também tenta o clique direto após um pequeno delay
            setTimeout(() => {
                try {
                    element.click();
                } catch (e) {
                    console.log("Clique direto também falhou:", e);
                }
            }, 100);
        });
    } catch (e) {
        console.error("Falha na simulação de clique:", e);
        
        // Como último recurso, tenta o clique direto
        try {
            element.click();
        } catch (err) {
            console.error("Todos os métodos de clique falharam");
        }
    }
}

/**
 * Simula um movimento de mouse de forma mais humana
 * @param {number} targetX - Coordenada X de destino
 * @param {number} targetY - Coordenada Y de destino 
 * @returns {Promise} - Promise que resolve quando o movimento terminar
 */
function simulateHumanMouseMovement(targetX, targetY) {
    return new Promise(resolve => {
        // Posição inicial aleatória (simulando de onde o mouse viria)
        const startX = window.innerWidth / 2 + (Math.random() * 100 - 50);
        const startY = window.innerHeight / 2 + (Math.random() * 100 - 50);
        
        // Número de passos intermediários
        const steps = 5 + Math.floor(Math.random() * 5); // 5 a 10 passos
        let currentStep = 0;
        
        // Função para mover o mouse em passos
        function moveStep() {
            if (currentStep >= steps) {
                // Movimento concluído
                resolve();
                return;
            }
            
            // Calcula a próxima posição com curva suave (easing)
            const progress = currentStep / steps;
            const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2; // easing para movimento mais natural
            
            const nextX = Math.round(startX + (targetX - startX) * easedProgress);
            const nextY = Math.round(startY + (targetY - startY) * easedProgress);
            
            // Adiciona um pouco de "tremor" humano
            const jitterX = Math.floor(Math.random() * 3) - 1; // -1 a +1 pixel
            const jitterY = Math.floor(Math.random() * 3) - 1; // -1 a +1 pixel
            
            // Dispara evento de mousemove
            const moveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: nextX + jitterX,
                clientY: nextY + jitterY
            });
            
            document.elementFromPoint(nextX + jitterX, nextY + jitterY)?.dispatchEvent(moveEvent) || 
                document.dispatchEvent(moveEvent);
            
            currentStep++;
            
            // Timing variável entre passos para parecer mais humano
            const delay = 10 + Math.floor(Math.random() * 15); // 10-25ms
            setTimeout(moveStep, delay);
        }
        
        // Inicia o movimento
        moveStep();
    });
}

/**
 * Simula um clique do mouse em coordenadas específicas com comportamento mais humano
 * @param {number} x - Coordenada X na tela
 * @param {number} y - Coordenada Y na tela
 */
function simulateHumanMouseClick(x, y) {
    console.log(`Simulando clique humano nas coordenadas: ${x}, ${y}`);
    
    const targetElement = document.elementFromPoint(x, y);
    
    if (targetElement) {
        console.log("Elemento alvo:", targetElement.tagName, targetElement.className);
    } else {
        console.log("Nenhum elemento encontrado no ponto de clique");
    }
    
    // Simula sequência de eventos como um clique humano real
    
    // 1. Primeiro mouseover (passar o mouse por cima)
    const overEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y
    });
    
    // 2. mouseenter 
    const enterEvent = new MouseEvent('mouseenter', {
        bubbles: false, // mouseenter não borbulha
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y
    });
    
    // 3. mousedown (pressionar o botão)
    const downEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0, // botão esquerdo
        buttons: 1,
        clientX: x,
        clientY: y
    });
    
    // Pequena pausa antes de soltar o botão (como um humano faria)
    setTimeout(() => {
        // 4. mouseup (soltar o botão)
        const upEvent = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0, // botão esquerdo
            buttons: 0,
            clientX: x,
            clientY: y
        });
        
        // 5. click (evento de clique completo)
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0, // botão esquerdo
            buttons: 0,
            clientX: x,
            clientY: y
        });
        
        // Dispara a sequência de eventos no elemento alvo ou no documento
        if (targetElement) {
            targetElement.dispatchEvent(overEvent);
            targetElement.dispatchEvent(enterEvent);
            targetElement.dispatchEvent(downEvent);
            
            setTimeout(() => {
                targetElement.dispatchEvent(upEvent);
                targetElement.dispatchEvent(clickEvent);
            }, 50 + Math.random() * 50); // 50-100ms de pressionar até soltar
        } else {
            document.dispatchEvent(overEvent);
            document.dispatchEvent(enterEvent);
            document.dispatchEvent(downEvent);
            
            setTimeout(() => {
                document.dispatchEvent(upEvent);
                document.dispatchEvent(clickEvent);
            }, 50 + Math.random() * 50);
        }
    }, 50 + Math.random() * 100); // 50-150ms antes de soltar o botão
}

/**
 * Simula um clique do mouse em coordenadas específicas
 * Mantida para compatibilidade, mas agora usa a versão mais humana
 * @param {number} x - Coordenada X na tela
 * @param {number} y - Coordenada Y na tela
 */
function simulateMouseClick(x, y) {
    simulateHumanMouseClick(x, y);
}

/**
 * Processa os vídeos da galeria, abrindo-os sequencialmente
 * 1. Mapeia todos os vídeos na galeria
 * 2. Clica em cada vídeo e espera por um tempo antes de fechar e seguir para o próximo
 * @returns {Promise<number>} - Número de vídeos processados com sucesso
 */
async function processVideosSequentially() {
    // Armazena informações dos itens de vídeo (usando a variável global)
    videoItems = [];
    
    let attempts = 0;
    const maxScrollAttempts = 50;
    let totalVideosViewed = 0;
    let processingErrors = 0;
    const MAX_ALLOWED_ERRORS = 5;
    const PAUSE_BETWEEN_VIDEOS = 800; // Pausa entre vídeos

    console.log("Iniciando processo de abertura sequencial...");

    // Garante que nenhum visualizador está aberto antes de começar
    await closeMediaViewer();

    try {
        // --- Fase 1: Rolar e mapear todos os itens de vídeo ---
        console.log("Fase 1: Rolando e mapeando todos os vídeos...");
        let lastScrollHeight = 0;
        let consecutiveNoNewItems = 0;
        
        while (attempts < maxScrollAttempts) {
            try {
                const scrollableElement = document.querySelector(".sidebar-content .scrollable.scrollable-y");
                if (!scrollableElement) {
                    console.warn("Elemento rolável não encontrado. Parando rolagem.");
                    break;
                }

                // Pegue todos os itens de vídeo visíveis atualmente
                const currentItems = document.querySelectorAll(VIDEO_ITEMS_SELECTOR);
                
                // Conte quantos itens novos foram encontrados nesta rolagem
                const initialItemCount = videoItems.length;
                
                // Adicione os novos itens à lista (evitando duplicatas)
                for (const item of currentItems) {
                    // Verifique se este item já foi adicionado
                    if (!videoItems.includes(item)) {
                        videoItems.push(item);
                    }
                }
                
                const newItemsFound = videoItems.length - initialItemCount;
                console.log(`Rolagem ${attempts + 1}: ${newItemsFound} vídeos novos encontrados. Total mapeado: ${videoItems.length}`);

                // Condições de parada
                if (newItemsFound === 0) {
                    consecutiveNoNewItems++;
                } else {
                    consecutiveNoNewItems = 0;
                }

                lastScrollHeight = scrollableElement.scrollHeight;
                await scrollDown(); // Rola para baixo
                attempts++;

                if (scrollableElement.scrollHeight === lastScrollHeight && consecutiveNoNewItems >= 1) {
                    console.log("Altura da rolagem não mudou e/ou nenhum vídeo novo encontrado. Parando rolagem.");
                    break;
                }
                
                if (consecutiveNoNewItems >= 2) {
                    console.log("Nenhum vídeo novo encontrado em 2 rolagens consecutivas. Parando rolagem.");
                    break;
                }
            } catch (error) {
                console.error("Erro durante a fase de mapeamento:", error);
                if (++processingErrors >= MAX_ALLOWED_ERRORS) {
                    throw new Error("Muitos erros durante o mapeamento. Abortando processo.");
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (attempts >= maxScrollAttempts) {
            console.warn("Limite máximo de tentativas de rolagem atingido.");
        }
        console.log(`Fase 1 concluída. Total de ${videoItems.length} vídeos mapeados.`);

        // --- Fase 2: Abrir sequencialmente cada vídeo ---
        if (videoItems.length === 0) {
            console.log("Nenhum vídeo encontrado.");
            return 0;
        }

        console.log("Fase 2: Abrindo vídeos sequencialmente...");
        
        for (currentVideoIndex = 0; currentVideoIndex < videoItems.length; currentVideoIndex++) {
            try {
                // Verifica se está pausado
                while (isPaused) {
                    // Espera 500ms e verifica novamente
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue; // Continua no loop enquanto estiver pausado
                }
                
                const item = videoItems[currentVideoIndex];
                console.log(`Abrindo vídeo ${currentVideoIndex+1}/${videoItems.length}...`);
                
                // Verifica se o item ainda está no DOM
                if (!document.body.contains(item)) {
                    console.log(`Item ${currentVideoIndex+1} não está mais no DOM, pulando...`);
                    continue;
                }

                // Primeiro, garante que nenhum vídeo está aberto
                await closeMediaViewer();
                
                // Rola para garantir que o item esteja visível
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Clica no item para abrir o vídeo
                item.click();
                totalVideosViewed++;
                
                // NOVO: Tenta clicar automaticamente no botão após abrir o vídeo
                const buttonClicked = await autoClickButton();
                console.log(buttonClicked ? "Botão clicado com sucesso!" : "Não foi possível clicar no botão.");
                
                // Espera 5 segundos (VIDEO_VIEW_DURATION) para cada vídeo ser visualizado
                // Usa um sistema de pausa que respeita o status de pausa
                console.log(`Assistindo vídeo por ${VIDEO_VIEW_DURATION/1000} segundos...`);
                await waitWithPauseSupport(VIDEO_VIEW_DURATION);
                
                // Fecha o vídeo atual antes de ir para o próximo
                await closeMediaViewer();
                
                // Pausa entre um vídeo e outro (com suporte à pausa)
                await waitWithPauseSupport(PAUSE_BETWEEN_VIDEOS);
                
                // Verificação periódica - a cada 5 vídeos para não interromper muito o fluxo
                if (currentVideoIndex % 5 === 0 && currentVideoIndex > 0) {
                    console.log(`Progresso: ${currentVideoIndex}/${videoItems.length} (${Math.round(currentVideoIndex/videoItems.length*100)}%)`);
                }
                
            } catch (error) {
                console.error(`Erro ao abrir vídeo ${currentVideoIndex+1}:`, error);
                processingErrors++;
                
                // Tenta fechar qualquer coisa que possa estar aberta
                await closeMediaViewer();
                
                if (processingErrors >= MAX_ALLOWED_ERRORS) {
                    console.error("Muitos erros consecutivos. Interrompendo o processamento.");
                    break;
                }
                
                await waitWithPauseSupport(1000);
            }
        }

        console.log(`Fase 2 concluída. Total de ${totalVideosViewed} vídeos abertos com sucesso.`);
        return totalVideosViewed;
        
    } catch (error) {
        console.error("Erro durante o processamento de vídeos sequenciais:", error);
        throw error;
    }
}

/**
 * Espera um tempo determinado com suporte à pausa.
 * @param {number} ms - Tempo em milissegundos para esperar
 * @returns {Promise<void>}
 */
async function waitWithPauseSupport(ms) {
    const startTime = Date.now();
    let elapsedTime = 0;
    
    while (elapsedTime < ms) {
        if (!isPaused) {
            // Só conta o tempo quando não está pausado
            await new Promise(resolve => setTimeout(resolve, 100));
            elapsedTime = Date.now() - startTime;
        } else {
            // Se estiver pausado, espera sem contar o tempo
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

/**
 * Verifica se estamos em uma página do Telegram Web
 */
function isTelegramWebPage() {
    return window.location.href.includes("web.telegram.org");
}

/**
 * Configura o observador de mutações para adicionar botão quando necessário.
 */
function setupMutationObserver() {
    // Apenas configure o observador se estivermos no Telegram Web
    if (!isTelegramWebPage()) {
        console.log("Não estamos no Telegram Web, observador não será configurado.");
        return;
    }

    console.log("Configurando observador para detectar mudanças no DOM...");
    
    // Configuração inicial - adiciona o botão se a página já estiver carregada
    setTimeout(() => {
        addFloatingButtons();
    }, 3000);

    // Observa modificações no DOM para adicionar botão quando necessário
    const observer = new MutationObserver((mutations) => {
        // Verifica se há mudanças relevantes na página
        const hasRelevantChanges = mutations.some(mutation => {
            return mutation.addedNodes.length > 0 && 
                   Array.from(mutation.addedNodes).some(node => 
                       node.nodeType === 1 && 
                       ((node.classList && node.classList.contains("search-super-container-media")) ||
                        node.querySelector(".search-super-container-media"))
                   );
        });

        if (hasRelevantChanges) {
            console.log("Detectada mudança na exibição de mídia, atualizando botão...");
            addFloatingButtons();
        }
    });

    // Inicia a observação
    observer.observe(document.body, { 
        childList: true, 
        subtree: true
    });
}

// Inicializa o script
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM carregado, inicializando script...");
    setupMutationObserver();
});

// Backup para caso o evento DOMContentLoaded já tenha ocorrido
if (document.readyState === "complete" || document.readyState === "interactive") {
    console.log("DOM já carregado, inicializando script imediatamente...");
    setTimeout(setupMutationObserver, 1000);
} 