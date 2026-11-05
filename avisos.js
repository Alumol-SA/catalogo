/* Barra de avisos (lee avisos.json en la raíz del sitio) */
(function(){
  var base = document.currentScript && document.currentScript.getAttribute("data-base") || "";
  function hoyGye(){ // fecha de hoy en Guayaquil, AAAA-MM-DD
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  fetch(base + "avisos.json", { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
    if (!d || !d.avisos) return;
    var hoy = hoyGye();
    var lista = d.avisos.filter(function(a){ return a && a.texto && (!a.hasta || a.hasta >= hoy) && (!a.desde || a.desde <= hoy); });
    if (!lista.length) return;
    var cerrados = {}; try { cerrados = JSON.parse(localStorage.getItem("alumol-avisos-cerrados") || "{}") || {}; } catch (e) {}
    lista = lista.filter(function(a){ return !cerrados[a.texto]; });
    if (!lista.length) return;
    var st = document.createElement("style");
    st.textContent = ".aviso-alumol{background:#56C5D0;color:#0A3F45;font-family:Figtree,'Segoe UI',sans-serif;font-size:15px;font-weight:600;line-height:1.4}" +
      ".aviso-alumol .in{max-width:1120px;margin:0 auto;padding:9px 52px 9px 20px;position:relative;text-align:center}" +
      ".aviso-alumol a{color:#0A3F45;font-weight:800}" +
      ".aviso-alumol button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;color:#0A3F45;font-size:22px;line-height:1;cursor:pointer;border-radius:8px}" +
      ".aviso-alumol button:hover{background:rgba(255,255,255,.35)}" +
      ".aviso-alumol + .aviso-alumol{border-top:1px solid rgba(10,63,69,.15)}";
    document.head.appendChild(st);
    var frag = document.createDocumentFragment();
    lista.forEach(function(a){
      var div = document.createElement("div"); div.className = "aviso-alumol"; div.setAttribute("role", "status");
      var in_ = document.createElement("div"); in_.className = "in";
      var txt = document.createElement(a.enlace ? "a" : "span"); txt.textContent = a.texto;
      if (a.enlace){ txt.href = a.enlace; }
      var x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", "Cerrar aviso"); x.textContent = "×";
      x.addEventListener("click", function(){ cerrados[a.texto] = 1; try { localStorage.setItem("alumol-avisos-cerrados", JSON.stringify(cerrados)); } catch (e) {} div.remove(); });
      in_.appendChild(txt); in_.appendChild(x); div.appendChild(in_); frag.appendChild(div);
    });
    document.body.insertBefore(frag, document.body.firstChild);
  }).catch(function(){});
})();
