/* ================================================================
   CotiFácil — script.js  (versión completa con todas las mejoras)
   ================================================================ */

if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {

// ── Estado global ─────────────────────────────────────────────────
const App = {
  currentPage: 'dashboard',
  clients:     [],
  products:    [],
  documents:   [],
  providers:   [],
  user:        null,
  config:      {},
  csvClientes: [],
  csvProductos:[],
  docViendoId: null,
};

// ── Constantes de estados por tipo ────────────────────────────────
const ESTADOS = {
  cotizacion:   ['borrador','enviada','aceptada','rechazada','vencida'],
  factura:      ['pendiente','enviada','pagada','anulada'],
  orden_compra: ['borrador','enviada','recibida','cancelada'],
};
const ESTADO_LABEL = {
  borrador:'Borrador', enviada:'Enviada', aceptada:'Aceptada', rechazada:'Rechazada',
  vencida:'Vencida',  pendiente:'Pendiente', pagada:'Pagada', anulada:'Anulada',
  recibida:'Recibida', cancelada:'Cancelada',
};
const ESTADO_COLOR = {
  borrador:'#64748b', enviada:'#3b82f6', aceptada:'#10b981', rechazada:'#ef4444',
  vencida:'#f59e0b',  pendiente:'#f59e0b', pagada:'#10b981',  anulada:'#ef4444',
  recibida:'#10b981', cancelada:'#ef4444',
};

// ── Init ──────────────────────────────────────────────────────────

// ── Utilidades (from backup) ─────────────────────────
function abrirConfiguracion() {
  const cfg = App.config;
  if (cfg.empresaNombre) document.getElementById('cfg-empresa-nombre').value = cfg.empresaNombre;
  if (cfg.empresaRut) document.getElementById('cfg-empresa-rut').value = cfg.empresaRut;
  if (cfg.empresaTelefono) document.getElementById('cfg-empresa-telefono').value = cfg.empresaTelefono;
  if (cfg.empresaDireccion) document.getElementById('cfg-empresa-direccion').value = cfg.empresaDireccion;
  if (cfg.empresaEmail) document.getElementById('cfg-empresa-email').value = cfg.empresaEmail;
  if (cfg.prefijosCot) document.getElementById('cfg-prefijo-cot').value = cfg.prefijosCot;
  if (cfg.prefijosOC) document.getElementById('cfg-prefijo-oc').value = cfg.prefijosOC;
  if (cfg.prefijosFac) document.getElementById('cfg-prefijo-fac').value = cfg.prefijosFac;
  if (cfg.piePagina) document.getElementById('cfg-pie-pagina').value = cfg.piePagina;
  if (cfg.appNombre) document.getElementById('cfg-app-nombre').value = cfg.appNombre;
  showModal('config-modal');
}

function abrirPerfil() {
  if (App.user) {
    document.getElementById('perfil-nombre').value = App.user.name || '';
    document.getElementById('perfil-email').value  = App.user.email || '';
    document.getElementById('perfil-pwd-actual').value = '';
    document.getElementById('perfil-pwd-nueva').value  = '';
    const av = document.getElementById('perfil-avatar');
    if (av) av.textContent = (App.user.name||'U').charAt(0).toUpperCase();
  }
  showModal('perfil-modal');
}

function cambiarColor(color, btn) {
  document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  App.config.color = color;
  document.documentElement.style.setProperty('--primary-color', color);
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function closeDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
}

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', minimumFractionDigits:0 }).format(amount);
}

async function generarPDF(id) {
  try {
    const res = await fetch(`/api/generate-pdf/${id}`);
    const data = await res.json();
    if (data.success) showMessage('PDF generado exitosamente', 'success');
    else showMessage('Error al generar PDF', 'error');
  } catch { showMessage('Error al generar PDF', 'error'); }
}

function guardarConfiguracion() {
  App.config = {
    ...App.config,
    empresaNombre: document.getElementById('cfg-empresa-nombre')?.value,
    empresaRut:    document.getElementById('cfg-empresa-rut')?.value,
    empresaTelefono: document.getElementById('cfg-empresa-telefono')?.value,
    empresaDireccion: document.getElementById('cfg-empresa-direccion')?.value,
    empresaEmail:  document.getElementById('cfg-empresa-email')?.value,
    prefijosCot:   document.getElementById('cfg-prefijo-cot')?.value,
    prefijosOC:    document.getElementById('cfg-prefijo-oc')?.value,
    prefijosFac:   document.getElementById('cfg-prefijo-fac')?.value,
    piePagina:     document.getElementById('cfg-pie-pagina')?.value,
    appNombre:     document.getElementById('cfg-app-nombre')?.value,
    incluirIva:    document.getElementById('cfg-incluir-iva')?.checked,
    mostrarLogo:   document.getElementById('cfg-mostrar-logo')?.checked,
    mostrarEmpresa: document.getElementById('cfg-mostrar-empresa')?.checked,
  };
  try { localStorage.setItem('cotifacil_config', JSON.stringify(App.config)); } catch(e) {}
  aplicarConfig();
  hideModal('config-modal');
  showMessage('Configuración guardada', 'success');
}

function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showMessage('Logo muy grande, máximo 2MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    App.config.logo = e.target.result;
    const container = document.getElementById('logo-preview-container');
    if (container) container.innerHTML = `<img src="${e.target.result}" style="max-height:60px;max-width:160px;object-fit:contain;">`;
    showMessage('Logo cargado correctamente', 'success');
  };
  reader.readAsDataURL(file);
}

function hideModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'none';
}

function mostrarCfgPanel(panel) {
  document.querySelectorAll('.cfg-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cfg-tab').forEach(t => t.classList.remove('active'));
  const p = document.getElementById(`cfgpanel-${panel}`);
  const t = document.getElementById(`cfgtab-${panel}`);
  if (p) p.classList.add('active');
  if (t) t.classList.add('active');
}

function setText(selector, value) {
  const el = typeof selector === 'string'
    ? (selector.startsWith('[') || selector.startsWith('#') && !document.getElementById(selector.slice(1))
       ? document.querySelector(selector) : document.getElementById(selector.replace(/^#/,'')))
    : selector;
  if (el) el.textContent = value;
}

function setupDropdownClose() {
  document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) closeDropdowns();
  });
}

function setupForms() {
  // Cliente
  const cForm = document.getElementById('cliente-form');
  if (cForm) cForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('cliente-id').value;
    const payload = {
      rut:          document.getElementById('rut').value.trim(),
      razon_social: document.getElementById('razon-social').value.trim(),
      direccion:    document.getElementById('direccion').value.trim(),
      region:       document.getElementById('region').value,
      ciudad:       document.getElementById('ciudad').value.trim(),
      telefono:     document.getElementById('telefono').value.trim(),
      email:        document.getElementById('email').value.trim(),
      nota:         document.getElementById('nota').value.trim(),
    };
    try {
      const res = await fetch(id ? `/api/clients/${id}` : '/api/clients', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) { hideModal('cliente-modal'); showMessage(id ? 'Cliente actualizado' : 'Cliente creado', 'success'); loadClients(); }
      else showMessage(data.error || 'Error al guardar', 'error');
    } catch { showMessage('Error de conexión', 'error'); }
  });

  // Producto
  const pForm = document.getElementById('producto-form');
  if (pForm) pForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('producto-id').value;
    const payload = {
      sku:          document.getElementById('sku').value.trim(),
      nombre:       document.getElementById('nombre').value.trim(),
      precio:       parseFloat(document.getElementById('precio').value)||0,
      stock:        parseInt(document.getElementById('stock').value)||0,
      stock_minimo: parseInt(document.getElementById('stock_minimo').value)||0,
      categoria:    document.getElementById('categoria').value.trim(),
      proveedor:    document.getElementById('proveedor').value.trim(),
      descripcion:  document.getElementById('descripcion-producto').value.trim(),
    };
    try {
      const res = await fetch(id ? `/api/products/${id}` : '/api/products', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) { hideModal('producto-modal'); showMessage(id ? 'Producto actualizado' : 'Producto creado', 'success'); loadProducts(); }
      else showMessage(data.error || 'Error al guardar', 'error');
    } catch { showMessage('Error de conexión', 'error'); }
  });

  // Perfil
  const perfilForm = document.getElementById('perfil-form');
  if (perfilForm) perfilForm.addEventListener('submit', async e => {
    e.preventDefault();
    const nombre = document.getElementById('perfil-nombre').value.trim();
    const email  = document.getElementById('perfil-email').value.trim();
    const pwdAct = document.getElementById('perfil-pwd-actual').value;
    const pwdNew = document.getElementById('perfil-pwd-nueva').value;
    const payload = { name: nombre, email };
    if (pwdNew) { payload.password_actual = pwdAct; payload.password_nueva = pwdNew; }
    try {
      const res = await fetch('/api/user/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        hideModal('perfil-modal');
        showMessage('Perfil actualizado', 'success');
        await loadUser();
      } else showMessage(data.error || 'Error al actualizar', 'error');
    } catch { showMessage('Error de conexión', 'error'); }
  });
}

