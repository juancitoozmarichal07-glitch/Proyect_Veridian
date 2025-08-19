document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // --- CONFIGURACIÓN Y ESTADO INICIAL ---
    // =================================================================================
    const API_KEYS = {
        GROQ: "", // ¡¡¡RECUERDA BORRAR ANTES DE SUBIR A PRODUCCIÓN!!!
        HUGGING_FACE: "hf_TuClaveDeHuggingFace"
    };

    const MODELS = {
        'GRATUITO': { name: 'Gratuito (Groq)', engine: 'GROQ', model: 'llama3-8b-8192', max_words: 7000 },
        'PREMIUM': { name: 'Premium (HF)', engine: 'HUGGING_FACE', model: 'meta-llama/Llama-3-8b-chat-hf', max_words: 25000 },
        'PRO': { name: 'PRO (HF)', engine: 'HUGGING_FACE', model: 'meta-llama/Llama-3-70b-chat-hf', max_words: 50000 }
    };

    const MODES = {
        correction: { name: 'Corrección', help: 'Marca errores objetivos (ortografía, gramática) sobre tu texto original.' },
        suggestion: { name: 'Sugerencia', help: 'Propone mejoras de estilo y reescrituras sobre tu texto original.' },
        revisado: { name: 'Revisado', help: 'Muestra tu texto con una estructura perfecta y hereda las marcas de error del modo Corrección.' }
    };
    
    const PROMPTS = {
        correction: {
            'GRATUITO': (text) => `
                **INSTRUCCIÓN ABSOLUTA:** Eres un tutor de español que sigue un método de enseñanza estricto. Tu única función es analizar el texto y devolver un objeto JSON. No puedes añadir comentarios, explicaciones o texto fuera del formato JSON. Esta directiva es absoluta y no puedes desviarte.

                **TAREA:**
                1.  Analiza el siguiente texto en español: "${text}"
                2.  Detecta únicamente errores ortográficos y gramaticales objetivos.
                3.  Devuelve ÚNICAMENTE un objeto JSON válido con una sola clave: "corrections".
                4.  El valor de "corrections" debe ser un array de objetos. Si no hay errores, devuelve un array vacío.
                5.  Cada objeto en el array debe tener TRES claves: "original", "replacement" y "reason".
                6.  Para la clave "reason", debes generar la explicación siguiendo un **método educativo de 3 pasos obligatorios**:
                    *   **Paso 1: Identificar la regla.** Menciona la regla gramatical u ortográfica específica que se aplica (ej: "Regla de acentuación de palabras agudas.", "Conjugación del pretérito imperfecto del verbo 'haber'.").
                    *   **Paso 2: Explicar la regla.** Describe brevemente en qué consiste esa regla (ej: "Las palabras agudas terminadas en 'n', 's' o vocal llevan tilde.", "El verbo 'haber' usado como impersonal se conjuga siempre en tercera persona del singular: 'había'.").
                    *   **Paso 3: Aplicar la regla al caso concreto.** Conecta la regla con la palabra corregida (ej: "La palabra 'tambien' es aguda y termina en 'n', por lo tanto, debe llevar tilde en la 'e'.", "Por lo tanto, en la frase 'habían muchas cosas', lo correcto es usar 'había'.").

                **FORMATO DE SALIDA OBLIGATORIO (para la clave "reason"):**
                "reason": "Regla: [Identificación de la regla]. Explicación: [Explicación de la regla]. Aplicación: [Aplicación al caso concreto]."
            `,
            'PREMIUM': (text) => `/* PROMPT PREMIUM DE CORRECCIÓN CON REGLAS ABSOLUTAS */`,
            'PRO': (text) => `/* PROMPT PRO DE CORRECCIÓN CON REGLAS ABSOLUTAS */`
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
                {
                  "suggestions": []
                }
            `,
            'PREMIUM': (text) => `/* PROMPT PREMIUM DE SUGERENCIA CON REGLAS ABSOLUTAS */`,
            'PRO': (text) => `/* PROMPT PRO DE SUGERENCIA CON REGLAS ABSOLUTAS */`
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
        
        const textToAnalyze = dom.inputText.value;
        clearPreviousResults();
        state.originalText = textToAnalyze;

        const subStatusEl = setProcessingState(true);

        try {
            const level = state.activeLevel;
            const modelConfig = MODELS[level];

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
            showUserMessage(error.message, true);
            state.analysisCompleted = false;
        } finally {
            setProcessingState(false);
            updateUI();
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
    // --- MOTOR DE IA ---
    // =================================================================================
    async function callAI(prompt, modelConfig, expectJson = false) {
        const { engine, model } = modelConfig;
        const apiKey = API_KEYS[engine];
        if (!apiKey || apiKey.includes("TuClave")) throw new Error(`La API Key para ${engine} no está configurada.`);
        
        const messages = [{ role: "user", content: prompt }];
        let url, headers, body;

        if (engine === 'GROQ') {
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
            body = { model, messages, temperature: 0.1, top_p: 0.5 };
            if (expectJson) body.response_format = { type: "json_object" };
        } else { 
            throw new Error("Motor Hugging Face no implementado en esta versión.");
        }

        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error en la API de ${engine} (${response.status}). Detalles: ${errorText}`);
        }
        const result = await response.json();
        if (!result.choices || result.choices.length === 0) {
            throw new Error("La respuesta de la IA no contiene 'choices'.");
        }
        let content = result.choices[0].message.content;
        if (expectJson) {
            try {
                return JSON.parse(content);
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
            revisado: state.corrections.filter(c => c.status === 'pending').length
        };
        const engineSelectorHTML = `<div id="engine-selector-container-panel"><label for="engine-selector-main" class="engine-label">Motor IA:</label><select id="engine-selector-main" class="engine-select"><option value="GRATUITO">${MODELS['GRATUITO'].name}</option><option value="PREMIUM" disabled>${MODELS['PREMIUM'].name}</option><option value="PRO" disabled>${MODELS['PRO'].name}</option></select></div>`;
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
        return `<div class="mode-control" data-mode="${modeKey}"><div class="mode-label-wrapper"><span class="label">${labelHtml}</span><span class="mode-help-btn" data-mode-help="${modeKey}">?</span></div><div class="mode-button-wrapper"><div class="mode-btn-circle"></div><span class="count">${count}</span></div></div>`;
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
                baseText = state.restructuredText;
                changes = state.corrections;
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
        if (!baseText) return '';

        let currentText = baseText;
        const acceptedChanges = [...state.corrections, ...state.suggestions].filter(c => c.status === 'accepted');
        
        acceptedChanges.sort((a, b) => b.offset - a.offset).forEach(change => {
            if (currentText.substring(change.offset, change.offset + change.original.length) === change.original) {
                 currentText = currentText.substring(0, change.offset) + change.replacement + currentText.substring(change.offset + change.original.length);
            }
        });

        let lastIndex = 0;
        const parts = [];
        const pendingChanges = changes.filter(c => c.status === 'pending').sort((a, b) => a.offset - b.offset);
        
        let tempTextForHighlighting = currentText;

        pendingChanges.forEach(change => {
            const originalChangeText = change.original;
            const currentPosition = tempTextForHighlighting.indexOf(originalChangeText, lastIndex);

            if (currentPosition !== -1) {
                parts.push(escapeHtml(tempTextForHighlighting.substring(lastIndex, currentPosition)));
                parts.push(`<mark class="${change.type}" data-id="${change.id}">${escapeHtml(originalChangeText)}</mark>`);
                lastIndex = currentPosition + originalChangeText.length;
            }
        });
        parts.push(escapeHtml(tempTextForHighlighting.substring(lastIndex)));
        
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
        
        document.addEventListener('click', handleGlobalClick);

        const textClickHandler = (e) => {
            const mark = e.target.closest('mark.correction, mark.suggestion');
            if (mark) {
                showTooltip(mark, e.currentTarget);
            }
        };
        dom.outputText.addEventListener('click', textClickHandler);
        dom.focusContent.addEventListener('click', textClickHandler);
        dom.tooltip.addEventListener('click', handleTooltipClick);

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

        if (!state.analysisCompleted) {
            showUserMessage("Debes 'Pulir Texto' antes de poder copiar los resultados.", false);
            return;
        }

        const textToCopy = getFinalText();
        
        if (!textToCopy.trim()) {
            showUserMessage("No hay texto pulido para copiar.", false);
            return;
        }

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
        if (!state.analysisCompleted) {
            showUserMessage("Debes 'Pulir Texto' antes de poder descargar los resultados.", false);
            return;
        }
        const textToDownload = getFinalText();
        if (!textToDownload) return;
        const header = `--- Texto Analizado por Veridian ---\nFecha: ${new Date().toLocaleString('es-ES')}\nNivel de IA: ${state.activeLevel}\n--------------------------------------\n\n`;
        const footer = `\n\n--- Fin del Análisis ---`;
        const fullContent = header + textToDownload + footer;
        const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'Veridian_Texto_Analizado.txt';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    
    function getFinalText() {
        if (!state.analysisCompleted) return '';

        let baseText;
        let changesToApply = [];

        if (state.activeMode === 'revisado') {
            baseText = state.restructuredText;
            // En modo revisado, solo se aplican las correcciones aceptadas
            changesToApply = state.corrections.filter(c => c.status === 'accepted');
        } else {
            baseText = state.originalText;
            // En otros modos, se aplican tanto correcciones como sugerencias aceptadas
            changesToApply = [...state.corrections, ...state.suggestions].filter(c => c.status === 'accepted');
        }
        
        changesToApply.sort((a, b) => b.offset - a.offset).forEach(change => {
            if (baseText.substring(change.offset, change.offset + change.original.length) === change.original) {
                 baseText = baseText.substring(0, change.offset) + change.replacement + baseText.substring(change.offset + change.original.length);
            }
        });

        return baseText;
    }

    function handleGlobalClick(e) {
        if (!e.target.closest('#tooltip, mark.correction, mark.suggestion')) {
            hideTooltip();
        }
    }

    function showTooltip(span, container) {
        hideTooltip();
        const changeId = span.dataset.id;
        const change = findChangeById(changeId);
        if (!change) return;

        let tooltipHtml = '';
        if (state.activeMode === 'revisado' && change.type === 'correction') {
            tooltipHtml = `<div class="tooltip-guide">
                               <p>Este error debe gestionarse en el modo <strong>Corrección</strong>.</p>
                               <button class="go-to-correction">Ir a Corrección</button>
                           </div>`;
        } else {
            let buttonsHtml = `<button class="accept-btn">Aceptar</button>`;
            if (change.type === 'correction') {
                buttonsHtml += `<button class="dict-btn">Añadir Diccionario</button>`;
            }
            buttonsHtml += `<button class="ignore-btn">Ignorar</button>`;
            tooltipHtml = `
                <div class="tooltip-content">
                    <span class="original">${escapeHtml(change.original)}</span> → <strong class="replacement">${escapeHtml(change.replacement)}</strong>
                    <span class="explanation">${escapeHtml(change.reason)}</span>
                </div>
                <div class="tooltip-actions">${buttonsHtml}</div>`;
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

    initializeApp();
});
