/**
 * SUBIR FOTOS DESDE LA APP DEL CATÁLOGO (modo revisión)
 * Dónde va: en la hoja «Catálogo Alumol – Productos» › Extensiones › Apps Script.
 * Qué hace: recibe la foto que se toma en la app, la guarda en una carpeta de Google Drive,
 * la comparte como «cualquiera con el enlace puede ver» y pega el enlace en la columna Foto
 * de la fila del producto (lo busca por el N°, y si no, por el nombre).
 */

// Clave para que solo ustedes puedan subir fotos. Cámbiala si quieres; la app la pide una sola vez.
var CLAVE = "alumol2026";
// Carpeta de Drive donde se guardan las fotos (se crea sola si no existe).
var CARPETA = "Fotos catálogo (desde la app)";

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (String(d.clave || "").trim() !== CLAVE) return salida({ ok: false, error: "La clave no es correcta." });

    var hoja = buscarHoja();
    if (!hoja) return salida({ ok: false, error: "No encuentro la hoja con las columnas Producto y Foto." });
    var ultimaCol = hoja.getLastColumn();
    var cab = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0].map(normal);
    var cN = columna(cab, "n°"), cP = columna(cab, "producto"), cF = columna(cab, "foto");
    var datos = hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), ultimaCol).getValues();

    var fila = -1, i;
    if (d.numero && cN >= 0) for (i = 0; i < datos.length; i++) if (String(datos[i][cN]).trim() === String(d.numero).trim()) { fila = i; break; }
    if (fila < 0 && cP >= 0) for (i = 0; i < datos.length; i++) if (normal(datos[i][cP]) === normal(d.producto)) { fila = i; break; }
    if (fila < 0) return salida({ ok: false, error: "No encuentro ese producto en la hoja." });

    var nombre = (d.numero ? "N" + d.numero + " - " : "") + String(d.producto).replace(/[\\/:*?"<>|]/g, "-") + ".jpg";
    var bytes = Utilities.base64Decode(String(d.imagen).split(",").pop());
    var archivo = carpeta().createFile(Utilities.newBlob(bytes, "image/jpeg", nombre));
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = "https://drive.google.com/file/d/" + archivo.getId() + "/view";
    hoja.getRange(fila + 2, cF + 1).setValue(url);
    return salida({ ok: true, url: url, fila: fila + 2 });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  }
}

// Para comprobar que quedó instalado: abrir el enlace de la aplicación web en el navegador.
function doGet() { return salida({ ok: true, mensaje: "Subida de fotos lista" }); }

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