function setupSearch() {
  const cs = document.getElementById('client-search');
  if (cs) cs.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderClients(App.clients.filter(c =>
      (c.rut||'').toLowerCase().includes(q) ||
      (c.razon_social||'').toLowerCase().includes(q) ||
      (c.ciudad||'').toLowerCase().includes(q) ||
      (c.email||'').toLowerCase().includes(q)
    ));
  });
  const ps = document.getElementById('product-search');
  if (ps) ps.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderProducts(App.products.filter(p =>
      (p.sku||'').toLowerCase().includes(q) ||
      (p.nombre||'').toLowerCase().includes(q) ||
      (p.categoria||'').toLowerCase().includes(q) ||
      (p.proveedor||'').toLowerCase().includes(q)
    ));
  });
}

function showError(tbodyId, msg, cols = 6) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty-table-message" style="color:#f87171;"><i class="fas fa-exclamation-circle" style="margin-right:.5rem;"></i>${msg}</td></tr>`;
}

function showLoading(tbodyId, cols = 6) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty-table-message"><i class="fas fa-spinner fa-spin" style="margin-right:.5rem;"></i>Cargando...</td></tr>`;
}

function showMessage(text, type = 'success') {
  const prev = document.getElementById('global-message');
  if (prev) prev.remove();
  const div = document.createElement('div');
  div.id = 'global-message';
  div.style.cssText = `
    position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
    padding:.875rem 1.25rem;border-radius:10px;font-size:.9rem;font-weight:500;
    display:flex;align-items:center;gap:.6rem;box-shadow:0 10px 30px rgba(0,0,0,.3);
    animation:slideIn .3s ease;
    ${type === 'success'
      ? 'background:#052e16;border:1px solid #166534;color:#86efac;'
      : 'background:#2d0808;border:1px solid #7f1d1d;color:#fca5a5;'}
  `;
  div.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':'fa-exclamation-circle'}"></i><span>${text}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function showModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  document.body.appendChild(m);
  m.style.display = 'block';
  m.classList.add('scale-in');
}

function tipoLabel(tipo) {
  const map = { cotizacion:'Cotización', orden_compra:'Orden Compra', factura:'Factura' };
  return map[tipo] || tipo || '—';
}

function toggleDropdown(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  closeDropdowns();
  if (!isOpen) menu.classList.add('open');
}

document.addEventListener('DOMContentLoaded', async () => {
  cargarConfig();
  await loadUser();
  setupNavigation();
  setupLogout();
  setupForms();
  setupSearch();
  setupDropdownClose();
  const hash = window.location.hash.replace('#','') || 'dashboard';
  navigateTo(hash);
});

// ── Config (localStorage) ─────────────────────────────────────────
function cargarConfig() {
  try {
    const saved = localStorage.getItem('cotifacil_config');
    if (saved) { App.config = JSON.parse(saved); aplicarConfig(); }
  } catch(e) {}
}

function aplicarConfig() {
  const cfg = App.config;
  if (cfg.color) document.documentElement.style.setProperty('--primary-color', cfg.color);
  if (cfg.appNombre) {
    const t = document.getElementById('app-title');
    if (t) t.textContent = cfg.appNombre;
  }
}

// ── Usuario ───────────────────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/user');
    if (res.ok) {
      App.user = await res.json();
      const initials = (App.user.name || 'U').charAt(0).toUpperCase();
      const hav = document.getElementById('header-avatar-initials');
      const hu  = document.getElementById('header-username');
      if (hav) hav.textContent = initials;
      if (hu)  hu.textContent  = (App.user.name||'Usuario').split(' ')[0];
      const info = document.getElementById('user-info');
      if (info) {
        const n = info.querySelector('.user-name');
        const e = info.querySelector('.user-email');
        if (n) n.textContent = App.user.name  || 'Usuario';
        if (e) e.textContent = App.user.email || '';
      }
      // Cargar config del servidor
      try {
        const cfgRes  = await fetch('/api/user/config');
        const cfgData = await cfgRes.json();
        if (cfgData && !cfgData.error) {
          App.config = { ...App.config, ...cfgData };
          aplicarConfig();
        }
      } catch(e) {}
    } else { window.location.href = '/login'; }
  } catch { window.location.href = '/login'; }
}

// ── Logout ────────────────────────────────────────────────────────
function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) btn.addEventListener('click', doLogout);
}
async function doLogout() { await fetch('/logout'); window.location.href = '/login'; }

// ── Navegación ────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
      window.location.hash = page;
    });
  });
  window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#','') || 'dashboard';
    navigateTo(page);
  });
}

function navigateTo(page) {
  document.querySelectorAll('.page-content').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const target = document.getElementById(`${page}-page`);
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
  const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');
  const titles = { dashboard:'Dashboard', clientes:'Clientes', productos:'Productos', documentos:'Documentos', 'crear-documento':'Crear Documento', proveedores:'Proveedores', reportes:'Reportes' };
  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;
  App.currentPage = page;
  switch (page) {
    case 'dashboard':       loadDashboard();      break;
    case 'clientes':        loadClients();        break;
    case 'productos':       loadProducts();       break;
    case 'documentos':      loadDocuments();      break;
    case 'crear-documento': initCrearDoc();       break;
    case 'proveedores':     loadProveedoresPage(); break;
    case 'reportes':        loadReportes();       break;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res   = await fetch('/api/stats');
    const stats = await res.json();
    setText('[data-stat="documents"]', stats.total_documents ?? 0);
    setText('[data-stat="clients"]',   stats.total_clients   ?? 0);
    setText('[data-stat="products"]',  stats.total_products  ?? 0);
    setText('[data-stat="sales"]',     formatCLP(stats.total_sales ?? 0));
    renderRecentDocs(stats.recent_documents || []);
    renderDocTypeSummary(stats.doc_type_stats || {});
  } catch(e) { console.error('Error dashboard', e); }
}

function renderRecentDocs(docs) {
  const c = document.getElementById('recent-docs');
  if (!c) return;
  if (!docs.length) { c.innerHTML = '<p style="color:#64748b;font-size:.875rem;">No hay documentos aún.</p>'; return; }
  c.innerHTML = docs.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid #1e2d3d;">
      <div>
        <span class="badge badge-${d.tipo||'cotizacion'}" style="margin-right:.5rem;font-size:.7rem;">${tipoLabel(d.tipo)}</span>
        <span style="font-size:.875rem;font-weight:500;">${d.number||'—'}</span>
        <p style="font-size:.78rem;color:#64748b;margin-top:.1rem;">${d.cliente?.razon_social||'Sin cliente'}</p>
      </div>
      <div style="text-align:right;">
        <span style="font-weight:600;font-size:.875rem;">${formatCLP(d.total||0)}</span>
        <p class="badge badge-${d.estado||'pendiente'}" style="margin-top:.25rem;font-size:.7rem;">${capitalize(d.estado||'pendiente')}</p>
      </div>
    </div>`).join('');
}

function renderDocTypeSummary(stats) {
  const c = document.getElementById('doc-type-summary');
  if (!c) return;
  const tipos = [
    { key:'cotizacion',   label:'Cotizaciones',      color:'#60a5fa' },
    { key:'orden_compra', label:'Órdenes de Compra',  color:'#a78bfa' },
    { key:'factura',      label:'Facturas',            color:'#34d399' },
  ];
  if (!Object.keys(stats).length) { c.innerHTML = '<p style="color:#64748b;font-size:.875rem;">No hay documentos aún.</p>'; return; }
  c.innerHTML = tipos.map(t => {
    const s = stats[t.key] || { count:0, total:0 };
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid #1e2d3d;">
      <div style="display:flex;align-items:center;gap:.6rem;">
        <div style="width:10px;height:10px;border-radius:50%;background:${t.color};flex-shrink:0;"></div>
        <span style="font-size:.875rem;">${t.label}</span>
      </div>
      <div style="text-align:right;">
        <span style="font-size:.875rem;font-weight:600;">${s.count}</span>
        <span style="color:#64748b;font-size:.78rem;margin-left:.5rem;">${formatCLP(s.total)}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Clientes ──────────────────────────────────────────────────────
async function loadClients() {
  showLoading('clients-table-body', 8);
  try {
    const res   = await fetch('/api/clients');
    App.clients = await res.json();
    renderClients(App.clients);
  } catch { showError('clients-table-body', 'Error cargando clientes', 8); }
}

function renderClients(list) {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" class="empty-table-message">No hay clientes registrados</td></tr>`; return; }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${c.rut||'—'}</td>
      <td style="font-weight:500;">${c.razon_social||'—'}</td>
      <td>${c.region||'—'}</td>
      <td>${c.ciudad||'—'}</td>
      <td><div style="font-size:.85rem;">${c.email||'—'}</div><div style="font-size:.78rem;color:#64748b;">${c.telefono||''}</div></td>
      <td>${c.documentos||0}</td>
      <td>${formatCLP(c.total||0)}</td>
      <td>
        <div class="flex gap-2">
          <button onclick="editarCliente(${c.id})" style="color:#60a5fa;background:none;border:none;cursor:pointer;padding:.25rem;" title="Editar"><i class="fas fa-edit"></i></button>
          <button onclick="eliminarCliente(${c.id})" style="color:#f87171;background:none;border:none;cursor:pointer;padding:.25rem;" title="Eliminar"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function crearCliente() {
  document.getElementById('cliente-modal-title').textContent = 'Nuevo Cliente';
  document.getElementById('cliente-form').reset();
  document.getElementById('cliente-id').value = '';
  showModal('cliente-modal');
}

