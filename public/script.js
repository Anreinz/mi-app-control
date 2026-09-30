// ====================================================================
// CONEXIÓN DIRECTA A FIREBASE REALTIME DATABASE (CONEXIÓN INYECTADA)
// ====================================================================
(function() {
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

  // 1. Inicialización segura de Firebase
  let rtdbApp = null;
  let rtdb = null;

  try {
    if (typeof firebase !== "undefined") {
      rtdbApp = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
      rtdb = firebase.database();
      console.log("🔥 [RTDB] Conectado exitosamente a:", firebaseConfig.databaseURL);
    }
  } catch (err) {
    console.error("❌ Error al conectar Firebase:", err);
  }

  // 2. Función para transmitir el estado a la base de datos
  function syncStateToFirebase(stateText) {
    if (!rtdb) return;
    const cleanState = String(stateText || "").trim().toUpperCase();
    if (!cleanState) return;

    rtdb.ref("control/estado").set(cleanState)
      .then(function() {
        console.log("📤 [RTDB] Estado enviado a /control/estado:", cleanState);
      })
      .catch(function(err) {
        console.error("❌ [RTDB] Error al enviar estado:", err);
      });
  }

  // 3. Vincular a todos los botones existentes de la aplicación
  function bindButtons() {
    const buttons = document.querySelectorAll("button, .btn, [data-state]");
    buttons.forEach(function(btn) {
      if (btn.dataset.rtdbBound) return;
      btn.dataset.rtdbBound = "true";

      btn.addEventListener("click", function() {
        const state = btn.getAttribute("data-state") || 
                      btn.innerText.trim().split("\n")[0] || 
                      btn.value;
        if (state) {
          syncStateToFirebase(state);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindButtons);
  } else {
    bindButtons();
  }

  // 4. Escuchar cambios en tiempo real desde PC o Celular
  if (rtdb) {
    rtdb.ref("control/estado").on("value", function(snapshot) {
      const val = snapshot.val();
      if (val !== null && val !== undefined) {
        console.log("⚡ [RTDB] Estado recibido en vivo:", val);
      }
    });
  }
})();
