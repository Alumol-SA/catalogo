/**
 * FOTOS Y NOTAS DESDE LA APP DEL CATÁLOGO (modo revisión) — versión 5
 * Dónde va: en la hoja «Catálogo Alumol – Productos» › Extensiones › Apps Script.
 * Qué hace:
 *  - Subir foto: la guarda en una carpeta de Google Drive, la comparte como «cualquiera con el enlace
 *    puede ver» y pega el enlace en la columna Foto del producto (lo busca por el N°, y si no, por el nombre).
 *    Si el producto ya tenía una foto subida desde la app, la anterior se manda a la papelera de Drive.
 *  - Quitar foto: deja la celda Foto en blanco y manda a la papelera la foto, solo si se subió desde la app.
 *  - Marcar para mejorar: escribe SÍ (o borra) en la columna «Mejorar foto» (se crea sola si no existe).
 *  - Notas: guarda notas por producto en la pestaña «Notas de revisión» (no se publica; solo la ve la app
 *    de revisión con la clave). Se pueden marcar como resueltas.
 *  - Ocultar / mostrar producto: escribe NO o SÍ en la columna «Mostrar».
 *  - Menú «Catálogo › Reordenar números» en la hoja: numera todo del 1 en adelante en el mismo orden
 *    de la app (sección por sección, con los ocultos en su lugar) y actualiza las notas.
 *  - Registro: cada acción queda anotada en la pestaña «Registro de fotos» (fecha, quién, N°, producto, acción).
 */

// Clave para que solo ustedes puedan cambiar fotos y notas. La app la pide una sola vez en cada celular.
var CLAVE = "alumol2026";
// Carpeta de Drive donde se guardan las fotos (se crea sola si no existe).
var CARPETA = "Fotos catálogo (desde la app)";
var HOJA_NOTAS = "Notas de revisión";
var HOJA_REGISTRO = "Registro de fotos";
var VERSION = 5;

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (String(d.clave || "").trim() !== CLAVE) return salida({ ok: false, error: "La clave no es correcta." });
    var accion = d.accion || "subir", autor = String(d.autor || "").slice(0, 60);

    // Notas: van en su propia pestaña
    if (accion === "nota") {
      var texto = String(d.nota || "").trim().slice(0, 1000);
      if (!texto) return salida({ ok: false, error: "La nota está vacía." });
      var hn = pestana(HOJA_NOTAS, ["Fecha", "Quién", "N°", "Producto", "Nota", "Estado"]);
      hn.appendRow([new Date(), autor, d.numero || "", d.producto || "", texto, "Pendiente"]);
      registrar(autor, d, "Nota: " + texto);
      return salida({ ok: true, fila: hn.getLastRow() });
    }
    if (accion === "resolver") {
      var hr = pestana(HOJA_NOTAS, ["Fecha", "Quién", "N°", "Producto", "Nota", "Estado"]);
      var f = parseInt(d.fila, 10);
      if (!(f >= 2 && f <= hr.getLastRow())) return salida({ ok: false, error: "No encuentro esa nota." });
      hr.getRange(f, 6).setValue("Resuelta");
      registrar(autor, d, "Nota resuelta");
      return salida({ ok: true });
    }

    var hoja = buscarHoja();
    if (!hoja) return salida({ ok: false, error: "No encuentro la hoja con las columnas Producto y Foto." });
    var ultimaCol = hoja.getLastColumn();
    var cab = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0].map(normal);
    var cN = columna(cab, "n°"), cP = columna(cab, "producto"), cF = columna(cab, "foto"), cM = columna(cab, "mejorar foto");
    var datos = hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), ultimaCol).getValues();

    var fila = -1, i;
    if (d.numero && cN >= 0) for (i = 0; i < datos.length; i++) if (String(datos[i][cN]).trim() === String(d.numero).trim()) { fila = i; break; }
    if (fila < 0 && cP >= 0) for (i = 0; i < datos.length; i++) if (normal(datos[i][cP]) === normal(d.producto)) { fila = i; break; }
    if (fila < 0) return salida({ ok: false, error: "No encuentro ese producto en la hoja." });
    var celdaFoto = hoja.getRange(fila + 2, cF + 1);
    var anterior = String(datos[fila][cF] || "");

    if (accion === "mostrar") {
      var cV = columna(cab, "mostrar");
      if (cV < 0) { cV = ultimaCol; hoja.getRange(1, cV + 1).setValue("Mostrar (SÍ/NO)"); }
      hoja.getRange(fila + 2, cV + 1).setValue(d.valor ? "SÍ" : "NO");
      registrar(autor, d, d.valor ? "Producto mostrado en el catálogo" : "Producto ocultado del catálogo");
      return salida({ ok: true, fila: fila + 2 });
    }

    if (accion === "quitar") {
      celdaFoto.setValue("");
      if (cM >= 0) hoja.getRange(fila + 2, cM + 1).setValue("");
      var aPapelera = mandarAPapelera(anterior);
      registrar(autor, d, "Foto quitada");
      return salida({ ok: true, fila: fila + 2, papelera: aPapelera });
    }

    if (accion === "mejorar") {
      if (cM < 0) { cM = ultimaCol; hoja.getRange(1, cM + 1).setValue("Mejorar foto"); }
      hoja.getRange(fila + 2, cM + 1).setValue(d.valor ? "SÍ" : "");
      registrar(autor, d, d.valor ? "Marcada para mejorar" : "Quitada la marca de mejorar");
      return salida({ ok: true, fila: fila + 2 });
    }

    // Subir (o cambiar) foto
    var nombre = (d.numero ? "N" + d.numero + " - " : "") + String(d.producto).replace(/[\\/:*?"<>|]/g, "-") + ".jpg";
    var bytes = Utilities.base64Decode(String(d.imagen).split(",").pop());
    var archivo = carpeta().createFile(Utilities.newBlob(bytes, "image/jpeg", nombre));
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = "https://drive.google.com/file/d/" + archivo.getId() + "/view";
    celdaFoto.setValue(url);
    if (cM >= 0) hoja.getRange(fila + 2, cM + 1).setValue("");
    mandarAPapelera(anterior);
    registrar(autor, d, anterior ? "Foto cambiada" : "Foto subida");
    return salida({ ok: true, url: url, fila: fila + 2 });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  }
}

