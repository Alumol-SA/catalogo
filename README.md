# Catálogo de accesorios · Alumol S.A.

Página pública del catálogo (GitHub Pages). Los productos se leen en vivo desde la hoja de Google
"Catálogo Alumol – Productos" publicada como CSV; si la hoja no responde, se usa `productos-respaldo.csv`.

- Para agregar, cambiar u ocultar productos: editar la hoja de Google (no hace falta tocar este repositorio).
- Fotos: en la columna "Foto" se pega el enlace de la foto en Google Drive (carpeta compartida como lector),
  o el nombre de una foto guardada en `fotos/` (ver `fotos/indice.json`).
- Configuración (enlace de la hoja y número de WhatsApp): al inicio del `<script>` en `index.html`.
- Prueba de carga con 755 productos: abrir la página con `?prueba=1` al final del enlace.

## Fotos desde la app (modo revisión)

- Abrir `?revision=1`: botón «Ver solo los que faltan foto» y botón «Subir foto» en cada producto (y «Cambiar foto» en la ficha).
- El fondo se quita en el mismo celular con la herramienta de la carpeta `quitar-fondo/` (ver su LEEME.txt).
- La foto se guarda en Drive y en la columna Foto de la hoja mediante `apps-script/subir-fotos.gs`,
  instalado en la hoja como «aplicación web». Su enlace va en `SUBIR_FOTOS` dentro de `index.html`.
