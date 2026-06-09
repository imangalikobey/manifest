// 1. CONFIGURATION
const CONFIG = {
    documentId: "xKido1E4f9fSswgH", // Your Sigex ID
    baseUrl: "https://sigex.kz"
};
function toggleSignButtons() {
    const checkbox = document.getElementById('consent-checkbox');
    const button = document.getElementById('btn-sign');
    
    if (!checkbox || !button) {
        console.warn("Checkbox or button not found!");
        return;
    }
    
    const isChecked = checkbox.checked;
    button.disabled = !isChecked; // Explicitly set disabled state
    
    console.log("Button disabled:", button.disabled, "| Checkbox checked:", isChecked);
}
// 2. THE MANIFESTO TEXT (I've included the first part, paste the rest inside the ` `)
const manifestoText = `ҚАЗАҚСТАН ҒАЛЫМДАРЫНЫҢ МАНИФЕСІ
Ғылым – зияткерлік егемендіктің негізі
Біз мемлекетке, қоғамға және ел болашағына үндеу жолдаймыз!

2026 жылғы 15 наурызда республикалық референдумда қабылданған Қазақстан Республикасының жаңа Конституциясы...
[СЮДА ВСТАВЬТЕ ОСТАЛЬНОЙ ТЕКСТ ИЗ ВАШИХ 12 СТРАНИЦ]`;

// Global variable for encoded data
let documentDataB64 = "";

/**
 * HELPER: Correctly convert Kazakh Cyrillic text to Base64 (UTF-8)
 */
function utf8ToBase64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

/**
 * 3. INITIALIZATION
 * This replaces your failing fetchDocument()
 */
function initManifesto() {
    console.log("Initializing Manifesto Data...");
    try {
        // Convert the text to Base64
        documentDataB64 = utf8ToBase64(manifestoText);

        // Update UI
        const statusEl = document.getElementById('status-text');
        if (statusEl) statusEl.innerText = "Құжат дайын. Қол қоюға болады.";
    
        toggleSignButtons();
        // Call the UI helper if it exists in your premium HTML
        if (typeof window.showAutoLoadedDocument === 'function') {
            window.showAutoLoadedDocument();
        }
    } catch (e) {
        console.error("Encoding error:", e);
        if (document.getElementById('status-text')) {
            document.getElementById('status-text').innerText = "Қате: Мәтінді өңдеу мүмкін болмады.";
        }
    }
}

/**
 * 4. SAVE SIGNATURE TO SIGEX (The API call)
 */
async function saveSignature(sigB64) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.innerText = "Қолтаңба серверге жіберілуде...";

    try {
        const res = await fetch(`${CONFIG.baseUrl}/api/${CONFIG.documentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "signType": "cms",
                "signature": sigB64,
                "signatureEmailNotifications": { 
                    "to": ["manifesto.qazscience@gmail.com"], 
                    "language": "ru" 
                }
            })
        });

        if (res.ok) {
            alert("Сәтті қол қойылды! Қолтаңбаңыз тіркелді.");
            location.reload();
        } else {
            const error = await res.json();
            alert("Қате: " + (error.message || "Сақтау мүмкін болмады."));
        }
    } catch (e) {
        console.error(e);
        alert("Желілік қате. Серверге қосылу мүмкін емес.");
    }
}

/**
 * 5. NCALAYER SIGNING
 */

async function signWithNCALayer() {
    const nca = new NCALayerClient();
    try {
        await nca.connect();
        updateStatus(t('loadingMessage'), "loading");
        
        const signature = await nca.basicsSignCMS(
            NCALayerClient.basicsStorageAll,
            documentDataB64,
            NCALayerClient.basicsCMSParamsDetached,
            NCALayerClient.basicsSignerSignAny
        );

        if (signature) {
            await saveSignature(signature);
        }
    } catch (error) {
        console.error(error);
        if (error.canceledByUser) {
            updateStatus(t('canceledMessage'), "ready");
        } else {
            alert(t('errorMessage'));
            updateStatus(t('statusError'), "error");
        }
    }
}
function updateStatus(text, state = "default") {
    console.log(`[Status] ${text}`);
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
        statusEl.innerText = text;
    }
    if (typeof window.updateUIStatus === 'function') {
        window.updateUIStatus(text, state);
    }
}
async function fetchSignatureCount() {
    try {
        const res = await fetch(`${CONFIG.baseUrl}/api/${CONFIG.documentId}`);
        
        if (res.ok) {
            const data = await res.json();
            updateSignatureCount(data.signaturesTotal);
            return data.signaturesTotal;
        }
    } catch (e) {
        console.error("Failed to fetch signature count:", e);
    }
}

/**
 * Update the signature count display
 */
function updateSignatureCount(count) {
    const countEl = document.getElementById('signature-count');
    if (countEl) {
        countEl.textContent = count.toLocaleString('kk-KZ'); // Format with thousands separator
        console.log(`Signatures: ${count}`);
    }
}

/**
 * Poll signature count every 30 seconds
 */
function startSignatureCounter() {
    // Fetch immediately on load
    fetchSignatureCount();
    
    // Then poll every 30 seconds
    setInterval(fetchSignatureCount, 30000);
}

// Start on page load
window.addEventListener('DOMContentLoaded', () => {
    initManifesto();
    startSignatureCounter();
});

/**
 * Бұрынғы fetchDocument функциясының ішіне мынаны қосыңыз
 * (құжат сәтті жүктелген жерге)
 */
// ... fetchDocument ішіндегі логика ...
// .then(() => {
//    isDocLoaded = true; // Құжат дайын деп белгілейміз
//    toggleSignButtons(); // Чекбокстың күйін тексереміз
// });
// Start everything
window.addEventListener('DOMContentLoaded', initManifesto);
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM ready, initializing...");
    initManifesto();
    toggleSignButtons(); // Double-check button state
});
// Expose to HTML
window.signWithNCALayer = signWithNCALayer;