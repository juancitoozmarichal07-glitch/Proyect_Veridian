document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // --- CONFIGURACIÓN Y ESTADO INICIAL ---
    // =================================================================================

    const API_KEYS = {
        GROQ: "gsk_xxxx", // Reemplaza con tu clave de Groq
        HUGGING_FACE: "hf_xxxx" // Reemplaza con tu clave de Hugging Face
    };

    const MODELS = {
        'GRATUITO': { name: 'Gratuito (Groq)', engine: 'GROQ', model: 'llama3-8b-8192', max_words: 7000 },
        'PREMIUM': { name: 'Premium (HF Llama-8b)', engine: 'HUGGING_FACE', model: 'meta-llama/Llama-3-8b-chat-hf', max_words: 25000 },
        'PRO': { name: 'PRO (HF Llama-70b)', engine: 'HUGGING_FACE', model: 'meta-llama/Llama-3-70b-chat-hf', max_words: 50000 }
    };

    const MODES = {
        correction: { name: 'Corrección', help: 'Encuentra y corrige errores gramaticales, de puntuación y ortografía.' },
        suggestion: { name: 'Sugerencia', help: 'Propone mejoras de estilo, claridad y fluidez para refinar la redacción.' },
        revisado: { name: 'Revisado', help: 'Muestra una versión reescrita por la IA. Las correcciones deben aceptarse en el modo "Corrección".' }
    };
    
    const PROMPTS = {
        correction: {
            'GRATUITO': (text) => `Eres un corrector de español. Devuelve un objeto JSON con una clave "corrections", que sea un array de objetos. Cada objeto debe tener "original", "replacement" y "reason". Ejemplo: {"original": "habian", "replacement": "habían", "reason": "Lleva tilde para marcar el hiato."}. Texto: "${text}"`,
            'PREMIUM': (text) => `Eres un tutor de gramática española. Explica errores de forma concisa y educativa. Para cada error, proporciona una explicación clara de la regla gramatical. REGLAS: 1. NUNCA uses frases genéricas. 2. SIEMPRE explica la regla específica. Devuelve un objeto JSON con una única clave "corrections", que sea un array de objetos. Cada objeto debe tener "original", "replacement" y "reason". Texto: "${text}"`,
            'PRO': (text) => `Eres un catedrático de la Real Academia Española. Realiza un análisis forense de cada error gramatical. Proporciona una explicación magistral que revele no solo la regla, sino su origen. Devuelve un objeto JSON con una única clave "corrections", que sea un array de objetos. Cada objeto debe tener "original", "replacement" y "reason". Texto: "${text}"`
        },
        suggestion: {
            'GRATUITO': (text) => `Eres un editor de español. Sugiere mejoras de estilo. Devuelve un JSON con una clave "suggestions", que sea una lista de objetos. Cada objeto debe tener "original", "replacement" y "reason". Si no hay sugerencias, devuelve {"suggestions": []}. Texto: "${text}"`,
            'PREMIUM': (text) => `Eres un editor experto en español. Analiza y sugiere mejoras de estilo y claridad. Devuelve un JSON con una clave "suggestions". La explicación debe ser educativa. Si no hay sugerencias, devuelve {"suggestions": []}. Texto: "${text}"`,
            'PRO': (text) => `Eres un editor literario. Eleva el texto a su máximo potencial. Devuelve un JSON con una clave "suggestions". Para cada sugerencia, la "reason" debe ser un análisis en tres partes: 1. Diagnóstico. 2. Propuesta. 3. Impacto. Si no hay sugerencias, devuelve {"suggestions": []}. Texto: "${text}"`
        },
        final_review: (text) => `Pule el siguiente texto para mejorar su fluidez, coherencia y estilo, sin cambiar el significado. Devuelve únicamente el texto pulido final.`
    };

    const dom = {
        body: document.body,
        introScreen: document.getElementById('intro-screen'),
        editorScreen: document.getElementById('editor-screen'),
        startButton: document.getElementById('start-button'),
        editorContainer: document.getElementById('editor-container'),
        pulirBtn: document.getElementById('pulir-btn'),
        inputText: document.getElementById('input-text'),
        clearInputBtn: document.getElementById('clear-input-btn'),
        clearOutputBtn: document.getElementById('clear-output-btn'),
        outputText: document.getElementById('output-text'),
        copyBtn: document.getElementById('copy-btn'),
        downloadBtn: document.getElementById('download-btn'),
        mainControlPanel: document.getElementById('main-control-panel'),
        wordCounter: document.getElementById('word-counter'),
        charCounter: document.getElementById('char-counter'),
        tooltip: document.getElementById('tooltip'),
        helpTooltip: document.getElementById('help-tooltip'),
        focusView: document.getElementById('focus-view'),
        focusTitle: document.getElementById('focus-title'),
        focusContent: document.getElementById('focus-content'),
        focusCloseBtn: document.getElementById('focus-close-btn'),
        focusControlPanel: document.getElementById('focus-control-panel'),
        focusCopyBtn: document.getElementById('focus-copy-btn'),
        focusDownloadBtn: document.getElementById('focus-download-btn'),
    };

    let state = {
        originalText: '',
        corrections: [],
        suggestions: [],
        revisadoText: '',
        dictionary: [],
        activeMode: null,
        currentTooltip: null,
        isFocusMode: false,
        touchStartX: 0,
        isProcessing: false,
        activeLevel: 'GRATUITO',
    };

    // =================================================================================
    // --- LÓGICA PRINCIPAL DE ANÁLISIS ---
    // =================================================================================

    async function runAnalysis() {
        state.originalText = dom.inputText.value;
        if (!state.originalText.trim() || state.isProcessing) return;

        setProcessingState(true);
        clearOutput();
        state.originalText = dom.inputText.value;

        const subStatusEl = document.getElementById('sub-status');

        try {
            const level = state.activeLevel;
            const modelConfig = MODELS[level];

            subStatusEl.textContent = '1/3: Buscando correcciones...';
            const correctionPrompt = PROMPTS.correction[level](state.originalText);
            const correctionResult = await callAI(correctionPrompt, modelConfig, true);
            state.corrections = processAIResponse(correctionResult, 'corrections', 'correction');

            subStatusEl.textContent = '2/3: Buscando sugerencias...';
            const suggestionPrompt = PROMPTS.suggestion[level](state.originalText);
            const suggestionResult = await callAI(suggestionPrompt, modelConfig, true);
            state.suggestions = processAIResponse(suggestionResult, 'suggestions', 'suggestion');

            subStatusEl.textContent = '3/3: Realizando pulido final...';
            const finalReviewPrompt = PROMPTS.final_review(state.originalText);
            state.revisadoText = await callAI(finalReviewPrompt, modelConfig, false);

            setActiveMode('correction');

        } catch (error) {
            console.error("Error en el proceso de análisis:", error);
            dom.outputText.innerHTML = `<p style="color: var(--red-accent); text-align: center;">${error.message}</p>`;
        } finally {
            setProcessingState(false);
        }
    }

    function setProcessingState(isProcessing) {
        state.isProcessing = isProcessing;
        dom.pulirBtn.disabled = isProcessing;
        dom.pulirBtn.classList.toggle('processing-dots', isProcessing);
        dom.pulirBtn.textContent = isProcessing ? 'Analizando' : 'Pulir Texto';

        if (isProcessing) {
            dom.outputText.innerHTML = `<div class="output-status"><div class="output-status-main processing-dots">Analizando</div><div id="sub-status" class="output-status-sub"></div></div>`;
        }
    }

    function processAIResponse(result, key, type) {
        if (!result || !result[key] || !Array.isArray(result[key])) {
            console.warn(`Respuesta de IA inválida o vacía para la clave "${key}"`);
            return [];
        }
        return result[key].map((item, i) => {
            const offset = state.originalText.indexOf(item.original);
            if (offset === -1) return null;
            return {
                id: `${type[0]}${i}`, type: type,
                original: item.original, replacement: item.replacement,
                reason: item.reason, offset: offset,
                length: item.original.length, status: 'pending'
            };
        }).filter(Boolean);
    }

    // =================================================================================
    // --- MOTOR DE IA ---
    // =================================================================================

    async function callAI(prompt, modelConfig, expectJson = false) {
        const { engine, model } = modelConfig;
        const apiKey = API_KEYS[engine];
        if (!apiKey || apiKey.includes("xxxx")) {
            throw new Error(`La API Key para ${engine} no está configurada.`);
        }

        let url, headers, body;
        const messages = [{ role: "user", content: prompt }];

        if (engine === 'GROQ') {
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
            body = { model, messages, temperature: 0.3 };
            if (expectJson) body.response_format = { type: "json_object" };
        } else if (engine === 'HUGGING_FACE') {
            url = `https://api-inference.huggingface.co/models/${model}`;
            headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
            const hfPrompt = expectJson ? `${prompt} Devuelve solo el objeto JSON.` : prompt;
            body = { inputs: hfPrompt, parameters: { return_full_text: false, max_new_tokens: 2048 } };
        } else {
            throw new Error("Motor de IA no reconocido.");
        }

        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error en la API (${engine}):`, errorText);
            throw new Error(`Error en la API de ${engine} (código: ${response.status}).`);
        }
        
        const result = await response.json();
        let content = '';

        if (engine === 'GROQ') {
            content = result.choices[0].message.content;
        } else if (engine === 'HUGGING_FACE') {
            content = result[0].generated_text;
        }

        if (expectJson) {
            try {
                const jsonString = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
                return JSON.parse(jsonString);
            } catch (e) {
                console.error("Error al parsear JSON de la IA:", content);
                throw new Error("La IA devolvió una respuesta JSON inválida.");
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
            revisado: state.corrections.filter(c => c.status === 'pending').length
        };

        const engineSelectorHTML = `
            <div id="engine-selector-container-panel">
                <label for="engine-selector-main" class="engine-label">Motor IA:</label>
                <select id="engine-selector-main" class="engine-select">
                    <option value="GRATUITO">${MODELS['GRATUITO'].name}</option>
                    <option value="PREMIUM">${MODELS['PREMIUM'].name}</option>
                    <option value="PRO">${MODELS['PRO'].name}</option>
                </select>
            </div>`;

        const modesHTML = Object.keys(MODES).map(modeKey => createModeButton(modeKey, counts[modeKey])).join('');
        
        const panelHTML = `${engineSelectorHTML}<div class="modes-wrapper">${modesHTML}</div>`;

        [dom.mainControlPanel, dom.focusControlPanel].forEach(panel => {
            panel.innerHTML = panelHTML;

            const engineSelector = panel.querySelector('.engine-select');
            if (engineSelector) {
                engineSelector.value = state.activeLevel;
                engineSelector.addEventListener('change', (e) => {
                    state.activeLevel = e.target.value;
                    const otherSelector = (panel === dom.mainControlPanel ? dom.focusControlPanel : dom.mainControlPanel).querySelector('.engine-select');
                    if (otherSelector) otherSelector.value = state.activeLevel;
                    handleTextInput();
                });
            }

            panel.querySelectorAll('.mode-control').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === state.activeMode);
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const mode = btn.dataset.mode;
                    setActiveMode(state.activeMode === mode ? null : mode);
                });
                btn.querySelector('.mode-help-btn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showHelpTooltip(e.currentTarget.closest('.mode-control'));
                });
            });
        });
    }

    function createModeButton(modeKey, count) {
        const modeInfo = MODES[modeKey];
        const labelHtml = modeInfo.name.replace('\n', '<br>');
        return `
            <div class="mode-control" data-mode="${modeKey}">
                <div class="mode-label-wrapper">
                    <span class="label">${labelHtml}</span>
                    <span class="mode-help-btn" data-mode-help="${modeKey}">?</span>
                </div>
                <div class="mode-button-wrapper">
                    <div class="mode-btn-circle"></div>
                    <span class="count">${count}</span>
                </div>
            </div>`;
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
        if (!state.originalText) {
            targetElement.innerHTML = '<p style="color: #666;">Aquí aparecerá tu texto pulido...</p>';
            return;
        }
        if (!state.activeMode) {
            targetElement.innerHTML = '<p style="color: #666; text-align: center; padding-top: 20px;">Análisis completado. Seleccione un modo.</p>';
            return;
        }

        let html = '';
        const acceptedChanges = [...state.corrections, ...state.suggestions].filter(c => c.status === 'accepted');
        
        if (state.activeMode === 'correction') {
            let baseText = applyChanges(state.originalText, acceptedChanges);
            html = generateHtmlWithHighlights(baseText, state.corrections.filter(c => c.status === 'pending'), 'correction');
        } else if (state.activeMode === 'suggestion') {
            let baseText = applyChanges(state.originalText, acceptedChanges);
            html = generateHtmlWithHighlights(baseText, state.suggestions.filter(s => s.status === 'pending'), 'suggestion');
        } else if (state.activeMode === 'revisado') {
            let baseText = applyChanges(state.revisadoText || state.originalText, acceptedChanges);
            html = generateHtmlWithHighlights(baseText, state.corrections.filter(c => c.status === 'pending'), 'correction');
        }
        targetElement.innerHTML = html.replace(/\n/g, '<br>');
    }

    function generateHtmlWithHighlights(baseText, changes, type) {
        let parts = [];
        let lastIndex = 0;
        const sortedChanges = [...changes].sort((a, b) => a.offset - b.offset);
        sortedChanges.forEach(change => {
            parts.push(escapeHtml(baseText.substring(lastIndex, change.offset)));
            parts.push(`<span class="${type}" data-id="${change.id}">${escapeHtml(baseText.substring(change.offset, change.offset + change.length))}</span>`);
            lastIndex = change.offset + change.length;
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
        updateUI();
    }

    function exitFocusMode() {
        state.isFocusMode = false;
        dom.body.classList.remove('focus-mode');
        renderOutputBox();
    }

    function handleSwipe(e) {
        if (!state.isFocusMode || !state.activeMode) return;
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
        dom.clearOutputBtn.addEventListener('click', clearOutput);
        
        dom.copyBtn.addEventListener('click', handleCopy);
        dom.downloadBtn.addEventListener('click', handleDownload);
        dom.focusCopyBtn.addEventListener('click', handleCopy);
        dom.focusDownloadBtn.addEventListener('click', handleDownload);
        
        dom.pulirBtn.addEventListener('click', runAnalysis);
        
        // MODO ENFOQUE: Event listeners de doble click
        [dom.inputText, dom.outputText].forEach(box => {
            box.addEventListener('dblclick', () => enterFocusMode(box === dom.inputText ? 'input' : 'output'));
        });
        dom.focusCloseBtn.addEventListener('click', exitFocusMode);
        
        // MODO ENFOQUE: Event listeners de swipe
        dom.focusContent.addEventListener('touchstart', (e) => { state.touchStartX = e.touches[0].clientX; }, { passive: true });
        dom.focusContent.addEventListener('touchend', handleSwipe, { passive: true });
        
        document.addEventListener('click', handleGlobalClick);
        
        [dom.outputText, dom.focusContent].forEach(el => {
            el.addEventListener('scroll', () => {
                if (state.currentTooltip) positionTooltip(state.currentTooltip.tooltip, state.currentTooltip.span, state.isFocusMode ? dom.focusView : dom.editorContainer);
            }, { passive: true });
        });
    }

   function handleTextInput() {
    const text = dom.inputText.value;
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const charCount = text.length;
    
    // --- ESTA ES LA LÓGICA NUEVA ---
    // 1. Obtiene el nivel de motor activo desde el estado de la aplicación.
    const activeModelConfig = MODELS[state.activeLevel];
    // 2. Lee el límite máximo de palabras para ese nivel.
    const max_words = activeModelConfig.max_words;

    // 3. Actualiza el contador en la UI con el límite correcto y formato de miles.
    dom.wordCounter.textContent = `${wordCount.toLocaleString('es')} / ${max_words.toLocaleString('es')} palabras`;
    dom.charCounter.textContent = `${charCount.toLocaleString('es')} caracteres`;
    
    // 4. Comprueba si se ha superado el límite y deshabilita el botón si es necesario.
    if (wordCount > max_words || text.trim() === '') {
        dom.wordCounter.style.color = wordCount > max_words ? 'var(--red-accent)' : 'var(--text-off-color)';
        dom.pulirBtn.disabled = true;
    } else {
        dom.wordCounter.style.color = 'var(--text-off-color)';
        dom.pulirBtn.disabled = state.isProcessing;
    }
}


    function clearInput() {
        dom.inputText.value = '';
        handleTextInput();
    }

    function clearOutput() {
        state.originalText = '';
        state.corrections = [];
        state.suggestions = [];
        state.revisadoText = '';
        state.activeMode = null;
        dom.outputText.innerHTML = '<p style="color: #666;">Aquí aparecerá tu texto pulido...</p>';
        updateUI();
    }

    function handleCopy(e) {
        const button = e.target;
        const textToCopy = getFinalText();
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = button.textContent;
            button.textContent = '¡Copiado!';
            button.classList.add('confirm');
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('confirm');
            }, 2000);
        });
    }

    function handleDownload() {
        const textToDownload = getFinalText();
        if (!textToDownload) return;
        const header = `--- Texto Analizado por Veridian ---\nFecha: ${new Date().toLocaleString('es-ES')}\nNivel de IA: ${state.activeLevel}\n--------------------------------------\n\n`;
        const footer = `\n\n--- Fin del Análisis ---`;
        const fullContent = header + textToDownload + footer;
        const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Veridian_Texto_Analizado.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function getFinalText() {
        if (!state.originalText) return '';
        let baseText = state.originalText;
        const acceptedChanges = [...state.corrections, ...state.suggestions].filter(c => c.status === 'accepted');
        return applyChanges(baseText, acceptedChanges);
    }

    function applyChanges(text, changes) {
        let tempText = text;
        [...changes].sort((a, b) => b.offset - a.offset).forEach(change => {
            if (change.offset !== undefined && change.offset + change.length <= tempText.length) {
                tempText = tempText.substring(0, change.offset) + change.replacement + tempText.substring(change.offset + change.length);
            }
        });
        return tempText;
    }

    function handleGlobalClick(e) {
        const tooltip = e.target.closest('#tooltip');
        if (tooltip) {
            handleTooltipClick(e);
            return;
        }
        const span = e.target.closest('.correction, .suggestion');
        if (span) {
            showTooltip(span, e.currentTarget);
            return;
        }
        hideTooltip();
    }

    function showTooltip(span, container) {
        hideTooltip();
        const changeId = span.dataset.id;
        const change = findChangeById(changeId);
        if (!change) return;

        if (state.activeMode === 'revisado' && change.type === 'correction') {
            dom.tooltip.innerHTML = `<div class="tooltip-guide"><p>Para gestionar esta corrección, por favor, vaya al modo <strong>Corrección</strong>.</p><button class="go-to-correction">Ir a Corrección</button></div>`;
        } else {
            let buttonsHtml = `<button class="accept-btn">Aceptar</button>`;
            if (change.type === 'correction') {
                buttonsHtml += `<button class="dict-btn">Añadir Diccionario</button>`;
            }
            buttonsHtml += `<button class="ignore-btn">Ignorar</button>`;
            dom.tooltip.innerHTML = `
                <div class="tooltip-content">
                    <span class="original">${escapeHtml(change.original)}</span> → <strong class="replacement">${escapeHtml(change.replacement)}</strong>
                    <span class="explanation">${escapeHtml(change.reason)}</span>
                </div>
                <div class="tooltip-actions">${buttonsHtml}</div>`;
        }
        
        positionTooltip(dom.tooltip, span, container);
        dom.tooltip.classList.add('visible');
        state.currentTooltip = { tooltip: dom.tooltip, span, change };
    }

    function handleTooltipClick(e) {
        e.stopPropagation();
        const button = e.target.closest('button');
        if (!button || !state.currentTooltip) return;
        const { change } = state.currentTooltip;

        if (button.classList.contains('accept-btn')) change.status = 'accepted';
        if (button.classList.contains('ignore-btn')) change.status = 'ignored';
        if (button.classList.contains('dict-btn')) {
            const word = change.original.toLowerCase();
            if (!state.dictionary.includes(word)) {
                state.dictionary.push(word);
                localStorage.setItem('veridian_dictionary', JSON.stringify(state.dictionary));
            }
            state.corrections = state.corrections.filter(c => c.original.toLowerCase() !== word);
        }
        if (button.classList.contains('go-to-correction')) setActiveMode('correction');
        
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
        const containerRect = container.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        let top, left;
        const spaceBelow = containerRect.bottom - rect.bottom;
        const spaceAbove = rect.top - containerRect.top;
        if (spaceBelow > tooltip.offsetHeight + 10 || spaceBelow > spaceAbove) {
            top = rect.bottom + 8;
        } else {
            top = rect.top - tooltip.offsetHeight - 8;
        }
        left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
        if (left < 10) left = 10;
        if (left + tooltip.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltip.offsetWidth - 10;
        }
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    function findChangeById(id) {
        return state.corrections.find(c => c.id === id) || state.suggestions.find(s => s.id === id);
    }

    function escapeHtml(unsafe) {
        return unsafe ? unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";
    }

    function setAppHeight() {
    // 1. Guardamos la altura inicial de la ventana cuando la app carga.
    const initialHeight = window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${initialHeight}px`);

    // 2. Creamos una función que se ejecutará CADA VEZ que la ventana cambie de tamaño.
    const handleResize = () => {
        // 3. SOLO actualizamos la altura si la nueva altura NO es significativamente más pequeña.
        // Esto ignora el cambio de tamaño causado por la aparición del teclado.
        if (window.innerHeight >= initialHeight - 200) { // Un umbral de 200px para detectar el teclado
            const newHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            document.documentElement.style.setProperty('--app-height', `${newHeight}px`);
        }
    };
    
    // 4. Escuchamos los eventos de redimensionamiento para aplicar nuestra lógica.
    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
    }
}


    // --- PUNTO DE ENTRADA PRINCIPAL ---
    function initializeApp() {
        state.dictionary = JSON.parse(localStorage.getItem('veridian_dictionary')) || [];
        setupEventListeners();
        setAppHeight();
        dom.pulirBtn.disabled = true;
        updateUI(); // ¡¡LLAMADA INICIAL PARA CONSTRUIR EL PANEL!!
    }

    initializeApp();
});
