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
  if (c) c.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem;">Cargando reportes...</p>';
  try {
    const res   = await fetch('/api/stats');
    const stats = await res.json();
    if (stats.error) { if(c) c.innerHTML = `<p style="color:#f87171;text-align:center;padding:2rem;">Error: ${stats.error}</p>`; return; }
    renderReportes(stats);
  } catch(e) {
    console.error('Error reportes', e);
    if(c) c.innerHTML = '<p style="color:#f87171;text-align:center;padding:2rem;">Error al cargar reportes. Intenta nuevamente.</p>';
  }
}

function renderReportes(stats) {
  const c = document.getElementById('reportes-content');
  if (!c) return;
  const ts = stats.doc_type_stats || {};

  // Lógica de ventas: solo Facturas son ventas confirmadas
  // Cotizaciones son propuestas, OC son compras (costos)
  const ventasTotal    = ts.factura?.total   || 0;
  const ventasCount    = ts.factura?.count   || 0;
  const cotizTotal     = ts.cotizacion?.total || 0;
  const cotizCount     = ts.cotizacion?.count || 0;
  const comprasTotal   = ts.orden_compra?.total || 0;
  const comprasCount   = ts.orden_compra?.count || 0;
  const margenBruto    = ventasTotal - comprasTotal;
  const tasaConversion = cotizCount > 0 ? ((ventasCount / cotizCount) * 100).toFixed(1) : 0;

  // Estado de documentos
  const es = stats.estado_stats || {};
  const estadoRows = Object.entries(es).map(([est, cnt]) => {
    const color = {borrador:'#64748b',enviada:'#3b82f6',aceptada:'#10b981',rechazada:'#ef4444',
      vencida:'#f59e0b',pendiente:'#f59e0b',pagada:'#10b981',anulada:'#ef4444',
      recibida:'#10b981',cancelada:'#ef4444'}[est] || '#64748b';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid #1e2d3d;">
      <span style="display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
        ${ESTADO_LABEL[est]||est}
      </span>
      <strong style="color:#e2e8f0;">${cnt}</strong>
    </div>`;
  }).join('') || '<p style="color:#64748b;font-size:.875rem;">Sin datos</p>';

  // Top clientes por ventas (facturas)
  const clientRows = Object.entries(stats.client_stats||{})
    .sort((a,b)=>b[1].total-a[1].total).slice(0,8)
    .map(([name,s])=>`<tr><td>${name}</td><td style="text-align:center;">${s.count}</td><td style="text-align:right;">${formatCLP(s.total)}</td></tr>`)
    .join('') || `<tr><td colspan="3" style="text-align:center;color:#64748b;padding:1rem;">Sin datos aún</td></tr>`;

  // Ventas por mes
  const vm = stats.ventas_mes || {};
  const meses = Object.keys(vm).sort().slice(-6);
  const maxVenta = Math.max(...Object.values(vm), 1);
  const barras = meses.map(m => {
    const pct = Math.round((vm[m] / maxVenta) * 100);
    const label = m.slice(0,7); // YYYY-MM
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:.4rem;flex:1;">
      <span style="font-size:.7rem;color:#64748b;">${formatCLP(vm[m])}</span>
      <div style="width:100%;background:#1e2d3d;border-radius:4px 4px 0 0;height:120px;display:flex;align-items:flex-end;">
        <div style="width:100%;background:linear-gradient(180deg,#3b82f6,#1d4ed8);border-radius:4px 4px 0 0;height:${pct}%;transition:height .3s;"></div>
      </div>
      <span style="font-size:.7rem;color:#64748b;">${label.slice(5)}</span>
    </div>`;
  }).join('');

  c.innerHTML = `
    <!-- KPIs principales -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem;">
      <div class="card stat-card"><div class="stat-icon bg-green"><i class="fas fa-dollar-sign"></i></div><div class="stat-info"><p class="stat-label">Ventas (Facturas)</p><p class="stat-value">${formatCLP(ventasTotal)}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-red"><i class="fas fa-shopping-cart"></i></div><div class="stat-info"><p class="stat-label">Compras (OC)</p><p class="stat-value">${formatCLP(comprasTotal)}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-blue"><i class="fas fa-chart-line"></i></div><div class="stat-info"><p class="stat-label">Margen Bruto</p><p class="stat-value" style="color:${margenBruto>=0?'#34d399':'#f87171'}">${formatCLP(margenBruto)}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-purple"><i class="fas fa-percentage"></i></div><div class="stat-info"><p class="stat-label">Tasa Conversión</p><p class="stat-value">${tasaConversion}%</p></div></div>
    </div>

    <!-- Gráfico ventas por mes -->
    ${meses.length ? `
    <div class="card" style="margin-bottom:1.5rem;">
      <h3 style="font-weight:600;margin-bottom:1.25rem;font-size:.95rem;">Ventas por Mes (últimos 6 meses)</h3>
      <div style="display:flex;gap:.75rem;align-items:flex-end;padding:.5rem 0;">${barras}</div>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1.2fr .8fr;gap:1.5rem;margin-bottom:1.5rem;">
      <!-- Top clientes -->
      <div class="card">
        <h3 style="font-weight:600;margin-bottom:1rem;font-size:.95rem;">Top Clientes</h3>
        <div class="table-container"><table>
          <thead><tr><th>Cliente</th><th style="text-align:center;">Docs</th><th style="text-align:right;">Total</th></tr></thead>
          <tbody>${clientRows}</tbody>
        </table></div>
      </div>
      <!-- Estados -->
      <div class="card">
        <h3 style="font-weight:600;margin-bottom:1rem;font-size:.95rem;">Estados de Documentos</h3>
        ${estadoRows}
      </div>
    </div>

    <!-- Resumen por tipo -->
    <div class="card">
      <h3 style="font-weight:600;margin-bottom:1rem;font-size:.95rem;">Resumen por Tipo de Documento</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;">
        ${[
          {tipo:'cotizacion', label:'Cotizaciones', icon:'fa-file-invoice', color:'#60a5fa', nota:'Propuestas enviadas'},
          {tipo:'factura',    label:'Facturas',     icon:'fa-receipt',      color:'#34d399', nota:'Ventas confirmadas'},
          {tipo:'orden_compra',label:'Órdenes Compra',icon:'fa-shopping-cart',color:'#a78bfa',nota:'Compras a proveedores'},
        ].map(({tipo,label,icon,color,nota}) => {
          const s = ts[tipo]||{count:0,total:0};
          return `<div style="background:#0f1923;border-radius:10px;padding:1rem;border:1px solid #1e2d3d;">
            <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem;">
              <i class="fas ${icon}" style="color:${color};font-size:1rem;"></i>
              <span style="font-weight:600;font-size:.9rem;color:#e2e8f0;">${label}</span>
            </div>
            <p style="font-size:1.4rem;font-weight:700;color:${color};margin-bottom:.2rem;">${s.count}</p>
            <p style="font-size:.82rem;color:#64748b;">${formatCLP(s.total)}</p>
            <p style="font-size:.72rem;color:#475569;margin-top:.25rem;">${nota}</p>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── Formularios ───────────────────────────────────────────────────
function setupForms() {
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
      const res  = await fetch(id?`/api/clients/${id}`:'/api/clients', {
        method:id?'PUT':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) { hideModal('cliente-modal'); showMessage(id?'Cliente actualizado':'Cliente creado','success'); loadClients(); }
      else showMessage(data.error||'Error al guardar','error');
    } catch { showMessage('Error de conexión','error'); }
  });

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
      const res  = await fetch(id?`/api/products/${id}`:'/api/products', {
        method:id?'PUT':'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) { hideModal('producto-modal'); showMessage(id?'Producto actualizado':'Producto creado','success'); loadProducts(); }
      else showMessage(data.error||'Error al guardar','error');
    } catch { showMessage('Error de conexión','error'); }
  });

  const perfilForm = document.getElementById('perfil-form');
  if (perfilForm) perfilForm.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      name:  document.getElementById('perfil-nombre').value.trim(),
      email: document.getElementById('perfil-email').value.trim(),
    };
    const pwdNueva = document.getElementById('perfil-pwd-nueva').value;
    if (pwdNueva) {
      payload.password_actual = document.getElementById('perfil-pwd-actual').value;
      payload.password_nueva  = pwdNueva;
    }
    try {
      const res  = await fetch('/api/user/update', {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) { hideModal('perfil-modal'); showMessage('Perfil actualizado','success'); await loadUser(); }
      else showMessage(data.error||'Error al actualizar','error');
    } catch { showMessage('Error de conexión','error'); }
  });
}

// ── Búsqueda ──────────────────────────────────────────────────────
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

// ── Perfil ────────────────────────────────────────────────────────
function abrirPerfil() {
  if (App.user) {
    document.getElementById('perfil-nombre').value = App.user.name  || '';
    document.getElementById('perfil-email').value  = App.user.email || '';
    document.getElementById('perfil-pwd-actual').value = '';
    document.getElementById('perfil-pwd-nueva').value  = '';
    const av = document.getElementById('perfil-avatar');
    if (av) av.textContent = (App.user.name||'U').charAt(0).toUpperCase();
  }
  showModal('perfil-modal');
}

// ── Configuración ─────────────────────────────────────────────────
function abrirConfiguracion() {
  const cfg = App.config;
  const set = (id, val) => { const el=document.getElementById(id); if (el&&val!==undefined) el.value=val; };
  set('cfg-empresa-nombre',    cfg.empresaNombre);
  set('cfg-empresa-rut',       cfg.empresaRut);
  set('cfg-empresa-telefono',  cfg.empresaTelefono);
  set('cfg-empresa-direccion', cfg.empresaDireccion);
  set('cfg-empresa-email',     cfg.empresaEmail);
  set('cfg-prefijo-cot',       cfg.prefijosCot);
  set('cfg-prefijo-oc',        cfg.prefijosOC);
  set('cfg-prefijo-fac',       cfg.prefijosFac);
  set('cfg-pie-pagina',        cfg.piePagina);
  set('cfg-app-nombre',        cfg.appNombre);
  // Verificar estado SMTP
  const badge = document.getElementById('smtp-status-badge');
  if (badge) {
    badge.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verificando SMTP...';
    badge.style.background = '#1e2d3d'; badge.style.color = '#64748b';
    fetch('/api/smtp-status').then(r=>r.json()).then(d => {
      if (d.configured) {
        badge.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> SMTP configurado — <strong>${d.user}</strong> via ${d.host}:${d.port} (clave: ${d.pass_length} chars)`;
        badge.style.background = 'rgba(16,185,129,.1)'; badge.style.color = '#34d399';
      } else {
        badge.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i> SMTP no configurado — agrega SMTP_HOST, SMTP_USER y SMTP_PASS en Render → Environment';
        badge.style.background = 'rgba(245,158,11,.1)'; badge.style.color = '#fbbf24';
      }
    }).catch(()=>{ badge.innerHTML = '<i class="fas fa-times-circle" style="color:#ef4444;"></i> Error al verificar SMTP'; });
  }
  // Color doc
  const docColor = cfg.docColor || '#3b82f6';
  const hexEl = document.getElementById('cfg-doc-color-hex');
  const inpEl = document.getElementById('cfg-doc-color-custom');
  if (hexEl) hexEl.textContent = docColor;
  if (inpEl) inpEl.value = docColor;
  showModal('config-modal');
}

