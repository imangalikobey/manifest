// 1. CONFIGURATION
const CONFIG = {
    documentId: "xKido1E4f9fSswgH", // Your Sigex ID
    baseUrl: "/api"  // No http://localhost:8000, just the path!

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

let documentDataB64 = "MTEK"
/**
 * HELPER: Correctly convert Kazakh Cyrillic text to Base64 (UTF-8)
 */
function utf8ToBase64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}
async function fetchSignedData() {
  try {
    console.log("Запрашиваем подписанные данные...");
    const res = await fetch(`${CONFIG.baseUrl}/${CONFIG.documentId}/data`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      const data = await res.json();
      console.log("Ответ от Sigex:", data);

      // Например, вывести размер документа
      console.log("Размер подписанного документа:", data.signedDataSize, "байт");

      // Если нужно сам документ (Base64)
      console.log("Документ (base64):", data.document.slice(0, 100) + "...");
    } else {
      console.error("Ошибка при получении данных:", res.status, res.statusText);
    }
  } catch (err) {
    console.error("Сетевая ошибка:", err);
  }
}

/**
 * 3. INITIALIZATION
 * This replaces your failing fetchDocument()
 */
function initManifesto() {
    console.log("Initializing Manifesto Data...");
    try {
        // Convert the text to Base64
        // documentDataB64 = utf8ToBase64(manifestoText);

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
        const res = await fetch(`${CONFIG.baseUrl}/${CONFIG.documentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials:'include',
            body: JSON.stringify({
                signType: "cms",
                signature: sigB64,
                signatureEmailNotifications: { 
                    to: ["manifesto.qazscience@gmail.com"], 
                    language: "ru" 
                }
            })
        });
        console.log("Ответ Sigex:", await res.text());
        if (res.ok) {
            alert("Сәтті қол қойылды! Қолтаңбаңыз тіркелді.");
            // location.reload();
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

async function signWithNCALayer()
{
  const nca = new NCALayerClient();

  try {
    // 1. Подключаемся к NCALayer
    await nca.connect();

    // 2. Запрашиваем nonce у Sigex
    const nonceRes = await fetch(`${CONFIG.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    });
    const data = await nonceRes.json();
    const nonce = data.nonce;
    // 3. Подписываем nonce через NCALayer
    const nonceSignature = await nca.basicsSignCMS(
      NCALayerClient.basicsStorageAll,
      nonce, // строка Base64
      NCALayerClient.basicsCMSParamsDetached, // для аутентификации обычно attached
      NCALayerClient.basicsSignerSignAny
    );
    // 4. Отправляем подпись nonce обратно на Sigex
    const authRes = await fetch(`${CONFIG.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        nonce: nonce,
        signature: nonceSignature,
        external:false
      })
    });
    if (!authRes.ok) {
      throw new Error("Auth failed: " + (await authRes.text()));
    }
    console.log("auth status", authRes.status);
    console.log("auth body", await authRes.text());
    //5. Теперь подписываем сам документ
    // const docSignature = await nca.basicsSignCMS(
    //   NCALayerClient.basicsStorageAll,
    //   documentDataB64,
    //   NCALayerClient.basicsCMSParamsDetached,
    //   NCALayerClient.basicsSignerSignAny
    // );

    // 6. Отправляем подпись документа на Sigex
    const signRes = await fetch(`${CONFIG.baseUrl}/${CONFIG.documentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    //   credentials: 'include',
      body: JSON.stringify({
        signType: "cms",
        signature:nonceSignature,
        signatureEmailNotifications: {
          to: ["manifesto.qazscience@gmail.com"],
          language: "ru"
        }
      })
    });
console.log(signRes.status);
console.log(await signRes.text());
  } catch (error) {
    console.error("Ошибка:", error);
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
        const res = await fetch(`${CONFIG.baseUrl}/${CONFIG.documentId}`);
        
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
        if (typeof count === "number") {
            countEl.textContent = count.toLocaleString('kk-KZ');
            console.log(`Signatures: ${count}`);
        } else {
            countEl.textContent = "0";
            console.warn("Signature count undefined, fallback to 0");
        }
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
window.addEventListener('DOMContentLoaded', function() {
    console.log("DOM ready, initializing...");
    initManifesto();
    toggleSignButtons(); // Double-check button state
    startSignatureCounter();
});

// Expose to HTML
window.signWithNCALayer = signWithNCALayer;