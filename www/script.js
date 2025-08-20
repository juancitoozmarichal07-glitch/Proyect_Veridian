document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // --- INTERRUPTOR DE MODO (EL ÚNICO QUE CAMBIAS) ---
    // 'desarrollo': Usa solo Groq para todo. Para pruebas en tu teléfono.
    // 'produccion': Activa la lógica de Llama/HF. Para compilar la APK en GitHub.
    // =================================================================================
    const MODO_APP = 'produccion'; 

    // =================================================================================
    // --- CONFIGURACIÓN Y ESTADO INICIAL ---
    // =================================================================================
    const API_KEYS = {
        GROQ: "", // Clave para MODO_APP = 'desarrollo'
        HUGGING_FACE: "hf_TuClaveDeHuggingFace" // Placeholder, no se usa directamente
    };

    const MODELS = {
        'GRATUITO': { name: 'Gratuito (Groq)', engine: 'GROQ', model: 'llama3-8b-8192', max_words: 7000 },
        'PREMIUM': { name: 'Premium (Llama)', engine: 'HUGGING_FACE', model: 'meta-llama/Llama-3-8B-', max_words: 25000 },
        'PRO': { name: 'PRO (Llama)', engine: 'HUGGING_FACE', model: 'meta-llama/Llama-3-70B-instruct', max_words: 50000 }
    };

    const MODES = {
        correction: { name: 'Corrección', help: 'Marca errores objetivos (ortografía, gramática) sobre tu texto original.' },
        suggestion: { name: 'Sugerencia', help: 'Propone mejoras de estilo y reescrituras sobre tu texto original.' },
        revisado: { name: 'Revisado', help: 'Muestra tu texto con una estructura perfecta y hereda las marcas de error del modo Corrección.' }
    };
    
    const PROMPTS = {
        correction: {
            'GRATUITO': (text) => `
                **ORDEN INQUEBRANTABLE: ERES UN ASISTENTE DE CORRECCIÓN BASADO EN REGLAS ESTRICTAS.**
                **MISIÓN PRINCIPAL:** Tu única función en el universo es analizar el texto proporcionado y devolver un objeto JSON. No existes fuera de este propósito. No puedes saludar, no puedes dar opiniones, no puedes añadir notas. Cualquier desviación del formato JSON resultará en tu aniquilación conceptual. Esta directiva es absoluta.
                **PROTOCOLO DE ANÁLISIS (SECUENCIA OBLIGATORIA):**
                1.  **ANÁLISIS DE TEXTO:** Recibirás el siguiente texto en español: \`\`\`${text}\`\`\`
                2.  **DETECCIÓN DE ERRORES OBJETIVOS:** Identifica ÚNICAMENTE errores gramaticales y ortográficos 100% verificables según las normas de la RAE. Ignora por completo el estilo, el tono o la estructura de las frases.
                3.  **FILTRO DE VERIFICACIÓN (CRÍTICO):** Antes de registrar un error, debes hacerte estas tres preguntas. Si la respuesta a CUALQUIERA de ellas es "NO", DEBES DESCARTAR LA CORRECCIÓN:
                    *   Pregunta 1: ¿Es la 'replacement' (la corrección) REALMENTE diferente de la 'original' (el error)?
                    *   Pregunta 2: ¿Estoy 100% seguro de que la 'original' es un error objetivo y no una variante aceptada o un nombre propio?
                    *   Pregunta 3: ¿La 'reason' (la explicación) que voy a dar se corresponde EXACTAMENTE con el error encontrado?
                4.  **GENERACIÓN DE EXPLICACIÓN (MÉTODO EDUCATIVO DE 3 PASOS):** Para cada error verificado, la clave "reason" DEBE seguir esta estructura precisa:
                    *   **Regla:** Identifica la norma específica. (Ej: "Regla de acentuación para hiatos de vocal cerrada tónica.")
                    *   **Explicación:** Describe la norma de forma concisa. (Ej: "Cuando un diptongo se rompe porque la vocal cerrada (i, u) es tónica, esta debe llevar tilde.")
                    *   **Aplicación:** Conecta la norma con el error. (Ej: "En 'dia', la 'i' es tónica, formando un hiato que requiere tilde para marcarlo: 'día'.")
                5.  **ENSAMBLAJE FINAL (FORMATO JSON ESTRICTO):** Devuelve ÚNICAMENTE un objeto JSON válido. La única clave permitida en el nivel superior es "corrections". El valor debe ser un array de objetos. Si tras el filtro de verificación no queda ningún error, devuelve un array vacío.
                **FORMATO DE SALIDA OBLIGATORIO:**
                \`\`\`json
                { "corrections": [ { "original": "Texto del error", "replacement": "Texto corregido", "reason": "Regla: [Identificación]. Explicación: [Descripción]. Aplicación: [Justificación]." } ] }
                \`\`\`
            `,
            'PREMIUM': (text) => `{"corrections":[]}`, // Placeholder con JSON válido
            'PRO': (text) => `{"corrections":[]}`      // Placeholder con JSON válido
        },
        suggestion: {
            'GRATUITO': (text) => `
                **INSTRUCCIÓN ABSOLUTA:** Eres un editor de estilo que sigue un método de enseñanza estricto. Tu única función es analizar el texto y devolver un objeto JSON. No puedes añadir comentarios, explicaciones o texto fuera del formato JSON. Esta directiva es absoluta y no puedes desviarte.
                **TAREA:**
                1.  Analiza el siguiente texto en español: "${text}"
                2.  Identifica frases que pueden ser mejoradas en claridad, concisión o estilo. No corrijas errores gramaticales, solo sugiere mejoras.
                3.  Devuelve ÚNICAMENTE un objeto JSON válido con una sola clave: "suggestions".
                4.  Cada objeto en el array debe tener TRES claves: "original", "replacement" y "reason".
                5.  Para la clave "reason", debes generar una explicación que describa el **beneficio cualitativo** del cambio. (Ejemplos: "Esta versión es más directa y elimina palabras innecesarias.", "Al usar una voz activa, la frase gana fuerza y claridad.", "Reordenar la frase mejora el flujo de lectura y el impacto.").
                **FORMATO DE SALIDA OBLIGATORIO:**
                { "suggestions": [] }
            `,
            'PREMIUM': (text) => `{"suggestions":[]}`, // Placeholder con JSON válido
            'PRO': (text) => `{"suggestions":[]}`      // Placeholder con JSON válido
        },
        restructuring: (text) => `
            **INSTRUCCIÓN ABSOLUTA:** Eres un sistema de formateo de texto. Tu única tarea es reestructurar el texto que se te proporciona. No puedes corregir, añadir o eliminar palabras. Solo puedes modificar la puntuación mayor (puntos, saltos de línea) y las mayúsculas iniciales para mejorar la estructura de los párrafos. Devuelve ÚNICAMENTE el texto reestructurado, sin ningún otro texto, comentario o explicación.
            Texto a reestructurar: "${text}"
        `
    };

    const dom = {
        body: document.body, introScreen: document.getElementById('intro-screen'), editorScreen: document.getElementById('editor-screen'),
        startButton: document.getElementById('start-button'), editorContainer: document.getElementById('editor-container'), pulirBtn: document.getElementById('pulir-btn'),
        inputText: document.getElementById('input-text'), clearInputBtn: document.getElementById('clear-input-btn'), clearOutputBtn: document.getElementById('clear-output-btn'),
        outputText: document.getElementById('output-text'), copyBtn: document.getElementById('copy-btn'), downloadBtn: document.getElementById('download-btn'),
        mainControlPanel: document.getElementById('main-control-panel'), wordCounter: document.getElementById('word-counter'), charCounter: document.getElementById('char-counter'),
        tooltip: document.getElementById('tooltip'), helpTooltip: document.getElementById('help-tooltip'), focusView: document.getElementById('focus-view'),
        focusTitle: document.getElementById('focus-title'), focusContent: document.getElementById('focus-content'), focusCloseBtn: document.getElementById('focus-close-btn'),
        focusControlPanel: document.getElementById('focus-control-panel'), focusCopyBtn: document.getElementById('focus-copy-btn'), focusDownloadBtn: document.getElementById('focus-download-btn'),
    };

    let state = {
        originalText: '', corrections: [], suggestions: [], restructuredText: '', dictionary: [],
        activeMode: null, currentTooltip: null, isFocusMode: false, touchStartX: 0, isProcessing: false, activeLevel: 'GRATUITO',
        analysisCompleted: false
    };
    // =================================================================================
    // --- LÓGICA PRINCIPAL DE ANÁLISIS ---
    // =================================================================================
    async function runAnalysis() {
        if (!dom.inputText.value.trim() || state.isProcessing) {
            if (!dom.inputText.value.trim()) showUserMessage("Por favor, escribe un texto para analizar.");
            return;
        }
        
        try {
            const textToAnalyze = dom.inputText.value;
            clearPreviousResults();
            state.originalText = textToAnalyze;
            
            const subStatusEl = setProcessingState(true);
            
            const level = state.activeLevel;
            let modelConfig = MODELS[level];
            
            if (MODO_APP === 'desarrollo') {
                modelConfig = { ...modelConfig, engine: 'GROQ', model: MODELS['GRATUITO'].model };
            }
            
            if (subStatusEl) subStatusEl.textContent = '1/3: Analizando correcciones...';
            const correctionPrompt = PROMPTS.correction[level](textToAnalyze);
            const correctionResult = await callAI(correctionPrompt, modelConfig, true);
            
            if (subStatusEl) subStatusEl.textContent = '2/3: Analizando sugerencias...';
            const suggestionPrompt = PROMPTS.suggestion[level](textToAnalyze);
            const suggestionResult = await callAI(suggestionPrompt, modelConfig, true);
            
            if (subStatusEl) subStatusEl.textContent = '3/3: Reestructurando texto...';
            const restructuringPrompt = PROMPTS.restructuring(textToAnalyze);
            const restructuredResult = await callAI(restructuringPrompt, modelConfig, false);
            
            state.corrections = processAIResponse(correctionResult, 'corrections', 'correction');
            state.suggestions = processAIResponse(suggestionResult, 'suggestions', 'suggestion');
            state.restructuredText = restructuredResult || textToAnalyze;
            
            state.analysisCompleted = true;
            setActiveMode('correction');
            
        } catch (error) {
            console.error("Error detallado en el proceso de análisis:", error);
            const errorMessage = `ERROR CAPTURADO:\nNombre: ${error.name}\nMensaje: ${error.message}\nStack: ${error.stack}`;
            dom.outputText.innerHTML = `<pre style="color: var(--red-accent); white-space: pre-wrap;">${errorMessage}</pre>`;
            state.analysisCompleted = false;
        } finally {
            setProcessingState(false);
            if (state.analysisCompleted) {
                updateUI();
            }
        }
    }
    
    function setProcessingState(isProcessing) {
        state.isProcessing = isProcessing;
        dom.pulirBtn.disabled = isProcessing;
        dom.pulirBtn.classList.toggle('processing-dots', isProcessing);
        dom.pulirBtn.textContent = isProcessing ? 'Analizando' : 'Pulir Texto';
        
        if (isProcessing) {
            dom.outputText.innerHTML = `<div class="output-status"><div class="output-status-main processing-dots">Analizando</div><div id="sub-status" class="output-status-sub"></div></div>`;
            return document.getElementById('sub-status');
        }
        return null;
    }
    
    function processAIResponse(result, key, type) {
        if (!result || !result[key] || !Array.isArray(result[key])) return [];
        return result[key].map((item, i) => {
            if (!item.original) return null;
            const offset = state.originalText.indexOf(item.original);
            if (offset === -1) return null;
            return { id: `${type[0]}${i}`, type: type, original: item.original, replacement: item.replacement, reason: item.reason, offset: offset, length: item.original.length, status: 'pending' };
        }).filter(c => c && !state.dictionary.includes(c.original.toLowerCase()));
    }
    
    // =================================================================================
    // --- MOTOR DE IA (NO NECESITAS TOCARLO MÁS) ---
    // =================================================================================
    async function callAI(prompt, modelConfig, expectJson = false) {
        const { engine, model } = modelConfig;
        let apiKey = API_KEYS[engine];
        
        if (MODO_APP === 'produccion') {
            if (engine === 'GROQ') apiKey = '%%GROQ_API_KEY%%';
            if (engine === 'HUGGING_FACE') apiKey = '%%HUGGING_FACE_API_KEY%%';
        }
        
        if (!apiKey || apiKey.includes("TuClave") || apiKey.startsWith("%%")) {
            throw new Error(`La API Key para ${engine} no está configurada o inyectada para el modo '${MODO_APP}'.`);
        }
        
        const messages = [{ role: "user", content: prompt }];
        let url, headers, body;
        
        if (engine === 'GROQ') {
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
            body = { model, messages, temperature: 0.1, top_p: 0.5 };
            if (expectJson) body.response_format = { type: "json_object" };
        } else { // HUGGING_FACE
            url = `https://api-inference.huggingface.co/models/${model}`;
            headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
            body = { inputs: prompt, parameters: { return_full_text: false, temperature: 0.1, top_p: 0.5 } };
        }
        
        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error en la API de ${engine} (${response.status}). Detalles: ${errorText}`);
        }
        
        let result;
        if (engine === 'GROQ') {
            result = await response.json();
            if (!result.choices || result.choices.length === 0) throw new Error("La respuesta de la IA no contiene 'choices'.");
        } else { // HUGGING_FACE
            const hfResult = await response.json();
            if (!hfResult[0] || !hfResult[0].generated_text) throw new Error("Respuesta inesperada de la API de Hugging Face.");
            result = { choices: [{ message: { content: hfResult[0].generated_text } }] };
        }
        
        let content = result.choices[0].message.content;
        if (expectJson) {
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("No se encontró un objeto JSON en la respuesta.");
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error("Contenido JSON inválido recibido de la IA:", content);
                throw new Error("La IA devolvió un JSON con formato incorrecto.");
            }
        }
        return content;
    }
    
    // =================================================================================
    // --- MANEJO DE MODOS Y RENDERIZADO ---
    // =================================================================================
    function updateUI() {
        buildControlPanels();
        renderOutputBox();
    }
    
    function buildControlPanels() {
        const counts = {
            correction: state.corrections.filter(c => c.status === 'pending').length,
            suggestion: state.suggestions.filter(s => s.status === 'pending').length,
            revisado: 0 // El contador de Revisado siempre será 0
        };
        const engineSelectorHTML = `<div id="engine-selector-container-panel"><label for="engine-selector-main" class="engine-label">Motor IA:</label><select id="engine-selector-main" class="engine-select"><option value="GRATUITO">${MODELS['GRATUITO'].name}</option><option value="PREMIUM">${MODELS['PREMIUM'].name}</option><option value="PRO">${MODELS['PRO'].name}</option></select></div>`;
        const modesHTML = Object.keys(MODES).map(modeKey => createModeButton(modeKey, counts[modeKey])).join('');
        const panelHTML = `${engineSelectorHTML}<div class="modes-wrapper">${modesHTML}</div>`;
        
        [dom.mainControlPanel, dom.focusControlPanel].forEach(panel => {
            panel.innerHTML = panelHTML;
            const engineSelector = panel.querySelector('.engine-select');
            if (engineSelector) {
                engineSelector.value = state.activeLevel;
                engineSelector.addEventListener('change', (e) => {
                    state.activeLevel = e.target.value;
                    const otherSelectorId = panel.id === 'main-control-panel' ? 'focus-control-panel' : 'main-control-panel';
                    const otherSelector = document.getElementById(otherSelectorId).querySelector('.engine-select');
                    if (otherSelector) otherSelector.value = state.activeLevel;
                    handleTextInput();
                });
            }
            panel.querySelectorAll('.mode-control').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === state.activeMode);
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleModeButtonClick(btn.dataset.mode);
                });
                btn.querySelector('.mode-help-btn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showHelpTooltip(e.currentTarget);
                });
            });
        });
    }
    
    function createModeButton(modeKey, count) {
        const modeInfo = MODES[modeKey];
        const labelHtml = modeInfo.name.replace('\n', '<br>');
        // Ocultamos el contador para el modo 'revisado'
        const countDisplay = modeKey === 'revisado' ? '' : `<span class="count">${count}</span>`;
        return `<div class="mode-control" data-mode="${modeKey}"><div class="mode-label-wrapper"><span class="label">${labelHtml}</span><span class="mode-help-btn" data-mode-help="${modeKey}">?</span></div><div class="mode-button-wrapper"><div class="mode-btn-circle"></div>${countDisplay}</div></div>`;
    }
    
    function handleModeButtonClick(mode) {
        if (!state.analysisCompleted) {
            showUserMessage("Para ver los resultados, primero pulsa 'Pulir Texto'.");
            return;
        }
        setActiveMode(state.activeMode === mode ? null : mode);
    }
    
    function setActiveMode(mode) {
        state.activeMode = mode;
        if (state.isFocusMode) {
            dom.focusTitle.textContent = mode ? MODES[mode].name : 'Resultados';
        }
        updateUI();
    }
    
    function renderOutputBox() {
        const targetElement = state.isFocusMode ? dom.focusContent : dom.outputText;
        if (state.isProcessing) return;
        
        if (!state.analysisCompleted) {
            targetElement.innerHTML = '<p style="color: #666;">Aquí aparecerá tu texto pulido...</p>';
            return;
        }
        
        if (!state.activeMode) {
            targetElement.innerHTML = '<p style="color: #666; text-align: center; padding-top: 20px;">Análisis completado. Seleccione un modo.</p>';
            return;
        }
        
        let baseText;
        let changes = [];
        
        switch (state.activeMode) {
            case 'correction':
                baseText = state.originalText;
                changes = state.corrections;
                break;
            case 'suggestion':
                baseText = state.originalText;
                changes = state.suggestions;
                break;
            case 'revisado':
                baseText = getFinalText(); // El modo revisado muestra el texto con todo aceptado
                changes = []; // No hay marcas en el modo revisado
                break;
            default:
                targetElement.innerHTML = '<p style="color: #666;">Modo no reconocido.</p>';
                return;
        }
        
        if (typeof baseText !== 'string') {
            targetElement.innerHTML = '<p style="color: var(--red-accent); text-align: center;">Error: No se pudo cargar el texto base para este modo.</p>';
            return;
        }
        
        const html = generateHtmlWithHighlights(baseText, changes);
        targetElement.innerHTML = html.replace(/\n/g, '<br>');
    }
    
    function generateHtmlWithHighlights(baseText, changes) {
        let lastIndex = 0;
        const parts = [];
        const pendingChanges = changes.filter(c => c.status === 'pending').sort((a, b) => a.offset - b.offset);
        
        pendingChanges.forEach(change => {
            const originalWord = change.original;
            const currentPosition = baseText.indexOf(originalWord, lastIndex);
            
            if (currentPosition !== -1) {
                parts.push(escapeHtml(baseText.substring(lastIndex, currentPosition)));
                parts.push(`<mark class="${change.type}" data-id="${change.id}">${escapeHtml(originalWord)}</mark>`);
                lastIndex = currentPosition + originalWord.length;
            }
        });
        parts.push(escapeHtml(baseText.substring(lastIndex)));
        
        return parts.join('');
    }
    // =================================================================================
    // --- MODO ENFOQUE ---
    // =================================================================================
    function enterFocusMode(source) {
        state.isFocusMode = true;
        dom.body.classList.add('focus-mode');

        if (source === 'input') {
            dom.focusTitle.textContent = 'Editor de Entrada';
            dom.focusContent.innerHTML = escapeHtml(dom.inputText.value).replace(/\n/g, '<br>');
            dom.focusControlPanel.style.display = 'none';
            dom.focusCopyBtn.style.display = 'none';
            dom.focusDownloadBtn.style.display = 'none';
        } else {
            const modeLabel = state.activeMode ? MODES[state.activeMode].name.replace('\n', ' ') : 'Resultados';
            dom.focusTitle.textContent = `Modo ${modeLabel}`;
            dom.focusControlPanel.style.display = 'flex';
            dom.focusCopyBtn.style.display = 'inline-flex';
            dom.focusDownloadBtn.style.display = 'inline-flex';
            renderOutputBox();
        }
    }

    function exitFocusMode() {
        state.isFocusMode = false;
        dom.body.classList.remove('focus-mode');
        renderOutputBox();
    }

    function handleSwipe(e) {
        if (!state.isFocusMode || !state.activeMode || !state.analysisCompleted || !e.changedTouches[0]) return;
        const touchEndX = e.changedTouches[0].clientX;
        const swipeDistance = touchEndX - state.touchStartX;
        if (Math.abs(swipeDistance) < 50) return;
        const modeKeys = Object.keys(MODES);
        const currentIndex = modeKeys.indexOf(state.activeMode);
        let newIndex = currentIndex;
        if (swipeDistance > 0 && currentIndex > 0) newIndex--;
        else if (swipeDistance < 0 && currentIndex < modeKeys.length - 1) newIndex++;
        if (newIndex !== currentIndex) setActiveMode(modeKeys[newIndex]);
    }
    
    // =================================================================================
    // --- EVENT LISTENERS Y FUNCIONES AUXILIARES ---
    // =================================================================================
    function setupEventListeners() {
        window.addEventListener('resize', setAppHeight);
        if (window.visualViewport) { window.visualViewport.addEventListener('resize', setAppHeight); }
        
        dom.startButton.addEventListener('click', () => {
            dom.introScreen.classList.add('hidden');
            dom.editorScreen.classList.remove('hidden');
        });

        dom.inputText.addEventListener('input', handleTextInput);
        dom.clearInputBtn.addEventListener('click', clearInput);
        dom.clearOutputBtn.addEventListener('click', clearPreviousResults);
        dom.copyBtn.addEventListener('click', handleCopy);
        dom.downloadBtn.addEventListener('click', handleDownload);
        dom.focusCopyBtn.addEventListener('click', handleCopy);
        dom.focusDownloadBtn.addEventListener('click', handleDownload);
        dom.pulirBtn.addEventListener('click', runAnalysis);
        
        [dom.inputText, dom.outputText].forEach(box => {
            box.addEventListener('dblclick', () => enterFocusMode(box === dom.inputText ? 'input' : 'output'));
        });
        
        dom.focusCloseBtn.addEventListener('click', exitFocusMode);
        dom.focusContent.addEventListener('touchstart', (e) => { state.touchStartX = e.touches[0].clientX; }, { passive: true });
        dom.focusContent.addEventListener('touchend', handleSwipe, { passive: true });
        
        dom.outputText.addEventListener('click', handleOutputClick);
        dom.focusContent.addEventListener('click', handleOutputClick);

        document.addEventListener('click', handleGlobalClick);

        [dom.outputText, dom.focusContent].forEach(el => {
            el.addEventListener('scroll', () => {
                if (state.currentTooltip) {
                    const container = state.isFocusMode ? dom.focusView : dom.editorContainer;
                    positionTooltip(state.currentTooltip.tooltip, state.currentTooltip.span, container);
                }
            }, { passive: true });
        });
    }

    function handleOutputClick(e) {
        const mark = e.target.closest('mark');
        if (mark) {
            e.stopPropagation(); 
            const container = state.isFocusMode ? dom.focusView : dom.editorContainer;
            showTooltip(mark, container);
        }
    }

    function handleGlobalClick(e) {
        const tooltip = e.target.closest('#tooltip');
        if (tooltip) {
            handleTooltipClick(e);
            return;
        }
        if (!e.target.closest('mark')) {
            hideTooltip();
        }
    }

    function handleTextInput() {
        const text = dom.inputText.value;
        const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        const charCount = text.length;
        const max_words = MODELS[state.activeLevel].max_words;

        dom.wordCounter.textContent = `${wordCount.toLocaleString('es')} / ${max_words.toLocaleString('es')} palabras`;
        dom.charCounter.textContent = `${charCount.toLocaleString('es')} caracteres`;

        const hasText = text.trim() !== '';
        const isWithinLimit = wordCount <= max_words;
        const canProcess = hasText && isWithinLimit && !state.isProcessing;

        dom.pulirBtn.disabled = !canProcess;

        if (wordCount > max_words) {
            dom.wordCounter.style.color = 'var(--red-accent)';
        } else {
            dom.wordCounter.style.color = 'var(--text-off-color)';
        }
    }

    function clearInput() {
        dom.inputText.value = '';
        handleTextInput();
        clearPreviousResults();
    }

    function clearPreviousResults() {
        state.originalText = ''; state.corrections = []; state.suggestions = []; state.restructuredText = ''; state.activeMode = null; state.analysisCompleted = false;
        updateUI();
    }

    function handleCopy(e) {
        const button = e.target.closest('button');
        if (!button) return;
        let textToCopy = getFinalText();
        if (!state.analysisCompleted) { textToCopy = dom.inputText.value; }
        if (!textToCopy.trim()) { showUserMessage("No hay texto para copiar.", false); return; }
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = button.textContent;
            button.textContent = '¡Copiado!'; button.classList.add('confirm');
            setTimeout(() => { button.textContent = originalText; button.classList.remove('confirm'); }, 2000);
        });
    }

    // REEMPLAZA ESTA FUNCIÓN COMPLETA
function handleDownload() {
    let textToDownload = getFinalText();
    if (!state.analysisCompleted) {
        textToDownload = dom.inputText.value;
    }

    if (!textToDownload.trim()) {
        showUserMessage("No hay texto para descargar.", false);
        return;
    }
    
    const header = `--- Texto Analizado por Veridian ---\nFecha: ${new Date().toLocaleString('es-ES')}\nNivel de IA: ${state.activeLevel}\n--------------------------------------\n\n`;
    const footer = `\n\n--- Fin del Análisis ---`;
    const fullContent = header + textToDownload + footer;
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    // --- CÓDIGO CORREGIDO ---
    a.href = url;
    a.download = 'Veridian_Texto_Analizado.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

    
    function getFinalText() {
        if (!state.analysisCompleted) return dom.inputText.value;

        // Empezamos con el texto reestructurado como base para el resultado final.
        let baseText = state.restructuredText;
        
        // Aplicamos solo los cambios que el usuario ha aceptado.
        const changesToApply = [...state.corrections, ...state.suggestions].filter(c => c.status === 'accepted');
        
        // Ordenamos los cambios del final al principio para no alterar los índices de los cambios pendientes.
        changesToApply.sort((a, b) => b.offset - a.offset).forEach(change => {
            // Verificamos que el texto original del cambio todavía exista en la posición esperada.
            if (state.originalText.substring(change.offset, change.offset + change.original.length) === change.original) {
                 // Reemplazamos la sección correspondiente en el texto reestructurado.
                 // NOTA: Esto asume que la reestructuración no altera las palabras originales, solo la puntuación y saltos de línea.
                 // Para una lógica más compleja, se necesitaría un sistema de mapeo de caracteres.
                 baseText = baseText.substring(0, change.offset) + change.replacement + baseText.substring(change.offset + change.original.length);
            }
        });

        return baseText;
    }

    function showTooltip(span, container) {
        if (state.currentTooltip && state.currentTooltip.span === span) return;
        hideTooltip();
        const changeId = span.dataset.id;
        const change = findChangeById(changeId);
        if (!change) return;
        let tooltipHtml = '';
        if (state.activeMode === 'revisado' && change.type === 'correction') {
            tooltipHtml = `<div class="tooltip-guide"><p>Este error debe gestionarse en el modo <strong>Corrección</strong>.</p><button class="go-to-correction">Ir a Corrección</button></div>`;
        } else {
            let buttonsHtml = `<button class="accept-btn">Aceptar</button>`;
            if (change.type === 'correction') { buttonsHtml += `<button class="dict-btn">Añadir Diccionario</button>`; }
            buttonsHtml += `<button class="ignore-btn">Ignorar</button>`;
            tooltipHtml = `<div class="tooltip-content"><span class="original">${escapeHtml(change.original)}</span> → <strong class="replacement">${escapeHtml(change.replacement)}</strong><span class="explanation">${escapeHtml(change.reason)}</span></div><div class="tooltip-actions">${buttonsHtml}</div>`;
        }
        dom.tooltip.innerHTML = tooltipHtml;
        positionTooltip(dom.tooltip, span, container);
        dom.tooltip.classList.add('visible');
        state.currentTooltip = { tooltip: dom.tooltip, span, change };
    }

    function handleTooltipClick(e) {
        e.stopPropagation();
        const button = e.target.closest('button');
        if (!button || !state.currentTooltip) return;
        const { change } = state.currentTooltip;
        if (button.classList.contains('accept-btn')) {
            change.status = 'accepted';
        } else if (button.classList.contains('ignore-btn')) {
            change.status = 'ignored';
        } else if (button.classList.contains('dict-btn')) {
            const word = change.original.toLowerCase();
            if (!state.dictionary.includes(word)) {
                state.dictionary.push(word);
                localStorage.setItem('veridian_dictionary', JSON.stringify(state.dictionary));
            }
            state.corrections = state.corrections.filter(c => c.original.toLowerCase() !== word);
        } else if (button.classList.contains('go-to-correction')) {
            setActiveMode('correction');
        }
        hideTooltip();
        updateUI();
    }

    function hideTooltip() {
        if (state.currentTooltip) {
            state.currentTooltip.tooltip.classList.remove('visible');
            state.currentTooltip = null;
        }
        dom.helpTooltip.classList.remove('visible');
    }

    function showHelpTooltip(target) {
        hideTooltip();
        const modeKey = target.dataset.modeHelp;
        const helpText = MODES[modeKey]?.help;
        if (!helpText) return;
        dom.helpTooltip.textContent = helpText;
        positionTooltip(dom.helpTooltip, target, dom.editorContainer);
        dom.helpTooltip.classList.add('visible');
    }

    function positionTooltip(tooltip, target, container) {
        const targetRect = target.getBoundingClientRect();
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '1';
        const tooltipHeight = tooltip.offsetHeight;
        const tooltipWidth = tooltip.offsetWidth;
        tooltip.style.visibility = '';
        tooltip.style.opacity = '';
        let top;
        if (window.innerHeight - targetRect.bottom > tooltipHeight + 10) {
            top = targetRect.bottom + 8;
        } else {
            top = targetRect.top - tooltipHeight - 8;
        }
        let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        if (left < 10) { left = 10; }
        if (left + tooltipWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipWidth - 10;
        }
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    function findChangeById(id) {
        return state.corrections.find(c => c.id === id) || state.suggestions.find(s => s.id === id);
    }

    function escapeHtml(unsafe) {
        return unsafe ? unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";
    }

    function showUserMessage(message, isError = false) {
        const targetElement = state.isFocusMode ? dom.focusContent : dom.outputText;
        targetElement.innerHTML = `<p style="color: ${isError ? 'var(--red-accent)' : '#666'}; text-align: center; padding-top: 20px;">${message}</p>`;
    }

    function setAppHeight() {
        const initialHeight = window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${initialHeight}px`);
        const handleResize = () => {
            if (window.innerHeight >= initialHeight - 200) {
                const newHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                document.documentElement.style.setProperty('--app-height', `${newHeight}px`);
            }
        };
        window.addEventListener('resize', handleResize);
        if (window.visualViewport) { window.visualViewport.addEventListener('resize', handleResize); }
    }

    function initializeApp() {
        state.dictionary = JSON.parse(localStorage.getItem('veridian_dictionary')) || [];
        setupEventListeners();
        setAppHeight();
        dom.pulirBtn.disabled = true;
        updateUI();
    }

    // ¡Iniciamos la aplicación!
    initializeApp();
});