function mostrarCfgPanel(panel) {
  document.querySelectorAll('.cfg-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.cfg-tab').forEach(t=>t.classList.remove('active'));
  const p = document.getElementById(`cfgpanel-${panel}`);
  const t = document.getElementById(`cfgtab-${panel}`);
  if (p) p.classList.add('active');
  if (t) t.classList.add('active');
}

function guardarConfiguracion() {
  const g = id => document.getElementById(id);
  App.config = {
    ...App.config,
    empresaNombre:    g('cfg-empresa-nombre')?.value,
    empresaRut:       g('cfg-empresa-rut')?.value,
    empresaTelefono:  g('cfg-empresa-telefono')?.value,
    empresaDireccion: g('cfg-empresa-direccion')?.value,
    empresaEmail:     g('cfg-empresa-email')?.value,
    prefijosCot:      g('cfg-prefijo-cot')?.value,
    prefijosOC:       g('cfg-prefijo-oc')?.value,
    prefijosFac:      g('cfg-prefijo-fac')?.value,
    piePagina:        g('cfg-pie-pagina')?.value,
    appNombre:        g('cfg-app-nombre')?.value,
    incluirIva:       g('cfg-incluir-iva')?.checked,
    mostrarLogo:      g('cfg-mostrar-logo')?.checked,
    mostrarEmpresa:   g('cfg-mostrar-empresa')?.checked,
  };
  try { localStorage.setItem('cotifacil_config', JSON.stringify(App.config)); } catch(e) {}
  // Guardar config en servidor (persiste entre dispositivos)
  fetch('/api/user/config', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(App.config)
  }).catch(e => console.warn('Config server save failed:', e));
  aplicarConfig();
  hideModal('config-modal');
  showMessage('Configuración guardada','success');
}