async function editarCliente(id) {
  const c = App.clients.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cliente-modal-title').textContent = 'Editar Cliente';
  document.getElementById('cliente-id').value   = c.id;
  document.getElementById('rut').value           = c.rut||'';
  document.getElementById('razon-social').value  = c.razon_social||'';
  document.getElementById('direccion').value     = c.direccion||'';
  document.getElementById('region').value        = c.region||'';
  document.getElementById('ciudad').value        = c.ciudad||'';
  document.getElementById('telefono').value      = c.telefono||'';
  document.getElementById('email').value         = c.email||'';
  document.getElementById('nota').value          = c.nota||'';
  showModal('cliente-modal');
}

async function eliminarCliente(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  try {
    const res  = await fetch(`/api/clients/${id}`, { method:'DELETE' });
    const data = await res.json();
    if (data.success) { showMessage('Cliente eliminado','success'); loadClients(); }
    else showMessage(data.error||'Error al eliminar','error');
  } catch { showMessage('Error de conexión','error'); }
}

async function exportarClientes() { window.location.href = '/api/clients/export'; }

// ── Import Clientes CSV ───────────────────────────────────────────
function importarClientes() {
  const preview = document.getElementById('csv-clientes-preview');
  const input   = document.getElementById('csv-clientes-input');
  if (preview) preview.style.display = 'none';
  if (input)   input.value = '';
  App.csvClientes = [];
  showModal('import-clientes-modal');
}

function handleClientesCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    const rows  = lines.slice(1).map(l => l.split(',').map(v => v.trim().replace(/^"|"$/g,'')));
    App.csvClientes = rows.filter(r => r.length >= 2 && r[0]);
    const info    = document.getElementById('csv-clientes-info');
    const preview = document.getElementById('csv-clientes-preview');
    if (info)    info.textContent = `✓ ${App.csvClientes.length} clientes listos para importar`;
    if (preview) preview.style.display = 'block';
  };
  reader.readAsText(file, 'UTF-8');
}

async function confirmarImportarClientes() {
  const input = document.getElementById('csv-clientes-input');
  if (!input || !input.files[0]) { showMessage('Selecciona un archivo CSV primero','error'); return; }
  if (!App.csvClientes.length)   { showMessage('El archivo no tiene datos válidos','error'); return; }
  const btn = document.querySelector('#import-clientes-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...'; }
  const formData = new FormData();
  formData.append('file', input.files[0]);
  try {
    const res  = await fetch('/api/clients/import', { method:'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      hideModal('import-clientes-modal');
      showMessage(data.message || `${data.imported_count} clientes importados`, 'success');
      const preview = document.getElementById('csv-clientes-preview');
      if (preview) preview.style.display = 'none';
      input.value     = '';
      App.csvClientes = [];
      await loadClients();
    } else { showMessage(data.error || 'Error al importar','error'); }
  } catch(e) { showMessage('Error de conexión: '+e.message,'error'); }
  finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> Importar'; }
  }
}

// ── Productos ─────────────────────────────────────────────────────
async function loadProducts() {
  showLoading('products-table-body', 9);
  try {
    const res    = await fetch('/api/products');
    App.products = await res.json();
    renderProducts(App.products);
    updateProductStats(App.products);
  } catch { showError('products-table-body', 'Error cargando productos', 9); }
}

function renderProducts(list) {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="9" class="empty-table-message">No hay productos registrados</td></tr>`; return; }
  tbody.innerHTML = list.map(p => {
    const low = p.stock <= p.stock_minimo;
    return `<tr class="${low?'stock-bajo':''}">
      <td>${p.sku||'—'}</td>
      <td style="font-weight:500;">${p.nombre||'—'}</td>
      <td>${p.categoria||'—'}</td>
      <td>${p.proveedor||'—'}</td>
      <td>${formatCLP(p.precio||0)}</td>
      <td>${p.stock??0}</td>
      <td>${p.stock_minimo??0}</td>
      <td><span class="badge ${low?'badge-rechazado':'badge-aprobado'}">${low?'Stock Bajo':'Normal'}</span></td>
      <td>
        <div class="flex gap-2">
          <button onclick="editarProducto(${p.id})" style="color:#60a5fa;background:none;border:none;cursor:pointer;padding:.25rem;" title="Editar"><i class="fas fa-edit"></i></button>
          <button onclick="eliminarProducto(${p.id})" style="color:#f87171;background:none;border:none;cursor:pointer;padding:.25rem;" title="Eliminar"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateProductStats(list) {
  setText('total-products',   list.length);
  setText('total-categories', new Set(list.map(p=>p.categoria).filter(Boolean)).size);
  setText('total-value',      formatCLP(list.reduce((s,p)=>s+(p.precio||0)*(p.stock||0),0)));
  setText('low-stock-count',  list.filter(p=>p.stock<=p.stock_minimo).length);
}

function crearProducto() {
  document.getElementById('producto-modal-title').textContent = 'Nuevo Producto';
  document.getElementById('producto-form').reset();
  document.getElementById('producto-id').value = '';
  showModal('producto-modal');
}

async function editarProducto(id) {
  const p = App.products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('producto-modal-title').textContent = 'Editar Producto';
  document.getElementById('producto-id').value          = p.id;
  document.getElementById('sku').value                  = p.sku||'';
  document.getElementById('nombre').value               = p.nombre||'';
  document.getElementById('precio').value               = p.precio||'';
  document.getElementById('stock').value                = p.stock??'';
  document.getElementById('stock_minimo').value         = p.stock_minimo??'';
  document.getElementById('categoria').value            = p.categoria||'';
  document.getElementById('proveedor').value            = p.proveedor||'';
  document.getElementById('descripcion-producto').value = p.descripcion||'';
  showModal('producto-modal');
}

async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    const res  = await fetch(`/api/products/${id}`, { method:'DELETE' });
    const data = await res.json();
    if (data.success) { showMessage('Producto eliminado','success'); loadProducts(); }
    else showMessage(data.error||'Error al eliminar','error');
  } catch { showMessage('Error de conexión','error'); }
}

// ── Import Productos CSV ──────────────────────────────────────────
function importarProductos() {
  const preview = document.getElementById('csv-productos-preview');
  const input   = document.getElementById('csv-productos-input');
  if (preview) preview.style.display = 'none';
  if (input)   input.value = '';
  App.csvProductos = [];
  showModal('import-productos-modal');
}

function handleProductosCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    const rows  = lines.slice(1).map(l => l.split(',').map(v => v.trim().replace(/^"|"$/g,'')));
    App.csvProductos = rows.filter(r => r.length >= 2 && r[0]);
    const info    = document.getElementById('csv-productos-info');
    const preview = document.getElementById('csv-productos-preview');
    if (info)    info.textContent = `✓ ${App.csvProductos.length} productos listos para importar`;
    if (preview) preview.style.display = 'block';
  };
  reader.readAsText(file, 'UTF-8');
}

