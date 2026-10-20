/**
 * FOTOS Y NOTAS DESDE LA APP DEL CATÁLOGO (modo revisión) — versión 6
 * Dónde va: en la hoja «Catálogo Alumol – Productos» › Extensiones › Apps Script.
 *
 * DOS CLAVES:
 *  - CLAVE (trabajador): puede proponer cambios. Fotos nuevas, quitar fotos y ocultar/mostrar productos
 *    NO llegan al catálogo: quedan en la pestaña «Por aprobar» hasta que el administrador los apruebe.
 *    Notas y «marcar para mejorar» sí se guardan directo (el cliente no las ve).
 *  - CLAVE_ADMIN (administrador): sus cambios pasan directo y es el único que puede aprobar o rechazar.
 *
 * Qué hace cada acción (cuando se aplica):
 *  - Subir foto: la guarda en Drive, la comparte como «cualquiera con el enlace puede ver» y pega el enlace
 *    en la columna Foto (busca el producto por N°, y si no, por nombre). La foto anterior subida desde la app
 *    se manda a la papelera de Drive.
 *  - Quitar foto: deja la celda Foto en blanco y manda la foto a la papelera (solo si se subió desde la app).
 *  - Marcar para mejorar: SÍ o vacío en la columna «Mejorar foto».
 *  - Ocultar / mostrar: NO o SÍ en la columna «Mostrar».
 *  - Notas: pestaña «Notas de revisión» (no se publica).
 *  - Registro: todo queda en la pestaña «Registro de fotos».
 *  - Menú «Catálogo › Reordenar números».
 */

// ====== CLAVES (cámbialas aquí; después: Implementar › Gestionar implementaciones › Nueva versión) ======
var CLAVE = "alumol2026";                 // la del trabajador
var CLAVE_ADMIN = "CAMBIA-ESTA-CLAVE";    // la tuya: ponle una que solo tú sepas
// =======================================================================================================

var CARPETA = "Fotos catálogo (desde la app)";
var CARPETA_PENDIENTES = "Fotos por aprobar (desde la app)";
var HOJA_NOTAS = "Notas de revisión";
var HOJA_REGISTRO = "Registro de fotos";
var HOJA_APROBAR = "Por aprobar";
var CAB_APROBAR = ["ID", "Fecha", "Quién", "N°", "Producto", "Acción", "Valor", "Foto nueva", "Foto anterior", "Estado", "Revisado"];
var VERSION = 6;