function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2*1024*1024) { showMessage('Logo muy grande, máximo 2MB','error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    App.config.logo = e.target.result;
    const c = document.getElementById('logo-preview-container');
    if (c) c.innerHTML = `<img src="${e.target.result}" style="max-height:60px;max-width:160px;object-fit:contain;">`;
    showMessage('Logo cargado','success');
  };
  reader.readAsDataURL(file);
}

// tipo: 'sistema' | 'doc'
function cambiarColor(color, btn, tipo) {
  const groupId = tipo === 'doc' ? 'swatches-doc' : 'swatches-sistema';
  document.querySelectorAll(`#${groupId} .color-swatch`).forEach(b=>b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  if (tipo === 'doc') {
    App.config.docColor = color;
    const hex = document.getElementById('cfg-doc-color-hex');
    const inp = document.getElementById('cfg-doc-color-custom');
    if (hex) hex.textContent = color;
    if (inp) inp.value = color;
  } else {
    App.config.color = color;
    document.documentElement.style.setProperty('--primary-color', color);
  }
}

function cambiarColorDocCustom(color) {
  App.config.docColor = color;
  document.querySelectorAll('#swatches-doc .color-swatch').forEach(b=>b.classList.remove('selected'));
  const hex = document.getElementById('cfg-doc-color-hex');
  if (hex) hex.textContent = color;
}

// ── Dropdown ──────────────────────────────────────────────────────
function toggleDropdown(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  closeDropdowns();
  if (!isOpen) menu.classList.add('open');
}

function closeDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(m=>m.classList.remove('open'));
}

