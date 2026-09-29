/**
 * ====================================================================
 * SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE REALTIME DATABASE (SDK v10)
 * ====================================================================
 * Escucha y envía cambios instantáneos entre PC y Celular en:
 * /control/estado
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  onValue 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// ==========================================
// 1. CREDENCIALES EXACTAS DE TU PROYECTO
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBVP99hpHfRJbW1JtNdwbCOcjQh7zSBtfk",
  authDomain: "viaticos-3df9e.firebaseapp.com",
  databaseURL: "https://viaticos-3df9e-default-rtdb.firebaseio.com",
  projectId: "viaticos-3df9e",
  storageBucket: "viaticos-3df9e.firebasestorage.app",
  messagingSenderId: "328738927547",
  appId: "1:328738927547:web:a7d503f81d956552bf0a9e",
  measurementId: "G-2S2R2XPHHT"
};

// ==========================================
// 2. INICIALIZACIÓN DE FIREBASE
// ==========================================
let app;
let db;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  console.log("✅ Firebase inicializado con éxito:", firebaseConfig.databaseURL);
} catch (error) {
  console.error("❌ Error al inicializar Firebase:", error);
  showToast("Error al inicializar Firebase: " + error.message, true);
}

// ==========================================
// 3. DETECCIÓN AUTOMÁTICA DEL DISPOSITIVO
// ==========================================
function getDeviceType() {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 768;
  return isMobile ? "Celular 📱" : "Computadora 💻";
}

const currentDevice = getDeviceType();
const deviceNameEl = document.getElementById("device-name");
const deviceIconEl = document.getElementById("device-icon");
if (deviceNameEl) {
  deviceNameEl.textContent = currentDevice;
  deviceIconEl.textContent = currentDevice.includes("Celular") ? "📱" : "💻";
}

// ==========================================
// 4. ELEMENTOS DEL DOM
// ==========================================
const connectionStatusEl = document.getElementById("connection-status");
const connectionTextEl = document.getElementById("connection-text");
const currentStateText = document.getElementById("current-state-text");
const statusRing = document.getElementById("status-ring");
const statusIcon = document.getElementById("status-icon");
const lastDeviceText = document.getElementById("last-device-text");
const lastTimeText = document.getElementById("last-time-text");
const payloadPreview = document.getElementById("payload-preview");
const activityLog = document.getElementById("activity-log");
const actionButtons = document.querySelectorAll(".btn-action");
const customInput = document.getElementById("custom-input");
const btnCustomSend = document.getElementById("btn-custom-send");
const btnClearLog = document.getElementById("btn-clear-local-log");
const toastEl = document.getElementById("toast");

const STATE_ICONS = {
  ACTIVO: "▶",
  PAUSADO: "⏸",
  INACTIVO: "⏹",
  EMERGENCIA: "🚨",
  MANTENIMIENTO: "🛠",
  REINICIANDO: "🔄"
};

let previousState = null;
let toastTimeout = null;

// ==========================================
// 5. ESCUCHAR ESTADO DE CONEXIÓN
// ==========================================
if (db) {
  const connectedRef = ref(db, ".info/connected");
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      connectionStatusEl.className = "status-chip online";
      connectionTextEl.textContent = "Conectado en Vivo";
    } else {
      connectionStatusEl.className = "status-chip offline";
      connectionTextEl.textContent = "Desconectado";
    }
  });
}

// ==========================================
// 6. ESCUCHAR CAMBIOS EN /control/estado
//    (Sincronización instantánea PC ⇄ Móvil)
// ==========================================
if (db) {
  const estadoRef = ref(db, "control/estado");

  onValue(estadoRef, (snapshot) => {
    const rawVal = snapshot.val();
    console.log("⚡ [Firebase RTDB] Recibido en /control/estado:", rawVal);

    if (rawVal === null || rawVal === undefined) {
      updateUIForState("SIN ESTADO", "--", new Date().toLocaleTimeString());
      return;
    }

    let stateValue = "";
    let originDevice = "Remoto";
    let changeTime = new Date().toLocaleTimeString();

    if (typeof rawVal === "object") {
      stateValue = rawVal.valor || rawVal.estado || JSON.stringify(rawVal);
      originDevice = rawVal.dispositivo || originDevice;
      if (rawVal.timestamp) {
        changeTime = new Date(rawVal.timestamp).toLocaleTimeString();
      }
    } else {
      stateValue = String(rawVal);
    }

    // Actualizar interfaz
    updateUIForState(stateValue, originDevice, changeTime, rawVal);

    // Feedback táctil y visual al recibir cambio
    if (previousState !== null && previousState !== stateValue) {
      triggerNotificationFeedback(stateValue, originDevice);
      addLogEntry(stateValue, originDevice, changeTime);
    } else if (previousState === null) {
      addLogEntry(stateValue, originDevice, changeTime);
    }

    previousState = stateValue;
  }, (error) => {
    console.error("❌ Error de lectura en Firebase:", error);
    showToast("Error de lectura: " + error.message, true);
  });

  // Escuchar metadatos de auditoría si existen
  const metaRef = ref(db, "control/meta");
  onValue(metaRef, (snapshot) => {
    const meta = snapshot.val();
    if (meta) {
      if (meta.dispositivo) lastDeviceText.textContent = meta.dispositivo;
      if (meta.fecha) lastTimeText.textContent = meta.fecha;
    }
  });
}

// ==========================================
// 7. ENVIAR CAMBIOS A FIREBASE
// ==========================================
async function changeState(newState) {
  if (!db) {
    showToast("Firebase no está listo", true);
    return;
  }

  const cleanState = String(newState).trim().toUpperCase();
  if (!cleanState) return;

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString();

  highlightSelectedButton(cleanState);

  try {
    // 1. Escribir directamente en /control/estado
    const estadoRef = ref(db, "control/estado");
    await set(estadoRef, cleanState);

    // 2. Guardar metadata complementaria en /control/meta
    const metaRef = ref(db, "control/meta");
    await set(metaRef, {
      estado: cleanState,
      dispositivo: currentDevice,
      fecha: timeFormatted,
      timestamp: Date.now()
    });

    console.log(`📤 Enviado a /control/estado: ${cleanState} desde ${currentDevice}`);
    showToast(`✓ Estado '${cleanState}' enviado`);
  } catch (error) {
    console.error("❌ Error al escribir en Firebase:", error);
    showToast("Error al enviar: " + error.message, true);
  }
}

// ==========================================
// 8. ACTUALIZACIÓN VISUAL
// ==========================================
function updateUIForState(state, device, time, rawPayload) {
  const normState = state.toUpperCase();

  currentStateText.textContent = normState;
  lastDeviceText.textContent = device || "Desconocido";
  lastTimeText.textContent = time || new Date().toLocaleTimeString();

  if (rawPayload !== undefined) {
    payloadPreview.textContent = JSON.stringify(rawPayload);
  } else {
    payloadPreview.textContent = JSON.stringify({ estado: normState });
  }

  statusIcon.textContent = STATE_ICONS[normState] || "⚡";
  document.body.className = `state-${normState}`;
  highlightSelectedButton(normState);
}

function highlightSelectedButton(state) {
  actionButtons.forEach(btn => {
    if (btn.getAttribute("data-state") === state) {
      btn.classList.add("is-current");
    } else {
      btn.classList.remove("is-current");
    }
  });
}

// ==========================================
// 9. FEEDBACK HÁPTICO Y TOAST
// ==========================================
function triggerNotificationFeedback(state, originDevice) {
  if ("vibrate" in navigator) {
    try {
      if (state === "EMERGENCIA") {
        navigator.vibrate([120, 80, 120, 80, 200]);
      } else {
        navigator.vibrate(60);
      }
    } catch (e) {}
  }

  showToast(`⚡ Cambio recibido: [${state}] vía ${originDevice}`);
}

function showToast(message, isError = false) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.style.borderColor = isError ? "var(--color-emergency)" : "var(--border-bright)";
  toastEl.classList.add("visible");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("visible");
  }, 3200);
}

// ==========================================
// 10. HISTORIAL DE ACTIVIDAD EN VIVO
// ==========================================
function addLogEntry(state, device, time) {
  if (!activityLog) return;

  const emptyMsg = activityLog.querySelector(".log-empty");
  if (emptyMsg) emptyMsg.remove();

  const entry = document.createElement("div");
  entry.className = "log-item";

  entry.innerHTML = `
    <div class="log-item-left">
      <span class="log-badge-state">${STATE_ICONS[state] || "•"} ${state}</span>
      <span class="log-device">por ${device}</span>
    </div>
    <span class="log-time">${time}</span>
  `;

  activityLog.prepend(entry);

  while (activityLog.children.length > 30) {
    activityLog.removeChild(activityLog.lastChild);
  }
}

// ==========================================
// 11. LISTENERS DE LA BOTONERA
// ==========================================
actionButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetState = btn.getAttribute("data-state");
    changeState(targetState);
  });
});

if (btnCustomSend && customInput) {
  const submitCustom = () => {
    const val = customInput.value.trim();
    if (val) {
      changeState(val);
      customInput.value = "";
    }
  };

  btnCustomSend.addEventListener("click", submitCustom);
  customInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitCustom();
  });
}

if (btnClearLog && activityLog) {
  btnClearLog.addEventListener("click", () => {
    activityLog.innerHTML = '<div class="log-empty">Historial limpiado. Esperando nuevos eventos...</div>';
  });
}