async function confirmarImportarProductos() {
  const input = document.getElementById('csv-productos-input');
  if (!input || !input.files[0]) { showMessage('Selecciona un archivo CSV primero','error'); return; }
  if (!App.csvProductos.length)  { showMessage('El archivo no tiene datos válidos','error'); return; }
  const btn = document.querySelector('#import-productos-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...'; }
  const formData = new FormData();
  formData.append('file', input.files[0]);
  try {
    const res  = await fetch('/api/products/import', { method:'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      hideModal('import-productos-modal');
      showMessage(data.message || `${data.imported_count} productos importados`, 'success');
      const preview = document.getElementById('csv-productos-preview');
      if (preview) preview.style.display = 'none';
      input.value      = '';
      App.csvProductos = [];
      await loadProducts();
    } else { showMessage(data.error || 'Error al importar','error'); }
  } catch(e) { showMessage('Error de conexión: '+e.message,'error'); }
  finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> Importar'; }
  }
}

// ── Documentos ────────────────────────────────────────────────────
async function loadDocuments() {
  showLoading('documents-table-body', 7);
  try {
    const res     = await fetch('/api/documents');
    App.documents = await res.json();
    renderDocuments(App.documents);
  } catch { showError('documents-table-body', 'Error cargando documentos', 7); }
}

function renderDocuments(list) {
  const tbody = document.getElementById('documents-table-body');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="7" class="empty-table-message">No hay documentos registrados</td></tr>`; return; }
  tbody.innerHTML = list.map(d => {
    const estado    = d.estado || (d.tipo === 'factura' ? 'pendiente' : 'borrador');
    const estadoColor = ESTADO_COLOR[estado] || '#64748b';
    const dest      = d.tipo === 'orden_compra'
      ? (d.proveedor?.nombre || d.proveedor?.razon_social || '—')
      : (d.cliente?.razon_social || '—');
    const puedeConvertir = d.tipo === 'cotizacion' && estado === 'aceptada' && !d.factura_id;
    const refBadge = d.origen_number
      ? `<br><span style="font-size:.7rem;color:#64748b;">↑ ${d.origen_number}</span>`
      : (d.factura_number ? `<br><span style="font-size:.7rem;color:#10b981;">→ ${d.factura_number}</span>` : '');
    return `
    <tr>
      <td style="font-weight:500;">${d.number||'—'}${refBadge}</td>
      <td><span class="badge badge-${d.tipo||'cotizacion'}">${tipoLabel(d.tipo)}</span></td>
      <td>${d.date ? d.date.split(' ')[0] : '—'}</td>
      <td>${dest}</td>
      <td>${formatCLP(d.total||0)}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:.35rem;padding:.25rem .6rem;border-radius:999px;font-size:.75rem;font-weight:600;background:${estadoColor}22;color:${estadoColor};">
          <span style="width:6px;height:6px;border-radius:50%;background:${estadoColor};flex-shrink:0;"></span>
          ${ESTADO_LABEL[estado] || estado}
        </span>
      </td>
      <td>
        <div class="flex gap-2" style="flex-wrap:wrap;">
          <button onclick="verDocumento(${d.id})"        style="color:#60a5fa;background:none;border:none;cursor:pointer;padding:.3rem;" title="Ver"><i class="fas fa-eye"></i></button>
          <button onclick="cambiarEstadoDoc(${d.id})"    style="color:#a78bfa;background:none;border:none;cursor:pointer;padding:.3rem;" title="Cambiar estado"><i class="fas fa-exchange-alt"></i></button>
          <button onclick="descargarPDF(${d.id})"        style="color:#34d399;background:none;border:none;cursor:pointer;padding:.3rem;" title="PDF"><i class="fas fa-file-pdf"></i></button>
          ${puedeConvertir ? `<button onclick="convertirAFactura(${d.id})" style="color:#10b981;background:none;border:none;cursor:pointer;padding:.3rem;font-weight:700;" title="Convertir a Factura"><i class="fas fa-file-invoice-dollar"></i></button>` : ''}
          <button onclick="eliminarDocumento(${d.id})"   style="color:#f87171;background:none;border:none;cursor:pointer;padding:.3rem;" title="Eliminar"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filtrarDocumentos() {
  const tipo   = document.getElementById('doc-filter-tipo')?.value   || '';
  const estado = document.getElementById('doc-filter-estado')?.value || '';
  renderDocuments(App.documents.filter(d =>
    (!tipo   || d.tipo   === tipo) &&
    (!estado || d.estado === estado)
  ));
}

function verDocumento(id) {
  const doc = App.documents.find(d => d.id === id);
  if (!doc) return;
  App.docViendoId = id;
  document.getElementById('ver-doc-title').textContent = doc.number || 'Documento';
  document.getElementById('doc-preview-content').innerHTML = generarHTMLDoc(doc);
  showModal('ver-documento-modal');
}

function descargarPDFActual() {
  if (App.docViendoId) descargarPDF(App.docViendoId);
}

function editarDocumento(id) {
  const doc = App.documents.find(d => d.id === id);
  if (!doc) return;
  document.getElementById('editar-doc-id').value      = id;
  document.getElementById('editar-doc-estado').value  = doc.estado  || 'pendiente';
  document.getElementById('editar-doc-validez').value = doc.validez || 30;
  document.getElementById('editar-doc-notas').value   = doc.notas   || '';
  const title = document.getElementById('editar-doc-title');
  if (title) title.textContent = `Editar: ${doc.number||'Documento'}`;
  showModal('editar-documento-modal');
}

function cambiarEstadoDoc(id) {
  const doc = App.documents.find(d => d.id === id);
  if (!doc) return;
  const tipo        = doc.tipo || 'cotizacion';
  const estadoActual= doc.estado || (tipo === 'factura' ? 'pendiente' : 'borrador');
  const estados     = ESTADOS[tipo] || [];

  // Poblar select de estados
  const sel = document.getElementById('estado-select');
  if (sel) {
    sel.innerHTML = estados.map(e =>
      `<option value="${e}" ${e===estadoActual?'selected':''}>${ESTADO_LABEL[e]||e}</option>`
    ).join('');
  }
  document.getElementById('estado-doc-id').value = id;
  const titleEl = document.getElementById('estado-doc-title');
  if (titleEl) titleEl.textContent = `${doc.number} — Cambiar estado`;

  // Mostrar si puede convertirse a factura
  const convWrap = document.getElementById('conv-factura-wrap');
  if (convWrap) {
    const puedeConvertir = tipo==='cotizacion' && estadoActual==='aceptada' && !doc.factura_id;
    convWrap.style.display = puedeConvertir ? 'block' : 'none';
  }
  showModal('cambiar-estado-modal');
}

async function confirmarCambiarEstado() {
  const id     = parseInt(document.getElementById('estado-doc-id').value);
  const estado = document.getElementById('estado-select').value;
  try {
    const res  = await fetch(`/api/documents/${id}`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ estado })
    });
    const data = await res.json();
    if (data.success) {
      hideModal('cambiar-estado-modal');
      showMessage('Estado actualizado','success');
      await loadDocuments();
    } else { showMessage(data.error||'Error al actualizar','error'); }
  } catch { showMessage('Error de conexión','error'); }
}

async function convertirAFactura(id) {
  const doc = App.documents.find(d => d.id === id);
  if (!doc) return;
  if (!confirm(`¿Convertir la cotización ${doc.number} en Factura? Se creará una nueva factura con los mismos datos.`)) return;
  try {
    const res  = await fetch(`/api/documents/${id}/convertir`, { method:'POST' });
    const data = await res.json();
    if (data.success) {
      hideModal('cambiar-estado-modal');
      showMessage(`Factura ${data.factura.number} creada exitosamente ✓`, 'success');
      await loadDocuments();
    } else { showMessage(data.error||'Error al convertir','error'); }
  } catch { showMessage('Error de conexión','error'); }
}