function setupDropdownClose() {
  document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) closeDropdowns(); });
}

// ── Modales ───────────────────────────────────────────────────────
function showModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  // Move to body if not already there (ensures correct stacking)
  if (m.parentElement !== document.body) {
    document.body.appendChild(m);
  }
  m.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function hideModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.style.display = 'none';
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', e => {
  if (e.key==='Escape') document.querySelectorAll('.modal').forEach(m=>m.style.display='none');
});

// ── Notificaciones ────────────────────────────────────────────────
function showMessage(text, type='success') {
  const prev = document.getElementById('global-message');
  if (prev) prev.remove();
  const div = document.createElement('div');
  div.id = 'global-message';
  div.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
    padding:.875rem 1.25rem;border-radius:10px;font-size:.9rem;font-weight:500;
    display:flex;align-items:center;gap:.6rem;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:420px;
    ${type==='success'
      ?'background:#052e16;border:1px solid #166534;color:#86efac;'
      :'background:#2d0808;border:1px solid #7f1d1d;color:#fca5a5;'}`;
  div.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':'fa-exclamation-circle'}" style="flex-shrink:0;"></i><span>${text}</span>`;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(), 4500);
}

// ── Helpers ───────────────────────────────────────────────────────
function setText(selector, value) {
  const el = (selector.startsWith('[')||selector.startsWith('.'))
    ? document.querySelector(selector)
    : document.getElementById(selector);
  if (el) el.textContent = value;
}

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',minimumFractionDigits:0}).format(amount||0);
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase()+str.slice(1) : ''; }

function tipoLabel(tipo) {
  return {cotizacion:'Cotización', orden_compra:'Orden Compra', factura:'Factura'}[tipo] || tipo || '—';
}

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showLoading(tbodyId, cols=6) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty-table-message"><i class="fas fa-spinner fa-spin" style="margin-right:.5rem;"></i>Cargando...</td></tr>`;
}

function showError(tbodyId, msg, cols=6) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty-table-message" style="color:#f87171;"><i class="fas fa-exclamation-circle" style="margin-right:.5rem;"></i>${msg}</td></tr>`;
}

// ── Test Email ───────────────────────────────────────────────────
async function testearEmail() {
  const btn = document.getElementById('btn-test-email');
  const res_el = document.getElementById('email-test-result');
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  btn.disabled = true;
  if (res_el) res_el.style.display = 'none';
  try {
    const res  = await fetch('/api/email/test', { method: 'POST' });
    const data = await res.json();
    if (res_el) {
      res_el.style.display = 'block';
      if (data.success) {
        res_el.style.background = 'rgba(16,185,129,.12)';
        res_el.style.color      = '#6ee7b7';
        res_el.style.border     = '1px solid rgba(16,185,129,.25)';
        res_el.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
      } else {
        res_el.style.background = 'rgba(239,68,68,.12)';
        res_el.style.color      = '#fca5a5';
        res_el.style.border     = '1px solid rgba(239,68,68,.25)';
        res_el.innerHTML = `<i class="fas fa-times-circle"></i> ${data.message}`;
      }
    }
  } catch (e) {
    if (res_el) {
      res_el.style.display = 'block';
      res_el.style.background = 'rgba(239,68,68,.12)';
      res_el.style.color = '#fca5a5';
      res_el.innerHTML = '<i class="fas fa-times-circle"></i> Error de conexión';
    }
  } finally {
    btn.innerHTML = orig;
    btn.disabled  = false;
  }
}

