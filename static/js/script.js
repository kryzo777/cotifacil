/* ================================================================
   CotiFácil — script.js  (versión completa con todas las mejoras)
   ================================================================ */

if (window.location.pathname !== '/login') {

// ── Estado global ─────────────────────────────────────────────────
const App = {
  currentPage: 'dashboard',
  clients:     [],
  products:    [],
  documents:   [],
  user:        null,
  config:      {},
  csvClientes: [],
  csvProductos:[],
  docViendoId: null,
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
  const titles = { dashboard:'Dashboard', clientes:'Clientes', productos:'Productos', documentos:'Documentos', 'crear-documento':'Crear Documento', reportes:'Reportes' };
  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;
  App.currentPage = page;
  switch (page) {
    case 'dashboard':       loadDashboard();   break;
    case 'clientes':        loadClients();     break;
    case 'productos':       loadProducts();    break;
    case 'documentos':      loadDocuments();   break;
    case 'crear-documento': initCrearDoc();    break;
    case 'reportes':        loadReportes();    break;
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
  tbody.innerHTML = list.map(d => `
    <tr>
      <td style="font-weight:500;">${d.number||'—'}</td>
      <td><span class="badge badge-${d.tipo||'cotizacion'}">${tipoLabel(d.tipo)}</span></td>
      <td>${d.date ? d.date.split(' ')[0] : '—'}</td>
      <td>${d.cliente?.razon_social||'—'}</td>
      <td>${formatCLP(d.total||0)}</td>
      <td><span class="badge badge-${d.estado||'pendiente'}">${capitalize(d.estado||'pendiente')}</span></td>
      <td>
        <div class="flex gap-2">
          <button onclick="verDocumento(${d.id})"      style="color:#60a5fa;background:none;border:none;cursor:pointer;padding:.3rem;" title="Ver"><i class="fas fa-eye"></i></button>
          <button onclick="editarDocumento(${d.id})"   style="color:#fbbf24;background:none;border:none;cursor:pointer;padding:.3rem;" title="Editar"><i class="fas fa-edit"></i></button>
          <button onclick="descargarPDF(${d.id})"      style="color:#34d399;background:none;border:none;cursor:pointer;padding:.3rem;" title="PDF"><i class="fas fa-file-pdf"></i></button>
          <button onclick="eliminarDocumento(${d.id})" style="color:#f87171;background:none;border:none;cursor:pointer;padding:.3rem;" title="Eliminar"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
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
  if (App.clients.length === 0) {
    fetch('/api/clients').then(r=>r.json()).then(cs=>{ App.clients=cs; popularSelectClientes(); });
  } else { popularSelectClientes(); }
  if (App.products.length === 0) fetch('/api/products').then(r=>r.json()).then(ps=>{ App.products=ps; });
  const fechaEl = document.getElementById('doc-fecha');
  if (fechaEl && !fechaEl.value) fechaEl.value = new Date().toISOString().split('T')[0];
  if (!document.getElementById('doc-lineas').children.length) agregarLineaDoc();
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
      ${doc.cliente ? `
        <div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#555;margin-bottom:3px;letter-spacing:.5px;">CLIENTE</div>
        <div style="font-weight:700;font-size:10pt;">${doc.cliente.razon_social||'—'}${doc.cliente.rut ? ` · RUT: ${doc.cliente.rut}` : ''}</div>
        ${doc.cliente.direccion ? `<div style="font-size:9pt;color:#444;margin-top:2px;">${doc.cliente.direccion}</div>` : ''}
        ${doc.cliente.email     ? `<div style="font-size:9pt;color:#444;">${doc.cliente.email}</div>` : ''}
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
  const clienteId = parseInt(document.getElementById('doc-cliente')?.value);
  if (!clienteId) { showMessage('Selecciona un cliente','error'); return; }
  const cliente = App.clients.find(c => c.id === clienteId);
  const lineas  = getLineas();
  if (!lineas.length) { showMessage('Agrega al menos un producto o servicio','error'); return; }
  const subtotal    = lineas.reduce((s,l)=>s+l.subtotal,0);
  const iva         = subtotal * 0.19;
  const total       = subtotal + iva;
  const enviarEmail = document.getElementById('doc-enviar-email')?.checked || false;
  const payload = {
    tipo,
    cliente,
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
  try {
    const res   = await fetch('/api/stats');
    const stats = await res.json();
    renderReportes(stats);
  } catch(e) { console.error('Error reportes',e); }
}

function renderReportes(stats) {
  const c = document.getElementById('reportes-content');
  if (!c) return;
  const clientRows = Object.entries(stats.client_stats||{})
    .sort((a,b)=>b[1].total-a[1].total).slice(0,10)
    .map(([name,s])=>`<tr><td>${name}</td><td>${s.count}</td><td>${formatCLP(s.total)}</td></tr>`)
    .join('') || `<tr><td colspan="3" class="empty-table-message">Sin datos</td></tr>`;
  const ts = stats.doc_type_stats || {};
  c.innerHTML = `
    <div class="stats-grid">
      <div class="card stat-card"><div class="stat-icon bg-blue"><i class="fas fa-file-alt"></i></div><div class="stat-info"><p class="stat-label">Total Documentos</p><p class="stat-value">${stats.total_documents??0}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-green"><i class="fas fa-dollar-sign"></i></div><div class="stat-info"><p class="stat-label">Ventas Totales</p><p class="stat-value">${formatCLP(stats.total_sales??0)}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-blue"><i class="fas fa-file-invoice"></i></div><div class="stat-info"><p class="stat-label">Cotizaciones</p><p class="stat-value">${ts.cotizacion?.count||0}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-purple"><i class="fas fa-receipt"></i></div><div class="stat-info"><p class="stat-label">Facturas</p><p class="stat-value">${ts.factura?.count||0}</p></div></div>
    </div>
    <div class="dash-grid">
      <div class="card">
        <h3 style="font-weight:600;margin-bottom:1rem;">Top Clientes por Ventas</h3>
        <div class="table-container"><table>
          <thead><tr><th>Cliente</th><th>Documentos</th><th>Total</th></tr></thead>
          <tbody>${clientRows}</tbody>
        </table></div>
      </div>
      <div class="card">
        <h3 style="font-weight:600;margin-bottom:1rem;">Resumen por Tipo</h3>
        ${['cotizacion','orden_compra','factura'].map(t=>{
          const s=ts[t]||{count:0,total:0};
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 0;border-bottom:1px solid #1e2d3d;">
            <span class="badge badge-${t}">${tipoLabel(t)}</span>
            <div><strong>${s.count}</strong> docs · ${formatCLP(s.total)}</div>
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
  if (m) m.style.display = 'block';
}

function hideModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'none';
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

// ── Exponer funciones al scope global (necesario para onclick inline) ──
window.crearCliente            = crearCliente;
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