function rolDe(clave) {
  clave = String(clave || "").trim();
  if (CLAVE_ADMIN && CLAVE_ADMIN !== "CAMBIA-ESTA-CLAVE" && clave === CLAVE_ADMIN) return "admin";
  if (clave === CLAVE) return "trabajador";
  return "";
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var rol = rolDe(d.clave);
    if (!rol) return salida({ ok: false, error: "La clave no es correcta." });
    var accion = d.accion || "subir", autor = String(d.autor || "").slice(0, 60);

    // ---- Notas (directo para todos) ----
    if (accion === "nota") {
      var texto = String(d.nota || "").trim().slice(0, 1000);
      if (!texto) return salida({ ok: false, error: "La nota está vacía." });
      var hn = pestana(HOJA_NOTAS, ["Fecha", "Quién", "N°", "Producto", "Nota", "Estado"]);
      hn.appendRow([new Date(), autor, d.numero || "", d.producto || "", texto, "Pendiente"]);
      registrar(autor, d, "Nota: " + texto);
      return salida({ ok: true, fila: hn.getLastRow(), rol: rol });
    }
    if (accion === "resolver") {
      var hr = pestana(HOJA_NOTAS, ["Fecha", "Quién", "N°", "Producto", "Nota", "Estado"]);
      var f = parseInt(d.fila, 10);
      if (!(f >= 2 && f <= hr.getLastRow())) return salida({ ok: false, error: "No encuentro esa nota." });
      hr.getRange(f, 6).setValue("Resuelta");
      registrar(autor, d, "Nota resuelta");
      return salida({ ok: true, rol: rol });
    }

    // ---- Aprobar / rechazar (solo administrador) ----
    if (accion === "aprobar" || accion === "rechazar") {
      if (rol !== "admin") return salida({ ok: false, error: "Solo el administrador puede aprobar o rechazar." });
      var ids = [].concat(d.ids || d.id || []).map(String), hechos = [];
      var ha = pestana(HOJA_APROBAR, CAB_APROBAR);
      if (ha.getLastRow() < 2) return salida({ ok: true, hechos: [] });
      var filas = ha.getRange(2, 1, ha.getLastRow() - 1, CAB_APROBAR.length).getValues();
      for (var i = 0; i < filas.length; i++) {
        var fl = filas[i];
        if (ids.indexOf(String(fl[0])) < 0 || fl[9] !== "Pendiente") continue;
        var p = { numero: String(fl[3]), producto: String(fl[4]) }, res = { ok: true };
        if (accion === "aprobar") {
          if (fl[5] === "subir") res = aplicarFoto(p, String(fl[7]), String(fl[2]) + " (aprobado por " + autor + ")");
          else if (fl[5] === "quitar") res = aplicar("quitar", p, null, String(fl[2]) + " (aprobado por " + autor + ")");
          else if (fl[5] === "mostrar") res = aplicar("mostrar", p, fl[6] === "SÍ", String(fl[2]) + " (aprobado por " + autor + ")");
        } else {
          if (fl[5] === "subir") mandarAPapelera(String(fl[7]), CARPETA_PENDIENTES);
          registrar(autor, p, "Rechazado: " + descripcion(fl[5], fl[6]) + " (propuesto por " + fl[2] + ")");
        }
        if (!res.ok) { hechos.push({ id: String(fl[0]), ok: false, error: res.error }); continue; }
        ha.getRange(i + 2, 10, 1, 2).setValues([[accion === "aprobar" ? "Aprobado" : "Rechazado", autor + " · " + Utilities.formatDate(new Date(), "America/Guayaquil", "dd/MM HH:mm")]]);
        hechos.push({ id: String(fl[0]), ok: true, url: res.url || "" });
      }
      return salida({ ok: true, hechos: hechos });
    }

    // ---- Cambios al catálogo ----
    if (accion === "mejorar") {   // directo para todos: el cliente no lo ve
      var r = aplicar("mejorar", d, d.valor, autor);
      r.rol = rol; return salida(r);
    }
    if (rol === "admin") {
      var r2 = accion === "subir" ? subirDirecto(d, autor) : aplicar(accion, d, d.valor, autor);
      r2.rol = rol; return salida(r2);
    }
    // Trabajador: queda por aprobar
    if (!filaProducto(d)) return salida({ ok: false, error: "No encuentro ese producto en la hoja." });
    var ha2 = pestana(HOJA_APROBAR, CAB_APROBAR), id = Date.now() + "-" + Utilities.getUuid().slice(0, 6), urlNueva = "", valor = "";
    if (accion === "subir") {
      var arch = guardarImagen(d, CARPETA_PENDIENTES);
      urlNueva = "https://drive.google.com/file/d/" + arch.getId() + "/view";
    } else if (accion === "mostrar") {
      valor = d.valor ? "SÍ" : "NO";
    } else if (accion !== "quitar") {
      return salida({ ok: false, error: "Acción desconocida." });
    }
    var actual = filaProducto(d);
    ha2.appendRow([id, new Date(), autor, d.numero || "", d.producto || "", accion, valor, urlNueva, actual.foto, "Pendiente", ""]);
    registrar(autor, d, "Propuesto (por aprobar): " + descripcion(accion, valor));
    return salida({ ok: true, pendiente: true, id: id, rol: rol });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  }
}

// GET: sin parámetros dice la versión. Con clave devuelve el rol, las notas y los cambios por aprobar.
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.accion === "notas" || p.accion === "estado") {
    var rol = rolDe(p.clave);
    if (!rol) return salida({ ok: false, error: "La clave no es correcta." });
    var libro = SpreadsheetApp.getActiveSpreadsheet();
    var hn = libro.getSheetByName(HOJA_NOTAS), notas = [], pendientes = [];
    if (hn && hn.getLastRow() > 1) {
      var v = hn.getRange(2, 1, hn.getLastRow() - 1, 6).getValues();
      for (var i = 0; i < v.length; i++) {
        if (!v[i][4]) continue;
        notas.push({ fila: i + 2, fecha: fecha(v[i][0]), autor: String(v[i][1]), numero: String(v[i][2]), producto: String(v[i][3]), nota: String(v[i][4]), estado: String(v[i][5] || "Pendiente") });
      }
    }
    var ha = libro.getSheetByName(HOJA_APROBAR);
    if (ha && ha.getLastRow() > 1) {
      var w = ha.getRange(2, 1, ha.getLastRow() - 1, CAB_APROBAR.length).getValues();
      for (var j = 0; j < w.length; j++) {
        if (w[j][9] !== "Pendiente") continue;
        pendientes.push({ id: String(w[j][0]), fecha: fecha(w[j][1]), autor: String(w[j][2]), numero: String(w[j][3]), producto: String(w[j][4]),
          accion: String(w[j][5]), valor: String(w[j][6]), nueva: String(w[j][7]), anterior: String(w[j][8]) });
      }
    }
    return salida({ ok: true, rol: rol, notas: notas, pendientes: pendientes });
  }
  return salida({ ok: true, version: VERSION, mensaje: "Fotos y notas del catálogo listas" });
}