// ── Proveedores ──────────────────────────────────────────────────
async function loadProviders() {
  try {
    const res = await fetch('/api/providers');
    App.providers = await res.json();
  } catch(e) { console.error('Error cargando proveedores', e); }
}

function crearProveedor() {
  ['prov-nombre','prov-rut','prov-contacto','prov-email','prov-telefono','prov-direccion','prov-nota'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('prov-id').value = '';
  const t = document.getElementById('prov-modal-title');
  if (t) t.textContent = 'Nuevo Proveedor';
  showModal('proveedor-modal');
}

async function editarProveedor(id) {
  const p = App.providers.find(x => x.id === id);
  if (!p) return;
  const set = (elId, val) => { const el=document.getElementById(elId); if(el) el.value=val||''; };
  set('prov-id', id);
  set('prov-nombre',    p.nombre||p.razon_social||'');
  set('prov-rut',       p.rut);
  set('prov-contacto',  p.contacto);
  set('prov-email',     p.email);
  set('prov-telefono',  p.telefono);
  set('prov-direccion', p.direccion);
  set('prov-nota',      p.nota);
  const t = document.getElementById('prov-modal-title');
  if (t) t.textContent = 'Editar Proveedor';
  showModal('proveedor-modal');
}

async function guardarProveedor() {
  const idVal = document.getElementById('prov-id')?.value;
  const nombre = document.getElementById('prov-nombre')?.value.trim();
  if (!nombre) { showMessage('El nombre del proveedor es obligatorio','error'); return; }
  const payload = {
    nombre:    nombre,
    rut:       document.getElementById('prov-rut')?.value.trim(),
    contacto:  document.getElementById('prov-contacto')?.value.trim(),
    email:     document.getElementById('prov-email')?.value.trim(),
    telefono:  document.getElementById('prov-telefono')?.value.trim(),
    direccion: document.getElementById('prov-direccion')?.value.trim(),
    nota:      document.getElementById('prov-nota')?.value.trim(),
  };
  try {
    const method = idVal ? 'PUT' : 'POST';
    const url    = idVal ? `/api/providers/${idVal}` : '/api/providers';
    const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data   = await res.json();
    if (data.success) {
      hideModal('proveedor-modal');
      showMessage(idVal ? 'Proveedor actualizado':'Proveedor creado','success');
      const res2 = await fetch('/api/providers');
      App.providers = await res2.json();
      if (document.getElementById('proveedores-page')?.classList.contains('active') ||
          document.getElementById('proveedores-table-body')) {
        renderProviders(App.providers);
      }
    } else { showMessage(data.error||'Error al guardar','error'); }
  } catch { showMessage('Error de conexión','error'); }
}

async function eliminarProveedor(id) {
  if (!confirm('¿Eliminar este proveedor?')) return;
  try {
    const res  = await fetch(`/api/providers/${id}`, { method:'DELETE' });
    const data = await res.json();
    if (data.success) {
      App.providers = App.providers.filter(p => p.id !== id);
      showMessage('Proveedor eliminado','success');
      renderProviders(App.providers);
    } else { showMessage(data.error||'Error','error'); }
  } catch { showMessage('Error de conexión','error'); }
}

function renderProviders(list) {
  const tbody = document.getElementById('proveedores-table-body');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table-message">No hay proveedores registrados</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td style="font-weight:500;">${p.nombre||p.razon_social||'—'}</td>
      <td>${p.rut||'—'}</td>
      <td>${p.email||'—'}</td>
      <td>${p.telefono||'—'}</td>
      <td>${p.ordenes||0}</td>
      <td>
        <div class="flex gap-2">
          <button onclick="editarProveedor(${p.id})"   style="color:#fbbf24;background:none;border:none;cursor:pointer;padding:.3rem;" title="Editar"><i class="fas fa-edit"></i></button>
          <button onclick="eliminarProveedor(${p.id})" style="color:#f87171;background:none;border:none;cursor:pointer;padding:.3rem;" title="Eliminar"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

async function loadProveedoresPage() {
  if (App.providers.length === 0) {
    try {
      const res = await fetch('/api/providers');
      App.providers = await res.json();
    } catch(e) {}
  }
  renderProviders(App.providers);
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

} // ── fin bloque if pathname !== /login ──────────────────────────