async function confirmarEditarDoc() {
  const id     = parseInt(document.getElementById('editar-doc-id').value);
  const estado = document.getElementById('editar-doc-estado').value;
  const validez= parseInt(document.getElementById('editar-doc-validez').value) || 30;
  const notas  = document.getElementById('editar-doc-notas').value;
  try {
    const res  = await fetch(`/api/documents/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ estado, validez, notas })
    });
    const data = await res.json();
    if (data.success) {
      hideModal('editar-documento-modal');
      showMessage('Documento actualizado','success');
      await loadDocuments();
    } else { showMessage(data.error||'Error al actualizar','error'); }
  } catch { showMessage('Error de conexión','error'); }
}

async function eliminarDocumento(id) {
  if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
  try {
    const res  = await fetch(`/api/documents/${id}`, { method:'DELETE' });
    const data = await res.json();
    if (data.success) { showMessage('Documento eliminado','success'); await loadDocuments(); }
    else showMessage(data.error||'Error al eliminar','error');
  } catch { showMessage('Error de conexión','error'); }
}

function descargarPDF(id) {
  const doc = App.documents.find(d => d.id === id);
  if (!doc) return;
  const htmlContent = generarHTMLDoc(doc);
  const ventana = window.open('','_blank');
  if (!ventana) { showMessage('Permite ventanas emergentes para descargar PDF','error'); return; }
  ventana.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${escHtml(doc.number||'Documento')}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; background: white; }
      .pagina { width: 210mm; min-height: 297mm; padding: 15mm; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; }
      @page { size: A4; margin: 0; }
      @media print {
        html, body { width: 210mm; height: 297mm; }
        .pagina { padding: 12mm 14mm; margin: 0; }
        button { display: none !important; }
      }
      @media screen {
        body { background: #e5e7eb; padding: 20px; }
        .pagina { box-shadow: 0 4px 24px rgba(0,0,0,.15); background: white; }
      }
    </style>
  </head><body>
    <div class="pagina">${htmlContent}</div>
    <script>setTimeout(()=>{window.print();},500);<\/script>
  </body></html>`);
  ventana.document.close();
}

// ── Crear Documento ───────────────────────────────────────────────
function initCrearDoc() {
  const fechaEl = document.getElementById('doc-fecha');
  if (fechaEl && !fechaEl.value) fechaEl.value = new Date().toISOString().split('T')[0];
  if (App.clients.length > 0) popularSelectClientes();
  else fetch('/api/clients').then(r=>r.json()).then(cs=>{ App.clients=cs; popularSelectClientes(); });
  if (App.products.length === 0) fetch('/api/products').then(r=>r.json()).then(ps=>{ App.products=ps; });
}

function popularSelectClientes() {
  const sel = document.getElementById('doc-cliente');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— Seleccionar cliente —</option>';
  App.clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value         = c.id;
    opt.textContent   = `${c.razon_social}${c.rut?' ('+c.rut+')':''}`;
    opt.dataset.email = c.email || '';
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

function onClienteChange() {
  const sel    = document.getElementById('doc-cliente');
  const opt    = sel.options[sel.selectedIndex];
  const email  = opt?.dataset?.email || '';
  const hint   = document.getElementById('doc-email-hint');
  const toggle = document.getElementById('doc-enviar-email');
  if (hint) {
    if (email) {
      hint.textContent = `Se enviará a: ${email}`;
      hint.style.color = '#34d399';
      if (toggle) { toggle.disabled = false; }
    } else {
      hint.textContent = 'Este cliente no tiene email registrado';
      hint.style.color = '#f87171';
      if (toggle) { toggle.checked = false; toggle.disabled = true; }
    }
  }
  actualizarPreview();
}

function seleccionarTipoDoc(tipo) {
  document.getElementById('doc-tipo').value = tipo;
  document.querySelectorAll('.doc-type-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`tipo-${tipo}`);
  if (card) card.classList.add('selected');
  document.getElementById('doc-form-container').style.display = 'block';

  // Mostrar/ocultar selector de cliente o proveedor según tipo
  const clienteRow  = document.getElementById('doc-cliente-row');
  const proveedorRow= document.getElementById('doc-proveedor-row');
  const emailToggle = document.getElementById('doc-enviar-email-row');
  if (tipo === 'orden_compra') {
    if (clienteRow)   clienteRow.style.display   = 'none';
    if (proveedorRow) proveedorRow.style.display = 'block';
    if (emailToggle)  emailToggle.style.display  = 'none';
    // Cargar proveedores
    if (App.providers.length === 0) {
      fetch('/api/providers').then(r=>r.json()).then(ps=>{ App.providers=ps; popularSelectProveedores(); });
    } else { popularSelectProveedores(); }
  } else {
    if (clienteRow)   clienteRow.style.display   = 'block';
    if (proveedorRow) proveedorRow.style.display = 'none';
    if (emailToggle)  emailToggle.style.display  = 'block';
    if (App.clients.length === 0) {
      fetch('/api/clients').then(r=>r.json()).then(cs=>{ App.clients=cs; popularSelectClientes(); });
    } else { popularSelectClientes(); }
  }

  if (App.products.length === 0) fetch('/api/products').then(r=>r.json()).then(ps=>{ App.products=ps; });
  const fechaEl = document.getElementById('doc-fecha');
  if (fechaEl && !fechaEl.value) fechaEl.value = new Date().toISOString().split('T')[0];
  if (!document.getElementById('doc-lineas').children.length) agregarLineaDoc();
  actualizarPreview();
}

function popularSelectProveedores() {
  const sel = document.getElementById('doc-proveedor');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar proveedor —</option>';
  App.providers.forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = `${p.nombre || p.razon_social || ''}${p.rut?' ('+p.rut+')':''}`;
    sel.appendChild(opt);
  });
}

function onProveedorChange() {
  actualizarPreview();
}

// ── Selector de producto del sistema ─────────────────────────────
function abrirSelectorProducto() {
  if (App.products.length === 0) {
    fetch('/api/products').then(r=>r.json()).then(ps=>{ App.products=ps; renderSelectorProductos(ps); });
  } else { renderSelectorProductos(App.products); }
  showModal('selector-producto-modal');
  const inp = document.getElementById('selector-search');
  if (inp) { inp.value=''; inp.focus(); }
}

function renderSelectorProductos(list) {
  const tbody = document.getElementById('selector-productos-body');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table-message">No hay productos en el sistema</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td style="font-size:.8rem;">${p.sku||'—'}</td>
      <td style="font-weight:500;">${p.nombre||'—'}</td>
      <td style="font-size:.8rem;color:#94a3b8;">${p.categoria||'—'}</td>
      <td style="font-weight:600;">${formatCLP(p.precio||0)}</td>
      <td style="font-size:.8rem;">${p.stock??0}</td>
      <td>
        <button onclick="agregarProductoDelSistema(${p.id})"
          style="background:#3b82f6;color:white;border:none;border-radius:6px;padding:.3rem .7rem;font-size:.8rem;cursor:pointer;white-space:nowrap;">
          <i class="fas fa-plus"></i> Agregar
        </button>
      </td>
    </tr>`).join('');
}

function filtrarSelectorProductos(q) {
  q = (q||'').toLowerCase();
  const filtered = App.products.filter(p =>
    (p.sku||'').toLowerCase().includes(q) ||
    (p.nombre||'').toLowerCase().includes(q) ||
    (p.categoria||'').toLowerCase().includes(q)
  );
  renderSelectorProductos(filtered);
}

function agregarProductoDelSistema(id) {
  const p = App.products.find(x => x.id === id);
  if (!p) return;
  agregarLineaDoc(p.nombre, 1, p.precio);
  hideModal('selector-producto-modal');
}

// ── Líneas de documento ───────────────────────────────────────────
let lineaCounter = 0;

function agregarLineaDoc(desc='', qty=1, precio=0) {
  const id        = ++lineaCounter;
  const container = document.getElementById('doc-lineas');
  const div       = document.createElement('div');
  div.id           = `linea-${id}`;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1.2fr auto;gap:.5rem;margin-bottom:.5rem;align-items:center;';
  div.innerHTML = `
    <input class="linea-input" type="text"   placeholder="Descripción del producto/servicio" value="${escHtml(desc)}"  data-linea="${id}" data-field="desc"  oninput="calcularTotales()">
    <input class="linea-input" type="number" placeholder="Cant."  value="${qty}"              data-linea="${id}" data-field="qty"   oninput="calcularTotales()" min="1">
    <input class="linea-input" type="number" placeholder="P. Unit." value="${precio||''}"     data-linea="${id}" data-field="price" oninput="calcularTotales()">
    <button onclick="eliminarLinea(${id})"
      style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:6px;padding:.3rem .5rem;cursor:pointer;font-size:.8rem;">
      <i class="fas fa-times"></i>
    </button>`;
  container.appendChild(div);
  calcularTotales();
}

function eliminarLinea(id) {
  const el = document.getElementById(`linea-${id}`);
  if (el) { el.remove(); calcularTotales(); }
}

function calcularTotales() {
  let subtotal = 0;
  document.querySelectorAll('#doc-lineas > div').forEach(div => {
    const qty   = parseFloat(div.querySelector('[data-field="qty"]')?.value)   || 0;
    const price = parseFloat(div.querySelector('[data-field="price"]')?.value) || 0;
    subtotal += qty * price;
  });
  const iva   = subtotal * 0.19;
  const total = subtotal + iva;
  setText('doc-subtotal', formatCLP(subtotal));
  setText('doc-iva',      formatCLP(iva));
  setText('doc-total',    formatCLP(total));
  actualizarPreview();
}

function getLineas() {
  const lineas = [];
  document.querySelectorAll('#doc-lineas > div').forEach(div => {
    const desc  = div.querySelector('[data-field="desc"]')?.value  || '';
    const qty   = parseFloat(div.querySelector('[data-field="qty"]')?.value)   || 0;
    const price = parseFloat(div.querySelector('[data-field="price"]')?.value) || 0;
    if (desc || price) lineas.push({ descripcion: desc, cantidad: qty, precio_unit: price, subtotal: qty * price });
  });
  return lineas;
}

function actualizarPreview() {
  const tipo      = document.getElementById('doc-tipo')?.value;
  const clienteId = parseInt(document.getElementById('doc-cliente')?.value);
  const cliente   = App.clients.find(c => c.id === clienteId);
  const fecha     = document.getElementById('doc-fecha')?.value;
  const notas     = document.getElementById('doc-notas')?.value;
  const lineas    = getLineas();
  const subtotalN = lineas.reduce((s,l)=>s+l.subtotal,0);
  const ivaN      = subtotalN * 0.19;
  const totalN    = subtotalN + ivaN;
  if (!tipo) return;
  const preview = document.getElementById('doc-live-preview');
  if (preview) preview.innerHTML = generarHTMLDoc({
    tipo, cliente, fecha, notas, lineas,
    subtotal: subtotalN, iva: ivaN, total: totalN,
    number:'VISTA PREVIA'
  });
}

function getDocColor() {
  return App.config.docColor || '#1d4ed8';
}

function generarHTMLDoc(doc) {
  const cfg        = App.config || {};
  const tipoLabels = { cotizacion:'COTIZACIÓN', orden_compra:'ORDEN DE COMPRA', factura:'FACTURA' };
  const empresa    = {
    nombre:    cfg.empresaNombre    || 'Mi Empresa',
    rut:       cfg.empresaRut       || '',
    giro:      cfg.empresaGiro      || '',
    direccion: cfg.empresaDireccion || '',
    telefono:  cfg.empresaTelefono  || '',
  };
  // Para orden de compra, mostrar proveedor en lugar de cliente
  const esOC       = doc.tipo === 'orden_compra';
  const destinatario = esOC ? (doc.proveedor || {}) : (doc.cliente || {});
  const destLabel  = esOC ? 'PROVEEDOR' : 'CLIENTE';
  const destNombre = destinatario.razon_social || destinatario.nombre || '—';
  const destRut    = destinatario.rut || '';
  const destDir    = destinatario.direccion || '';
  const destEmail  = esOC ? (destinatario.email || '') : (destinatario.email || '');

  const lineas   = doc.lineas || doc.items || [];
  const subtotal = doc.subtotal ?? lineas.reduce((s,l)=>s+(l.subtotal||0),0);
  const iva      = doc.iva     ?? subtotal*0.19;
  const total    = doc.total   ?? subtotal+iva;
  const pie      = cfg.piePagina || 'Gracias por su preferencia.';
  const fechaDoc = (doc.date||'').slice(0,10) || (doc.fecha||'').slice(0,10) || '—';
  const validez  = doc.validez || 30;
  const tipoLabel= tipoLabels[doc.tipo] || 'DOCUMENTO';

  const logoHTML = cfg.logo
    ? `<img src="${cfg.logo}" style="max-height:55px;max-width:160px;object-fit:contain;">`
    : `<div style="display:inline-block;border:3px solid #111;padding:4px 12px;font-size:18pt;font-weight:900;letter-spacing:1px;color:#111;">${empresa.nombre}</div>`;

  const empresaInfo = [
    empresa.giro      ? `Giro: ${empresa.giro}`           : '',
    empresa.direccion ? `Dirección: ${empresa.direccion}` : '',
    empresa.telefono  ? `Tel: ${empresa.telefono}`        : '',
    `Fecha: ${fechaDoc}`,
  ].filter(Boolean).join('<br>');

  const filasHTML = lineas.length
    ? lineas.map(l => `
      <tr>
        <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;font-size:9.5pt;">${l.descripcion||'—'}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:9.5pt;">${l.cantidad||1}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:9.5pt;">${formatCLP(l.precio_unit||0)}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:9.5pt;font-weight:500;">${formatCLP(l.subtotal||0)}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;font-size:9pt;">Sin items</td></tr>`;

  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
    <div>
      ${logoHTML}
      <div style="margin-top:6px;font-size:8.5pt;color:#444;line-height:1.7;">${empresaInfo}</div>
    </div>
    <div style="border:2px solid #111;padding:8px 18px;text-align:center;min-width:165px;">
      <div style="font-size:16pt;font-weight:900;letter-spacing:1px;">${tipoLabel}</div>
      <div style="font-size:10pt;font-weight:700;margin-top:2px;">${doc.number||'—'}</div>
      ${empresa.rut ? `<div style="font-size:8pt;margin-top:2px;">RUT: ${empresa.rut}</div>` : ''}
    </div>
  </div>

  <hr style="border:none;border-top:1px solid #ccc;margin-bottom:10px;">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
    <div style="flex:1;">
      ${(esOC ? doc.proveedor : doc.cliente) ? `
        <div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#555;margin-bottom:3px;letter-spacing:.5px;">${destLabel}</div>
        <div style="font-weight:700;font-size:10pt;">${destNombre}${destRut ? ` · RUT: ${destRut}` : ''}</div>
        ${destDir   ? `<div style="font-size:9pt;color:#444;margin-top:2px;">${destDir}</div>` : ''}
        ${destEmail ? `<div style="font-size:9pt;color:#444;">${destEmail}</div>`              : ''}
      ` : ''}
    </div>
    <div style="text-align:right;font-size:9pt;color:#444;line-height:1.8;">
      ${doc.condicion_venta ? `Condición de venta: ${doc.condicion_venta}<br>` : ''}
      Vigencia: ${validez} días
    </div>
  </div>

  <hr style="border:none;border-top:1px solid #ccc;margin-bottom:8px;">

  <table>
    <thead>
      <tr style="border-bottom:2px solid #111;">
        <th style="text-align:left;padding:6px 4px;font-size:9.5pt;font-weight:700;width:50%;">Descripción</th>
        <th style="text-align:center;padding:6px 4px;font-size:9.5pt;font-weight:700;width:10%;">Cant.</th>
        <th style="text-align:right;padding:6px 4px;font-size:9.5pt;font-weight:700;width:20%;">P. Unit.</th>
        <th style="text-align:right;padding:6px 4px;font-size:9.5pt;font-weight:700;width:20%;">Total</th>
      </tr>
    </thead>
    <tbody>${filasHTML}</tbody>
  </table>

  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;">
    <div style="flex:1;font-size:9pt;color:#374151;padding-right:20px;">
      ${doc.notas ? `<strong>Notas:</strong> ${doc.notas}` : ''}
    </div>
    <div style="min-width:200px;">
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:9.5pt;">
        <span style="color:#555;">Subtotal</span><span>${formatCLP(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:9.5pt;">
        <span style="color:#555;">IVA (19%)</span><span>${formatCLP(iva)}</span>
      </div>
      <hr style="border:none;border-top:2px solid #111;margin:4px 0;">
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:11pt;">
        <span>Total</span><span>${formatCLP(total)}</span>
      </div>
    </div>
  </div>

  <div style="margin-top:40px;padding-top:8px;border-top:1px solid #ccc;font-size:8pt;color:#9ca3af;text-align:center;">${pie}</div>
  `;
}

async function guardarDocumento() {
  const tipo = document.getElementById('doc-tipo')?.value;
  if (!tipo) { showMessage('Selecciona el tipo de documento','error'); return; }

  let cliente = null, proveedor = null;
  if (tipo === 'orden_compra') {
    const provId = parseInt(document.getElementById('doc-proveedor')?.value);
    if (!provId) { showMessage('Selecciona un proveedor','error'); return; }
    proveedor = App.providers.find(p => p.id === provId);
  } else {
    const clienteId = parseInt(document.getElementById('doc-cliente')?.value);
    if (!clienteId) { showMessage('Selecciona un cliente','error'); return; }
    cliente = App.clients.find(c => c.id === clienteId);
  }

  const lineas  = getLineas();
  if (!lineas.length) { showMessage('Agrega al menos un producto o servicio','error'); return; }
  const subtotal    = lineas.reduce((s,l)=>s+l.subtotal,0);
  const iva         = subtotal * 0.19;
  const total       = subtotal + iva;
  const enviarEmail = (tipo !== 'orden_compra') && (document.getElementById('doc-enviar-email')?.checked || false);
  const payload = {
    tipo,
    cliente,
    proveedor,
    fecha:   document.getElementById('doc-fecha')?.value,
    validez: parseInt(document.getElementById('doc-validez')?.value) || 30,
    notas:   document.getElementById('doc-notas')?.value || '',
    items:   lineas,
    subtotal, iva, total,
    enviar_email: enviarEmail
  };
  const btn = document.getElementById('btn-guardar-doc');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Guardando...'; }
  try {
    const res  = await fetch('/api/documents', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      let msg = `Documento ${data.document.number} creado exitosamente`;
      if (data.email_sent)  msg += ' — PDF enviado por email ✓';
      else if (enviarEmail) msg += ' — (configura SMTP en el servidor para enviar emails)';
      showMessage(msg,'success');
      limpiarFormDoc();
      navigateTo('documentos');
    } else { showMessage(data.error||'Error al guardar','error'); }
  } catch(e) { showMessage('Error de conexión: '+e.message,'error'); }
  finally {
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-save"></i> Guardar'; }
  }
}

function limpiarFormDoc() {
  ['doc-tipo','doc-cliente','doc-notas'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const lineas = document.getElementById('doc-lineas');
  if (lineas) lineas.innerHTML = '';
  const emailToggle = document.getElementById('doc-enviar-email');
  if (emailToggle) { emailToggle.checked=false; emailToggle.disabled=true; }
  const hint = document.getElementById('doc-email-hint');
  if (hint) { hint.textContent='Selecciona un cliente con email registrado'; hint.style.color='#64748b'; }
  document.querySelectorAll('.doc-type-card').forEach(c=>c.classList.remove('selected'));
  const container = document.getElementById('doc-form-container');
  if (container) container.style.display='none';
  lineaCounter=0;
  calcularTotales();
}

// ── Reportes ──────────────────────────────────────────────────────
async function loadReportes() {
  const c = document.getElementById('reportes-content');
  if (!c) return;
  c.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;gap:.75rem;color:#64748b;"><i class="fas fa-circle-notch fa-spin fa-lg"></i><span>Cargando reportes...</span></div>';
  try {
    const res   = await fetch('/api/stats');
    const stats = await res.json();
    if (stats.error) throw new Error(stats.error);
    renderReportes(stats);
  } catch(e) {
    console.error('Error reportes', e);
    c.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:.75rem;color:#f87171;">
      <i class="fas fa-exclamation-triangle fa-2x"></i>
      <p style="font-weight:600;">Error al cargar reportes</p>
      <p style="font-size:.875rem;color:#64748b;">${e.message}</p>
      <button onclick="loadReportes()" style="margin-top:.5rem;padding:.5rem 1.25rem;background:#1e3a5f;color:#93c5fd;border:1px solid #3b82f6;border-radius:8px;cursor:pointer;font-size:.875rem;">
        <i class="fas fa-redo"></i> Reintentar
      </button>
    </div>`;
  }
}

function renderReportes(stats) {
  const c = document.getElementById('reportes-content');
  if (!c) return;

  const ts = stats.doc_type_stats  || {};
  const es = stats.estado_stats    || {};
  const vm = stats.ventas_mes      || {};
  const cs = stats.client_stats    || {};

  // ── KPIs ──
  const ventasTotal  = ts.factura?.total      || 0;
  const comprasTotal = ts.orden_compra?.total  || 0;
  const cotizCount   = ts.cotizacion?.count    || 0;
  const factCount    = ts.factura?.count       || 0;
  const margen       = ventasTotal - comprasTotal;
  const conversion   = cotizCount > 0 ? ((factCount / cotizCount) * 100).toFixed(1) : 0;

  // ── Gráfico de barras ventas por mes ──
  const meses   = Object.keys(vm).sort().slice(-6);
  const maxVal  = Math.max(...meses.map(m => vm[m]), 1);
  const MONTH_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const barsHTML = meses.length ? meses.map(m => {
    const pct = Math.round((vm[m] / maxVal) * 100);
    const mes = MONTH_ES[parseInt(m.slice(5,7), 10) - 1] || m.slice(5,7);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:.35rem;flex:1;min-width:0;">
      <span style="font-size:.68rem;color:#94a3b8;white-space:nowrap;">${formatCLP(vm[m])}</span>
      <div style="width:100%;height:100px;display:flex;align-items:flex-end;">
        <div style="width:100%;background:linear-gradient(180deg,#3b82f6,#1e40af);border-radius:4px 4px 0 0;height:${Math.max(pct,4)}%;transition:height .4s ease;"></div>
      </div>
      <span style="font-size:.75rem;color:#64748b;">${mes}</span>
    </div>`;
  }).join('') : '<p style="color:#475569;font-size:.875rem;text-align:center;padding:2rem 0;">Sin ventas registradas aún</p>';

  // ── Top clientes ──
  const topClientes = Object.entries(cs)
    .sort((a,b) => b[1].total - a[1].total).slice(0,6);
  const clientHTML = topClientes.length ? topClientes.map(([name, s], i) => `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid #1e2d3d;">
      <span style="width:22px;height:22px;border-radius:50%;background:#1e3a5f;color:#60a5fa;font-size:.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</span>
      <span style="flex:1;font-size:.875rem;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>
      <span style="font-size:.875rem;font-weight:600;color:#34d399;">${formatCLP(s.total)}</span>
    </div>`).join('') : '<p style="color:#475569;font-size:.875rem;padding:.5rem 0;">Sin datos de clientes</p>';

  // ── Estados de documentos ──
  const ESTADO_COLORS = {
    borrador:'#64748b', enviada:'#3b82f6', aceptada:'#10b981', rechazada:'#ef4444',
    vencida:'#f59e0b', pendiente:'#f59e0b', pagada:'#10b981', anulada:'#ef4444',
    recibida:'#10b981', cancelada:'#ef4444'
  };
  const estadoHTML = Object.entries(es).length ? Object.entries(es)
    .sort((a,b) => b[1] - a[1])
    .map(([est, cnt]) => {
      const color = ESTADO_COLORS[est] || '#64748b';
      const label = (ESTADO_LABEL && ESTADO_LABEL[est]) || est.charAt(0).toUpperCase()+est.slice(1);
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #1e2d3d;">
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
          <span style="font-size:.85rem;color:#cbd5e1;">${label}</span>
        </div>
        <span style="font-weight:600;color:#e2e8f0;">${cnt}</span>
      </div>`;
    }).join('') : '<p style="color:#475569;font-size:.875rem;">Sin documentos</p>';

  // ── Resumen por tipo ──
  const tiposHTML = [
    { tipo:'cotizacion',  label:'Cotizaciones',     icon:'fa-file-invoice', color:'#60a5fa', bg:'rgba(59,130,246,.12)',  nota:'Propuestas'},
    { tipo:'factura',     label:'Facturas',          icon:'fa-receipt',      color:'#34d399', bg:'rgba(16,185,129,.12)', nota:'Ventas'},
    { tipo:'orden_compra',label:'Órdenes de Compra', icon:'fa-shopping-cart',color:'#a78bfa', bg:'rgba(139,92,246,.12)',  nota:'Compras'},
  ].map(({tipo, label, icon, color, bg, nota}) => {
    const s = ts[tipo] || {count:0, total:0};
    return `<div style="background:#0f1923;border-radius:12px;padding:1.1rem;border:1px solid #1e2d3d;">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem;">
        <div style="width:34px;height:34px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;">
          <i class="fas ${icon}" style="color:${color};font-size:.9rem;"></i>
        </div>
        <div>
          <p style="font-size:.82rem;font-weight:600;color:#e2e8f0;">${label}</p>
          <p style="font-size:.7rem;color:#475569;">${nota}</p>
        </div>
      </div>
      <p style="font-size:1.6rem;font-weight:700;color:${color};line-height:1;">${s.count}</p>
      <p style="font-size:.8rem;color:#64748b;margin-top:.25rem;">${formatCLP(s.total)}</p>
    </div>`;
  }).join('');

  c.innerHTML = `
    <!-- KPI cards -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem;">
      <div class="card stat-card">
        <div class="stat-icon bg-green"><i class="fas fa-dollar-sign"></i></div>
        <div class="stat-info">
          <p class="stat-label">Ventas (Facturas)</p>
          <p class="stat-value">${formatCLP(ventasTotal)}</p>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon bg-red"><i class="fas fa-cart-arrow-down"></i></div>
        <div class="stat-info">
          <p class="stat-label">Compras (OC)</p>
          <p class="stat-value">${formatCLP(comprasTotal)}</p>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon ${margen >= 0 ? 'bg-green' : 'bg-red'}"><i class="fas fa-chart-line"></i></div>
        <div class="stat-info">
          <p class="stat-label">Margen Bruto</p>
          <p class="stat-value" style="color:${margen >= 0 ? '#34d399' : '#f87171'}">${formatCLP(margen)}</p>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon bg-purple"><i class="fas fa-percentage"></i></div>
        <div class="stat-info">
          <p class="stat-label">Tasa Conversión</p>
          <p class="stat-value">${conversion}%</p>
          <p style="font-size:.72rem;color:#475569;margin-top:.1rem;">${cotizCount} cot. → ${factCount} fac.</p>
        </div>
      </div>
    </div>

    <!-- Gráfico + Top clientes -->
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:1.25rem;margin-bottom:1.25rem;">
      <div class="card">
        <h3 style="font-size:.85rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:1rem;">Ventas por Mes</h3>
        <div style="display:flex;gap:.75rem;align-items:flex-end;padding:.25rem 0;">
          ${barsHTML}
        </div>
      </div>
      <div class="card">
        <h3 style="font-size:.85rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:1rem;">Top Clientes</h3>
        ${clientHTML}
      </div>
    </div>

    <!-- Estados + Resumen tipo -->
    <div style="display:grid;grid-template-columns:1fr 1.8fr;gap:1.25rem;">
      <div class="card">
        <h3 style="font-size:.85rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:1rem;">Estados</h3>
        ${estadoHTML}
      </div>
      <div class="card">
        <h3 style="font-size:.85rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:1rem;">Resumen por Tipo</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;">
          ${tiposHTML}
        </div>
      </div>
    </div>`;
}

function renderProviders(list) {
  const tbody = document.getElementById('proveedores-table-body');
  if (!tbody) return;
  actualizarStatProveedores();
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem;color:#475569;">
      <i class="fas fa-truck" style="font-size:2rem;display:block;margin-bottom:.75rem;color:#1e3a5f;"></i>
      No hay proveedores registrados.<br>
      <button onclick="crearProveedor()" style="margin-top:1rem;padding:.5rem 1.25rem;background:#1d4ed8;color:white;border:none;border-radius:8px;cursor:pointer;font-size:.875rem;">
        <i class="fas fa-plus"></i> Agregar primer proveedor
      </button>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => {
    const nombre = p.nombre || p.razon_social || '—';
    const inicial = nombre.charAt(0).toUpperCase();
    const tieneEmail = p.email && p.email.includes('@');
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:.6rem;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:white;flex-shrink:0;">${inicial}</div>
          <div>
            <p style="font-weight:500;color:#e2e8f0;">${nombre}</p>
            ${p.rut ? `<p style="font-size:.75rem;color:#475569;">RUT: ${p.rut}</p>` : ''}
          </div>
        </div>
      </td>
      <td style="color:#94a3b8;">${p.contacto || '—'}</td>
      <td>
        ${tieneEmail
          ? `<a href="mailto:${p.email}" style="color:#60a5fa;font-size:.875rem;text-decoration:none;" title="${p.email}"><i class="fas fa-envelope" style="margin-right:.3rem;"></i>${p.email}</a>`
          : '<span style="color:#475569;">—</span>'
        }
      </td>
      <td style="color:#94a3b8;">${p.telefono ? `<i class="fas fa-phone" style="font-size:.75rem;margin-right:.3rem;color:#475569;"></i>${p.telefono}` : '—'}</td>
      <td style="text-align:center;">
        <span style="background:rgba(139,92,246,.15);color:#a78bfa;padding:.2rem .65rem;border-radius:20px;font-size:.75rem;font-weight:600;">${p.ordenes || 0}</span>
      </td>
      <td>
        <div style="display:flex;gap:.25rem;">
          <button onclick="editarProveedor(${p.id})" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:rgba(251,191,36,.1);color:#fbbf24;border:none;border-radius:6px;cursor:pointer;" title="Editar"><i class="fas fa-edit" style="font-size:.8rem;"></i></button>
          <button onclick="eliminarProveedor(${p.id})" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:rgba(239,68,68,.1);color:#f87171;border:none;border-radius:6px;cursor:pointer;" title="Eliminar"><i class="fas fa-trash" style="font-size:.8rem;"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function actualizarStatProveedores() {
  const list = App.providers || [];
  const total = list.length;
  const conEmail = list.filter(p => p.email && p.email.includes('@')).length;
  const totalOrdenes = list.reduce((s, p) => s + (p.ordenes || 0), 0);
  const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setStat('prov-stat-total',   total);
  setStat('prov-stat-email',   conEmail);
  setStat('prov-stat-ordenes', totalOrdenes);
}



async function loadProveedoresPage() {
  const tbody = document.getElementById('proveedores-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#64748b;"><i class="fas fa-circle-notch fa-spin"></i> Cargando proveedores...</td></tr>`;
  try {
    const res  = await fetch('/api/providers');
    const data = await res.json();
    App.providers = Array.isArray(data) ? data : [];
  } catch(e) {
    console.error('Error cargando proveedores:', e);
    App.providers = [];
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#f87171;"><i class="fas fa-exclamation-triangle"></i> Error al cargar proveedores</td></tr>`;
    return;
  }
  renderProviders(App.providers);
  actualizarStatProveedores();
}

function filtrarProveedores(query) {
  const q = query.toLowerCase().trim();
  if (!q) { renderProviders(App.providers); return; }
  const filtered = App.providers.filter(p =>
    (p.nombre||p.razon_social||'').toLowerCase().includes(q) ||
    (p.email||'').toLowerCase().includes(q) ||
    (p.rut||'').toLowerCase().includes(q) ||
    (p.contacto||'').toLowerCase().includes(q)
  );
  renderProviders(filtered);
}

// ── Exponer funciones al scope global (necesario para onclick inline) ──
window.testearEmail            = testearEmail;
window.crearCliente            = crearCliente;
window.crearProveedor          = crearProveedor;
window.editarProveedor         = editarProveedor;
window.eliminarProveedor       = eliminarProveedor;
window.guardarProveedor        = guardarProveedor;
window.popularSelectProveedores= popularSelectProveedores;
window.onProveedorChange       = onProveedorChange;
window.cambiarEstadoDoc        = cambiarEstadoDoc;
window.confirmarCambiarEstado  = confirmarCambiarEstado;
window.convertirAFactura       = convertirAFactura;
window.editarCliente           = editarCliente;
window.eliminarCliente         = eliminarCliente;
window.exportarClientes        = exportarClientes;
window.importarClientes        = importarClientes;
window.handleClientesCSV       = handleClientesCSV;
window.confirmarImportarClientes = confirmarImportarClientes;

window.crearProducto           = crearProducto;
window.editarProducto          = editarProducto;
window.eliminarProducto        = eliminarProducto;
window.importarProductos       = importarProductos;
window.handleProductosCSV      = handleProductosCSV;
window.confirmarImportarProductos = confirmarImportarProductos;

window.guardarDocumento        = guardarDocumento;
window.limpiarFormDoc          = limpiarFormDoc;
window.verDocumento            = verDocumento;
window.editarDocumento         = editarDocumento;
window.confirmarEditarDoc      = confirmarEditarDoc;
window.eliminarDocumento       = eliminarDocumento;
window.descargarPDF            = descargarPDF;
window.descargarPDFActual      = descargarPDFActual;
window.filtrarDocumentos       = filtrarDocumentos;

window.seleccionarTipoDoc      = seleccionarTipoDoc;
window.onClienteChange         = onClienteChange;
window.agregarLineaDoc         = agregarLineaDoc;
window.eliminarLinea           = eliminarLinea;
window.calcularTotales         = calcularTotales;
window.abrirSelectorProducto   = abrirSelectorProducto;
window.filtrarSelectorProductos = filtrarSelectorProductos;
window.agregarProductoDelSistema = agregarProductoDelSistema;

window.showModal               = showModal;
window.hideModal               = hideModal;
window.toggleDropdown          = toggleDropdown;
window.abrirPerfil             = abrirPerfil;
window.abrirConfiguracion      = abrirConfiguracion;
window.guardarConfiguracion    = guardarConfiguracion;
window.mostrarCfgPanel         = mostrarCfgPanel;
window.handleLogoUpload        = handleLogoUpload;
window.cambiarColor            = cambiarColor;
window.cambiarColorDocCustom   = cambiarColorDocCustom;
window.doLogout                = doLogout;
window.loadReportes            = loadReportes;
window.filtrarProveedores      = filtrarProveedores;

} // ── fin bloque if pathname !== /login ──────────────────────────
