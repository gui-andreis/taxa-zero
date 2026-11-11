/** JavaScript do navegador (servido em /assets/app.js). Sem frameworks, sem scripts inline. */
export const CLIENT_JS = /* js */ `
(function(){
  // Copiar Pix Copia e Cola
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var input = document.getElementById(btn.getAttribute('data-copy'));
      if(!input) return;
      input.select();
      (navigator.clipboard ? navigator.clipboard.writeText(input.value) : Promise.reject()).catch(function(){ document.execCommand('copy') });
      var old = btn.textContent; btn.textContent = 'Copiado ✓';
      setTimeout(function(){ btn.textContent = old }, 2000);
    });
  });

  // Confirmação antes de ações importantes
  document.querySelectorAll('form[data-confirm]').forEach(function(f){
    f.addEventListener('submit', function(e){ if(!confirm(f.getAttribute('data-confirm'))) e.preventDefault() });
  });

  // Tela do pedido: verifica o pagamento a cada 5 segundos
  var poll = document.querySelector('[data-poll]');
  if(poll){
    var url = poll.getAttribute('data-poll'), tries = 0;
    var tick = function(){
      tries++;
      fetch(url, {headers:{accept:'application/json'}}).then(function(r){return r.json()}).then(function(d){
        if(d.status !== poll.getAttribute('data-status')) location.reload();
        else if(tries < 360) setTimeout(tick, tries < 60 ? 5000 : 15000);
      }).catch(function(){ setTimeout(tick, 15000) });
    };
    setTimeout(tick, 4000);
  }

  // Redireciona para o checkout seguro (cartão)
  var go = document.querySelector('[data-redirect]');
  if(go) setTimeout(function(){ location.href = go.getAttribute('data-redirect') }, 1500);

  // Mostra/esconde campos do tipo de vídeo
  document.querySelectorAll('select[data-toggle]').forEach(function(sel){
    var update = function(){
      document.querySelectorAll('[data-show-for]').forEach(function(el){
        el.style.display = el.getAttribute('data-show-for').split(' ').indexOf(sel.value) >= 0 ? '' : 'none';
      });
    };
    sel.addEventListener('change', update); update();
  });

  // Upload direto para o armazenamento (R2). Vídeos grandes vão em partes de 50 MB.
  var CHUNK = 50 * 1024 * 1024;
  function post(url, body, headers){
    return fetch(url, {method:'POST', body: body, headers: headers || {}}).then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error(t || ('Erro ' + r.status)) });
      return r.json();
    });
  }
  document.querySelectorAll('input[type=file][data-upload]').forEach(function(input){
    input.addEventListener('change', function(){
      var file = input.files && input.files[0]; if(!file) return;
      var kind = input.getAttribute('data-upload');
      var target = document.getElementById(input.getAttribute('data-target'));
      var bar = document.getElementById(input.getAttribute('data-bar'));
      var status = document.getElementById(input.getAttribute('data-status'));
      var form = input.closest('form'); var submit = form && form.querySelector('button[type=submit]');
      if(submit) submit.disabled = true;
      if(bar){ bar.style.display = 'block' }
      var setP = function(p){ if(bar) bar.firstElementChild.style.width = Math.round(p*100) + '%'; if(status) status.textContent = 'Enviando… ' + Math.round(p*100) + '%' };
      var done = function(key){ if(target) target.value = key; if(status) status.textContent = 'Enviado ✓ ' + file.name; if(submit) submit.disabled = false; setP(1) };
      var fail = function(err){ if(status) status.textContent = 'Falhou: ' + err.message; if(submit) submit.disabled = false };
      var q = '?kind=' + kind + '&name=' + encodeURIComponent(file.name) + '&type=' + encodeURIComponent(file.type || 'application/octet-stream');
      if(file.size <= CHUNK){
        setP(0.05);
        post('/admin/upload/simple' + q, file).then(function(r){ done(r.key) }).catch(fail);
        return;
      }
      post('/admin/upload/start' + q).then(function(r){
        var parts = [], n = Math.ceil(file.size / CHUNK), i = 0;
        var next = function(){
          if(i >= n) return post('/admin/upload/finish?key=' + encodeURIComponent(r.key) + '&uploadId=' + encodeURIComponent(r.uploadId), JSON.stringify(parts), {'content-type':'application/json'}).then(function(){ done(r.key) });
          var blob = file.slice(i*CHUNK, Math.min(file.size, (i+1)*CHUNK));
          return post('/admin/upload/part?key=' + encodeURIComponent(r.key) + '&uploadId=' + encodeURIComponent(r.uploadId) + '&part=' + (i+1), blob).then(function(p){
            parts.push(p); i++; setP(i/n); return next();
          });
        };
        return next();
      }).catch(fail);
    });
  });
})();
`
