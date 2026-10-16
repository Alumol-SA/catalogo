/**
 * FOTOS DESDE LA APP DEL CATÁLOGO (modo revisión) — versión 2
 * Dónde va: en la hoja «Catálogo Alumol – Productos» › Extensiones › Apps Script.
 * Qué hace:
 *  - Subir foto: la guarda en una carpeta de Google Drive, la comparte como «cualquiera con el enlace
 *    puede ver» y pega el enlace en la columna Foto del producto (lo busca por el N°, y si no, por el nombre).
 *    Si el producto ya tenía una foto subida desde la app, la anterior se manda a la papelera de Drive.
 *  - Quitar foto: deja la celda Foto en blanco y manda a la papelera la foto, solo si se subió desde la app.
 *  - Marcar para mejorar: escribe SÍ (o borra) en la columna «Mejorar foto» (se crea sola si no existe).
 */

// Clave para que solo ustedes puedan cambiar fotos. La app la pide una sola vez en cada celular.
var CLAVE = "alumol2026";
// Carpeta de Drive donde se guardan las fotos (se crea sola si no existe).
var CARPETA = "Fotos catálogo (desde la app)";
var VERSION = 2;

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (String(d.clave || "").trim() !== CLAVE) return salida({ ok: false, error: "La clave no es correcta." });
    var accion = d.accion || "subir";

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

    if (accion === "quitar") {
      celdaFoto.setValue("");
      if (cM >= 0) hoja.getRange(fila + 2, cM + 1).setValue("");
      var aPapelera = mandarAPapelera(anterior);
      return salida({ ok: true, fila: fila + 2, papelera: aPapelera });
    }

    if (accion === "mejorar") {
      if (cM < 0) { cM = ultimaCol; hoja.getRange(1, cM + 1).setValue("Mejorar foto"); }
      hoja.getRange(fila + 2, cM + 1).setValue(d.valor ? "SÍ" : "");
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
    return salida({ ok: true, url: url, fila: fila + 2 });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  }
}

// Para comprobar que quedó instalado: abrir el enlace de la aplicación web en el navegador.
function doGet() { return salida({ ok: true, version: VERSION, mensaje: "Fotos del catálogo listas" }); }

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
    if (hojas[i].getLastColumn() < 2) continue;
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