// GET: sin parámetros dice la versión (para comprobar que quedó instalado).
// Con ?accion=notas&clave=… devuelve las notas para la app de revisión.
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.accion === "notas") {
    if (String(p.clave || "").trim() !== CLAVE) return salida({ ok: false, error: "La clave no es correcta." });
    var hn = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_NOTAS), notas = [];
    if (hn && hn.getLastRow() > 1) {
      var v = hn.getRange(2, 1, hn.getLastRow() - 1, 6).getValues();
      for (var i = 0; i < v.length; i++) {
        if (!v[i][4]) continue;
        var fecha = v[i][0] instanceof Date ? Utilities.formatDate(v[i][0], "America/Guayaquil", "dd/MM HH:mm") : String(v[i][0]);
        notas.push({ fila: i + 2, fecha: fecha, autor: String(v[i][1]), numero: String(v[i][2]), producto: String(v[i][3]), nota: String(v[i][4]), estado: String(v[i][5] || "Pendiente") });
      }
    }
    return salida({ ok: true, notas: notas });
  }
  return salida({ ok: true, version: VERSION, mensaje: "Fotos y notas del catálogo listas" });
}

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
// Solo manda a la papelera fotos que estén en la carpeta de la app (nunca otras fotos de Drive).
function mandarAPapelera(enlace) {
  var m = String(enlace).match(/\/d\/([A-Za-z0-9_-]{20,})/) || String(enlace).match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  if (!m) return false;
  try {
    var f = DriveApp.getFileById(m[1]), padres = f.getParents();
    while (padres.hasNext()) if (padres.next().getName() === CARPETA) { f.setTrashed(true); return true; }
  } catch (e) {}
  return false;
}
function buscarHoja() {
  var hojas = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < hojas.length; i++) {
    var n = hojas[i].getName();
    if (n === HOJA_NOTAS || n === HOJA_REGISTRO || hojas[i].getLastColumn() < 2) continue;
    var cab = hojas[i].getRange(1, 1, 1, hojas[i].getLastColumn()).getValues()[0].map(normal);
    if (columna(cab, "producto") >= 0 && columna(cab, "foto") >= 0) return hojas[i];
  }
  return null;
}
function carpeta() {
  var it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
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
    "Las notas se actualizan solas. Avísale a quien esté subiendo fotos que actualice la app después.\n\n¿Continuar?",
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;

  var ultimaCol = hoja.getLastColumn(), filas = hoja.getLastRow() - 1;
  if (filas < 1) return;
  var cab = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0].map(normal);
  var cN = columna(cab, "n°"), cS = columna(cab, "secci"), cP = columna(cab, "producto");
  if (cN < 0) { cN = ultimaCol; hoja.getRange(1, cN + 1).setValue("N°"); ultimaCol++; }
  var datos = hoja.getRange(2, 1, filas, ultimaCol).getValues();

  // Secciones en orden de aparición y filas de cada una
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

  // Las notas siguen apuntando al mismo producto
  var hn = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_NOTAS);
  if (hn && hn.getLastRow() > 1) {
    var rango = hn.getRange(2, 3, hn.getLastRow() - 1, 1), v = rango.getValues();
    rango.setValues(v.map(function (x) { var k = String(x[0]).trim(); return [k in mapa ? mapa[k] : x[0]]; }));
  }
  registrar(Session.getActiveUser().getEmail() || "", { numero: "", producto: "" }, "Números reordenados (" + n + " productos, " + cambiados + " cambiaron)");
  ui.alert("Listo: " + n + " productos numerados, " + cambiados + " cambiaron de número.");
}
