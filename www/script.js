document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // --- CONFIGURACIÓN INICIAL ---
    // =================================================================================
    
    // Claves API (dejarlas vacías para usar los secretos de GitHub en el workflow)
    const API_KEYS = {
        GROQ: "", 
        HUGGING_FACE: "" 
    };

    // Definición de los motores con los nombres solicitados
    const MODELS = {
        'GRATUITO': { engine: 'GROQ', model: 'llama3-8b-8192', max_words: 7000 },
        'PREMIUM': { engine: 'GROQ', model: 'llama3-70b-8192', max_words: 20000 },
        'PRO': { engine: 'GROQ', model: 'llama3-70b-8192', max_words: 50000 } // Puedes cambiarlo a un modelo de HF si quieres
    };
    
    // Modos de operación con sus textos de ayuda
    const MODES = {
        correction: { name: 'Corrección\nOrtográfica', help: 'Encuentra y corrige errores gramaticales, de puntuación y ortografía.' },
        suggestion: { name: 'Sugerencia\nde Estilo', help: 'Propone mejoras de estilo, claridad y fluidez.' },
        revisado: { name: 'Revisión\nFinal', help: 'Muestra una versión reescrita por la IA para mejorar el estilo.' }
    };

    // Prompts para la IA
    const PROMPTS = {
        correction: (text, level) => {
            const prompts_by_level = {
                'GRATUITO': `Eres un corrector de español. Devuelve un objeto JSON con una clave "corrections", que sea un array de objetos. Cada objeto debe tener "original", "replacement" y "reason". Ejemplo: {"original": "habian", "replacement": "habían", "reason": "Lleva tilde para marcar el hiato."}. Texto: "${text}"`,
                'PREMIUM': `Eres un tutor de gramática española. Explica cada error de forma concisa y educativa. Devuelve un objeto JSON con una única clave "corrections", que sea un array de objetos. Cada objeto debe tener "original", "replacement" y "reason". Ejemplo: Para "casa blanco -> casa blanca": "El adjetivo 'blanca' debe concordar en género femenino con el sustantivo 'casa'." Texto: "${text}"`,
                'PRO': `Eres un catedrático de la RAE. Realiza un análisis forense de cada error gramatical. Proporciona una explicación magistral. Devuelve un objeto JSON con una única clave "corrections", que sea un array de objetos. Cada objeto debe tener "original", "replacement" y "reason". Ejemplo: Para "habian -> habían": "Se acentúa 'habían' en la 'i' para romper el diptongo y formar un hiato acentual." Texto: "${text}"`
            };
            return prompts_by_level[level];
        },
        suggestion: (text, level) => {
            const prompts_by_level = {
                'GRATUITO': `Eres un editor de español. Sugiere mejoras de estilo. Devuelve un JSON con una clave "suggestions", que sea una lista de objetos. Cada objeto debe tener "original", "replacement" y "reason". Si no hay sugerencias, devuelve {"suggestions": []}. Texto: "${text}"`,
                'PREMIUM': `Eres un editor experto. Sugiere mejoras de estilo y claridad. Devuelve un JSON con una clave "suggestions". La "reason" debe ser educativa. Si no hay sugerencias, devuelve {"suggestions": []}. Texto: "${text}"`,
                'PRO': `Eres un editor literario. Eleva el texto a su máximo potencial. Devuelve un JSON con una clave "suggestions". La "reason" debe ser un análisis en tres partes: 1. Diagnóstico, 2. Propuesta, 3. Impacto. Si no hay sugerencias, devuelve {"suggestions": []}. Texto: "${text}"`
            };
            return prompts_by_level[level];
        },
        final_review: (text) => `Pule el siguiente texto para mejorar su fluidez, coherencia y estilo, sin cambiar el significado. Devuelve únicamente el texto pulido final. Texto: "${text}"`
    };

    // --- ELEMENTOS DEL DOM ---
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

    // --- ESTADO DE LA APLICACIÓN ---
    let state = {
        originalText: '',
        correction: { text: '', changes: [] },
        suggestion: { text: '', changes: [] },
        revisado: { text: '', changes: [] },
        finalPolishedText: '',
        dictionary: [],
        activeMode: null,
        currentTooltip: null,
        isFocusMode: false,
        touchStartX: 0,
        isProcessing: false,
        activeLevel: 'GRATUITO', // Nivel por defecto
    };
    // =================================================================================
    // --- LÓGICA PRINCIPAL Y DE ANÁLISIS ---
    // =================================================================================

    function initializeApp() {
        state.dictionary = JSON.parse(localStorage.getItem('veridian_dictionary')) || [];
        setupEventListeners();
        updateUI(); // Llamada inicial para construir el panel
        setAppHeight();
        dom.pulirBtn.disabled = true;
    }

    function setupEventListeners() {
        window.addEventListener('resize', setAppHeight);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', setAppehight);
        }
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
        
        [dom.inputText, dom.outputText].forEach(box => {
            box.addEventListener('dblclick', () => enterFocusMode(box === dom.inputText ? 'input' : 'output'));
        });
        
        dom.focusCloseBtn.addEventListener('click', exitFocusMode);
        dom.focusContent.addEventListener('touchstart', (e) => { state.touchStartX = e.touches[0].clientX; }, { passive: true });
        dom.focusContent.addEventListener('touchend', handleSwipe, { passive: true });
        
        [document.getElementById('editor-screen'), document.getElementById('focus-view')].forEach(container => {
            container.addEventListener('click', handleGlobalClick);
        });
        
        [dom.outputText, dom.focusContent].forEach(el => {
            el.addEventListener('scroll', () => {
                if (state.currentTooltip) {
                    const isHelp = state.currentTooltip.tooltip.id === 'help-tooltip';
                    positionTooltip(state.currentTooltip.tooltip, state.currentTooltip.span, dom.editorContainer, isHelp);
                }
            }, { passive: true });
        });
    }

    async function runAnalysis() {
        state.originalText = dom.inputText.value;
        if (!state.originalText.trim() || state.isProcessing) return;

        setProcessingState(true);
        clearOutput();
        
        dom.outputText.innerHTML = `<div class="output-status"><div class="output-status-main processing-dots">Analizando</div><div id="sub-status" class="output-status-sub"></div></div>`;
        const subStatusEl = document.getElementById('sub-status');

        try {
            const level = state.activeLevel;
            const engine = MODELS[level].engine;
            const model = MODELS[level].model;

            subStatusEl.textContent = '1/3: Buscando correcciones...';
            const correctionPrompt = PROMPTS.correction(state.originalText, level);
            const correctionResult = await callAI(correctionPrompt, engine, model, true);
            state.correction.text = state.originalText;
            state.correction.changes = processAIResponse(correctionResult, 'corrections', 'correction');

            subStatusEl.textContent = '2/3: Buscando sugerencias...';
            const suggestionPrompt = PROMPTS.suggestion(state.originalText, level);
            const suggestionResult = await callAI(suggestionPrompt, engine, model, true);
            state.suggestion.text = state.originalText;
            state.suggestion.changes = processAIResponse(suggestionResult, 'suggestions', 'suggestion');

            subStatusEl.textContent = '3/3: Realizando pulido final...';
            const finalReviewPrompt = PROMPTS.final_review(state.originalText);
            state.finalPolishedText = await callAI(finalReviewPrompt, engine, model);
            state.revisado.text = state.finalPolishedText; // El modo revisado usa el texto pulido

            setActiveMode('correction');

        } catch (error) {
            console.error("Error en el proceso de análisis:", error);
            dom.outputText.innerHTML = `<p style="color: var(--red-accent); text-align: center;">${error.message}</p>`;
        } finally {
            setProcessingState(false);
        }
    }

    async function callAI(prompt, engine, model, expectJson = false) {
        let url, headers, body;
        const messages = [{ role: "user", content: prompt }];

        if (engine === 'GROQ') {
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers = { 'Authorization': `Bearer ${API_KEYS.GROQ}`, 'Content-Type': 'application/json' };
            body = { model, messages, temperature: 0.3 };
            if (expectJson) body.response_format = { type: "json_object" };
        } else if (engine === 'HUGGING_FACE') {
            url = `https://api-inference.huggingface.co/models/${model}`;
            headers = { 'Authorization': `Bearer ${API_KEYS.HUGGING_FACE}`, 'Content-Type': 'application/json' };
            body = { inputs: prompt, parameters: { return_full_text: false, max_new_tokens: 2048 } };
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

        if (expectJson) {
            try {
                if (engine === 'GROQ') return JSON.parse(result.choices[0].message.content);
                if (engine === 'HUGGING_FACE') return JSON.parse(result[0].generated_text);
            } catch (e) {
                console.error("Error al parsear JSON de la IA:", e, result);
                throw new Error("La IA devolvió una respuesta JSON inválida.");
            }
        } else {
            if (engine === 'GROQ') return result.choices[0].message.content;
            if (engine === 'HUGGING_FACE') return result[0].generated_text;
        }
    }