// ---------- Aplicar cambios a la hoja ----------
function filaProducto(d) {
  var hoja = buscarHoja(); if (!hoja) return null;
  var ultimaCol = hoja.getLastColumn();
  var cab = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0].map(normal);
  var cN = columna(cab, "n°"), cP = columna(cab, "producto"), cF = columna(cab, "foto");
  var datos = hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), ultimaCol).getValues();
  var fila = -1, i;
  if (d.numero && cN >= 0) for (i = 0; i < datos.length; i++) if (String(datos[i][cN]).trim() === String(d.numero).trim()) { fila = i; break; }
  if (fila < 0 && cP >= 0) for (i = 0; i < datos.length; i++) if (normal(datos[i][cP]) === normal(d.producto)) { fila = i; break; }
  if (fila < 0) return null;
  return { hoja: hoja, cab: cab, ultimaCol: ultimaCol, fila: fila + 2, cF: cF, foto: String(datos[fila][cF] || "") };
}

function aplicar(accion, d, valor, autor) {
  var x = filaProducto(d);
  if (!x) return { ok: false, error: "No encuentro ese producto en la hoja." };
  var cM = columna(x.cab, "mejorar foto");
  if (accion === "quitar") {
    x.hoja.getRange(x.fila, x.cF + 1).setValue("");
    if (cM >= 0) x.hoja.getRange(x.fila, cM + 1).setValue("");
    mandarAPapelera(x.foto, CARPETA);
    registrar(autor, d, "Foto quitada");
    return { ok: true };
  }
  if (accion === "mejorar") {
    if (cM < 0) { cM = x.ultimaCol; x.hoja.getRange(1, cM + 1).setValue("Mejorar foto"); }
    x.hoja.getRange(x.fila, cM + 1).setValue(valor ? "SÍ" : "");
    registrar(autor, d, valor ? "Marcada para mejorar" : "Quitada la marca de mejorar");
    return { ok: true };
  }
  if (accion === "mostrar") {
    var cV = columna(x.cab, "mostrar");
    if (cV < 0) { cV = x.ultimaCol; x.hoja.getRange(1, cV + 1).setValue("Mostrar (SÍ/NO)"); }
    x.hoja.getRange(x.fila, cV + 1).setValue(valor ? "SÍ" : "NO");
    registrar(autor, d, valor ? "Producto mostrado en el catálogo" : "Producto ocultado del catálogo");
    return { ok: true };
  }
  return { ok: false, error: "Acción desconocida." };
}

function subirDirecto(d, autor) {
  var arch = guardarImagen(d, CARPETA);
  return aplicarFoto(d, "https://drive.google.com/file/d/" + arch.getId() + "/view", autor);
}

