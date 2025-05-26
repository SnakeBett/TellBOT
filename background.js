// background.js

console.log("Telegram Bulk Video Downloader: Background script (service worker) started.");

// --- Constants ---
const MAX_CONCURRENT_DOWNLOADS = 3; // Limita o número de downloads simultâneos

// --- Variáveis Globais ---
let downloadQueue = [];
let activeDownloads = 0;

// --- Funções de Download (Adaptadas do script index.iife.js) ---

/**
 * Baixa um arquivo de mídia do Telegram.
 * @param {string} url - A URL do vídeo a ser baixado.
 * @returns {Promise<void>}
 */
async function downloadTelegramMediaFile(url) {
    const chunks = [];
    let receivedLength = 0;
    let totalSize = null;
    let fileExtension = "mp4";
    let finalFilename = "";

    // Tenta extrair um nome de arquivo mais significativo da URL
    if (url.includes("stream/")) {
        const mediaInfo = getMediaInfoFromLink(url);
        if (mediaInfo) {
            finalFilename = mediaInfo.fileName 
                ? mediaInfo.fileName 
                : `${mediaInfo.location.id}.${fileExtension}`;
        }
    } else {
        finalFilename = url.startsWith("blob")
            ? `${url.split("/").pop()}.${fileExtension}`
            : `${Math.random().toString(36).substring(2, 10)}.${fileExtension}`;
    }

    console.log(`Iniciando download de: ${url} como ${finalFilename}`);

    // Função para criar e acionar o download via elemento <a>
    const triggerDownload = () => {
        try {
            const blob = new Blob(chunks, { type: `video/${fileExtension}` });
            
            // Como estamos no background script, precisamos enviar para a tab ativa
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs.length === 0) {
                    console.error("Nenhuma tab ativa encontrada");
                    return;
                }
                
                const url = URL.createObjectURL(blob);
                
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "DOWNLOAD_VIDEO",
                    url: url,
                    filename: finalFilename
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error("Erro ao enviar para tab:", chrome.runtime.lastError);
                    } else {
                        console.log("Download enviado para tab:", response);
                    }
                    // Revoga URL após algum tempo para garantir que o download tenha iniciado
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                });
            });
        } catch (error) {
            console.error("Erro ao criar blob para download:", error);
        }
    };

    // Função recursiva para baixar chunks
    const fetchChunk = async (retryCount = 0, maxRetries = 3) => {
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Range": `bytes=${receivedLength}-`,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });

            // Verifica se a resposta é válida (200 OK ou 206 Partial Content)
            if (![200, 206].includes(response.status)) {
                throw new Error(`Non 200/206 response received: ${response.status}`);
            }

            // Atualiza a extensão do arquivo baseado no Content-Type
            const contentType = response.headers.get("Content-Type");
            if (contentType) {
                const typePart = (contentType.split(";")[0] || "").split("/")[1];
                if (typePart) {
                    fileExtension = typePart;
                    finalFilename = finalFilename.substring(0, finalFilename.indexOf(".") + 1) + fileExtension;
                }
            }

            // Processa Content-Range para determinar o tamanho total
            const contentRange = response.headers.get("Content-Range");
            if (contentRange) {
                const rangeMatch = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
                if (!rangeMatch) {
                    throw new Error("Invalid Content-Range header");
                }
                
                const start = parseInt(rangeMatch[1]);
                const end = parseInt(rangeMatch[2]);
                const total = parseInt(rangeMatch[3]);

                if (start !== receivedLength) {
                    throw new Error("Gap detected between responses.");
                }
                
                if (totalSize && total !== totalSize) {
                    throw new Error("Total size differs");
                }
                
                receivedLength = end + 1;
                totalSize = total;
                
                // Calcula e exibe o progresso
                const progress = Math.round((receivedLength / totalSize) * 100);
                console.log(`Progresso ${finalFilename}: ${progress}% (${receivedLength}/${totalSize} bytes)`);
            }

            // Obtém o chunk como blob e o adiciona ao array
            const chunkBlob = await response.blob();
            chunks.push(chunkBlob);

            // Continua ou finaliza o download
            if (!totalSize || receivedLength < totalSize) {
                await fetchChunk();
            } else {
                triggerDownload();
                console.log(`Download de ${finalFilename} concluído.`);
            }
        } catch (error) {
            console.error(`Erro ao baixar chunk de ${finalFilename}:`, error);
            // Tenta novamente para erros 408 (Request Timeout)
            if (error.message.includes("408") && retryCount < maxRetries) {
                console.log(`Tentando novamente em ${2000}ms...`);
                setTimeout(() => fetchChunk(retryCount + 1, maxRetries), 2000);
            } else if (retryCount < maxRetries) {
                console.log(`Tentando novamente em ${2000}ms... (tentativa ${retryCount + 1})`);
                setTimeout(() => fetchChunk(retryCount + 1, maxRetries), 2000);
            } else {
                console.error(`Falha ao baixar ${finalFilename} após ${maxRetries} tentativas.`);
            }
        }
    };

    // Inicia o processo de download
    await fetchChunk();
}

/**
 * Extrai informações de mídia de uma URL do Telegram.
 * @param {string} url - URL do vídeo
 * @returns {Object|null} - Objeto com informações da mídia ou null
 */
function getMediaInfoFromLink(url) {
    const infoPart = url.substring(url.indexOf("stream/") + 7).split("?")[0];
    try {
        return JSON.parse(decodeURIComponent(infoPart));
    } catch {
        return null;
    }
}

// --- Gerenciamento da Fila ---

/**
 * Processa o próximo item na fila de download, se houver espaço.
 */
function processQueue() {
    while (activeDownloads < MAX_CONCURRENT_DOWNLOADS && downloadQueue.length > 0) {
        activeDownloads++;
        const url = downloadQueue.shift(); // Pega o próximo URL da fila
        console.log(`Pegando ${url} da fila. Downloads ativos: ${activeDownloads}. Fila: ${downloadQueue.length}`);
        
        downloadTelegramMediaFile(url)
            .catch(error => {
                console.error(`Falha no download de ${url}:`, error);
            })
            .finally(() => {
                activeDownloads--;
                console.log(`Download de ${url} finalizado (ou falhou). Downloads ativos: ${activeDownloads}.`);
                processQueue(); // Tenta processar o próximo da fila
            });
    }
}

// --- Listener de Mensagens ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Mensagem recebida:", message);
    
    if (message.type === "DOWNLOAD_VIDEOS" && Array.isArray(message.urls)) {
        console.log(`Adicionando ${message.urls.length} URLs à fila de download.`);
        downloadQueue.push(...message.urls);
        sendResponse({ status: "ok", message: `Received ${message.urls.length} URLs.` });
        processQueue(); // Inicia o processamento da fila
    } 
    else if (message.type === "DOWNLOAD_SINGLE_VIDEO" && message.url) {
        console.log(`Adicionando URL individual à fila de download: ${message.url} (ID: ${message.videoId || 'desconhecido'})`);
        downloadQueue.push(message.url);
        sendResponse({ status: "ok", message: `Received URL for video ${message.videoId || 'unknown'}.` });
        processQueue(); // Inicia o processamento da fila
    }
    else {
        sendResponse({ status: "error", message: "Invalid message format." });
    }
    // Retorna true para indicar que a resposta será enviada de forma assíncrona
    return true; 
});

// --- Listener de Instalação/Atualização (Opcional) ---
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extensão instalada/atualizada.");
});