// Pone en la columna Foto una foto que ya está en Drive (si está en «por aprobar», la pasa a la carpeta normal)
function aplicarFoto(d, url, autor) {
  var x = filaProducto(d);
  if (!x) return { ok: false, error: "No encuentro ese producto en la hoja." };
  var m = String(url).match(/\/d\/([A-Za-z0-9_-]{20,})/);
  if (m) { try { var f = DriveApp.getFileById(m[1]); f.moveTo(carpeta(CARPETA)); f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {} }
  x.hoja.getRange(x.fila, x.cF + 1).setValue(url);
  var cM = columna(x.cab, "mejorar foto");
  if (cM >= 0) x.hoja.getRange(x.fila, cM + 1).setValue("");
  if (x.foto && x.foto !== url) mandarAPapelera(x.foto, CARPETA);
  registrar(autor, d, x.foto ? "Foto cambiada" : "Foto subida");
  return { ok: true, url: url };
}

function guardarImagen(d, nombreCarpeta) {
  var nombre = (d.numero ? "N" + d.numero + " - " : "") + String(d.producto).replace(/[\\/:*?"<>|]/g, "-") + ".jpg";
  var bytes = Utilities.base64Decode(String(d.imagen).split(",").pop());
  var archivo = carpeta(nombreCarpeta).createFile(Utilities.newBlob(bytes, "image/jpeg", nombre));
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return archivo;
}

function descripcion(accion, valor) {
  if (accion === "subir") return "foto nueva";
  if (accion === "quitar") return "quitar foto";
  if (accion === "mostrar") return valor === "SÍ" ? "mostrar en el catálogo" : "ocultar del catálogo";
  return String(accion);
}

// ---------- Utilidades ----------
function fecha(v) { return v instanceof Date ? Utilities.formatDate(v, "America/Guayaquil", "dd/MM HH:mm") : String(v); }
function registrar(autor, d, accion) {
  try {
    var h = pestana(HOJA_REGISTRO, ["Fecha", "Quién", "N°", "Producto", "Acción"]);
    h.appendRow([new Date(), autor, d.numero || "", d.producto || "", accion]);
  } catch (e) {}
}
function pestana(nombre, cabecera) {
  var libro = SpreadsheetApp.getActiveSpreadsheet(), h = libro.getSheetByName(nombre);
  if (!h) {
    h = libro.insertSheet(nombre);
    h.appendRow(cabecera);
    h.getRange(1, 1, 1, cabecera.length).setFontWeight("bold");
    h.setFrozenRows(1);
  }
  return h;
}
// Solo manda a la papelera fotos que estén en la carpeta indicada (nunca otras fotos de Drive).
function mandarAPapelera(enlace, nombreCarpeta) {
  var m = String(enlace).match(/\/d\/([A-Za-z0-9_-]{20,})/) || String(enlace).match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  if (!m) return false;
  try {
    var f = DriveApp.getFileById(m[1]), padres = f.getParents();
    while (padres.hasNext()) if (padres.next().getName() === (nombreCarpeta || CARPETA)) { f.setTrashed(true); return true; }
  } catch (e) {}
  return false;
}
function buscarHoja() {
  var hojas = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < hojas.length; i++) {
    var n = hojas[i].getName();
    if (n === HOJA_NOTAS || n === HOJA_REGISTRO || n === HOJA_APROBAR || hojas[i].getLastColumn() < 2) continue;
    var cab = hojas[i].getRange(1, 1, 1, hojas[i].getLastColumn()).getValues()[0].map(normal);
    if (columna(cab, "producto") >= 0 && columna(cab, "foto") >= 0) return hojas[i];
  }
  return null;
}
function carpeta(nombre) {
  nombre = nombre || CARPETA;
  var it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
}
function normal(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
function columna(cab, inicio) { inicio = normal(inicio); for (var i = 0; i < cab.length; i++) if (cab[i].indexOf(inicio) === 0) return i; return -1; }
function salida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- Menú en la hoja ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Catálogo").addItem("Reordenar números", "reordenarNumeros").addToUi();
}

// Numera del 1 en adelante en el orden en que se ve la app: las secciones en el orden en que aparecen
// por primera vez en la hoja, y dentro de cada sección los productos en el orden de sus filas.
function reordenarNumeros() {
  var ui = SpreadsheetApp.getUi();
  var hoja = buscarHoja();
  if (!hoja) { ui.alert("No encuentro la hoja con las columnas Producto y Foto."); return; }
  var r = ui.alert("Reordenar números",
    "Se van a volver a numerar todos los productos (del 1 en adelante, en el orden de la app). " +
    "Las notas y los cambios por aprobar se actualizan solos. Avísale a quien esté subiendo fotos que actualice la app después.\n\n¿Continuar?",
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;

  var ultimaCol = hoja.getLastColumn(), filas = hoja.getLastRow() - 1;
  if (filas < 1) return;
  var cab = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0].map(normal);
  var cN = columna(cab, "n°"), cS = columna(cab, "secci"), cP = columna(cab, "producto");
  if (cN < 0) { cN = ultimaCol; hoja.getRange(1, cN + 1).setValue("N°"); ultimaCol++; }
  var datos = hoja.getRange(2, 1, filas, ultimaCol).getValues();

  var orden = [], grupos = {};
  for (var i = 0; i < datos.length; i++) {
    var sec = normal(datos[i][cS]), prod = String(datos[i][cP] || "").trim();
    if (!sec || !prod) continue;
    if (!grupos[sec]) { grupos[sec] = []; orden.push(sec); }
    grupos[sec].push(i);
  }
  var nuevos = datos.map(function (f) { return [f[cN]]; }), mapa = {}, n = 0, cambiados = 0;
  orden.forEach(function (sec) {
    grupos[sec].forEach(function (i) {
      n++;
      var viejo = String(datos[i][cN]).trim();
      if (viejo && !(viejo in mapa)) mapa[viejo] = n;
      if (viejo !== String(n)) cambiados++;
      nuevos[i] = [n];
    });
  });
  hoja.getRange(2, cN + 1, filas, 1).setValues(nuevos);

  // Las notas y los cambios por aprobar siguen apuntando al mismo producto
  [[HOJA_NOTAS, 3], [HOJA_APROBAR, 4]].forEach(function (t) {
    var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(t[0]);
    if (!h || h.getLastRow() < 2) return;
    var rango = h.getRange(2, t[1], h.getLastRow() - 1, 1), v = rango.getValues();
    rango.setValues(v.map(function (x) { var k = String(x[0]).trim(); return [k in mapa ? mapa[k] : x[0]]; }));
  });
  registrar(Session.getActiveUser().getEmail() || "", { numero: "", producto: "" }, "Números reordenados (" + n + " productos, " + cambiados + " cambiaron)");
  ui.alert("Listo: " + n + " productos numerados, " + cambiados + " cambiaron de número.");
}
