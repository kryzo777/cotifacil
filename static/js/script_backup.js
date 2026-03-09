/* =====================================================
   CotiFácil — script.js  (versión completa)
   ===================================================== */

// Salir limpiamente si estamos en login
if (window.location.pathname === '/login') {
  // no ejecutar nada más
} else {

// ── Estado global ──────────────────────────────────────
const App = {
  currentPage: 'dashboard',
  clients: [],
  products: [],
  documents: [],
  user: null,
  config: {},
  csvClientes: [],
  csvProductos: [],
};

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  cargarConfig();
  await loadUser();
  setupNavigation();
  setupLogout();
  setupForms();
  setupSearch();
  setupDropdownClose();
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);
});

// ── Configuración (localStorage) ─────────────────────
function cargarConfig() {
  try {
    const saved = localStorage.getItem('cotifacil_config');
    if (saved) {
      App.config = JSON.parse(saved);
      aplicarConfig();
    }
  } catch(e) {}
}

function aplicarConfig() {
  const cfg = App.config;
  if (cfg.color) {
    document.documentElement.style.setProperty('--primary-color', cfg.color);
    document.querySelectorAll('.btn-primary, .nav-link.active, .sidebar-logo').forEach(el => {
      if (el.classList.contains('btn-primary')) el.style.background = cfg.color;
    });
  }
  if (cfg.appNombre) {
    const t = document.getElementById('app-title');
    if (t) t.textContent = cfg.appNombre;
  }
}

// ── Usuario ───────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/user');
    if (res.ok) {
      App.user = await res.json();
      const info = document.getElementById('user-info');
      if (info) {
        info.querySelector('.user-name').textContent = App.user.name || 'Usuario';
        info.querySelector('.user-email').textContent = App.user.email || '';
      }
      const initials = (App.user.name || 'U').charAt(0).toUpperCase();
      const headerAv = document.getElementById('header-avatar-initials');
      const perfilAv = document.getElementById('perfil-avatar');
      if (headerAv) headerAv.textContent = initials;
      if (perfilAv) perfilAv.textContent = initials;
      const headerUser = document.getElementById('header-username');
      if (headerUser) headerUser.textContent = (App.user.name || 'Usuario').split(' ')[0];
    } else {
      window.location.href = '/login';
    }
  } catch {
    window.location.href = '/login';
  }
}

// ── Logout ────────────────────────────────────────────
function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) btn.addEventListener('click', doLogout);
}

async function doLogout() {
  await fetch('/logout');
  window.location.href = '/login';
}

// ── Navegación ────────────────────────────────────────
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
    const page = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(page);
  });
}

function navigateTo(page) {
  document.querySelectorAll('.page-content').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const target = document.getElementById(`${page}-page`);
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');
  const titles = { dashboard:'Dashboard', clientes:'Clientes', productos:'Productos', documentos:'Documentos', 'crear-documento':'Crear Documento', reportes:'Reportes' };
  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;
  App.currentPage = page;
  switch (page) {
    case 'dashboard':        loadDashboard(); break;
    case 'clientes':         loadClients(); break;
    case 'productos':        loadProducts(); break;
    case 'documentos':       loadDocuments(); break;
    case 'crear-documento':  initCrearDoc(); break;
    case 'reportes':         loadReportes(); break;
  }
}

// ── Dashboard ─────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await fetch('/api/stats');
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
  if (!docs.length) { c.innerHTML = '<p class="text-gray-400 text-sm">No hay documentos aún.</p>'; return; }
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
    { key:'cotizacion', label:'Cotizaciones', color:'#60a5fa' },
    { key:'orden_compra', label:'Órdenes de Compra', color:'#a78bfa' },
    { key:'factura', label:'Facturas', color:'#34d399' },
  ];
  if (!Object.keys(stats).length) { c.innerHTML = '<p class="text-gray-400 text-sm">No hay documentos aún.</p>'; return; }
  c.innerHTML = tipos.map(t => {
    const s = stats[t.key] || { count: 0, total: 0 };
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

// ── Clientes ──────────────────────────────────────────
async function loadClients() {
  showLoading('clients-table-body', 8);
  try {
    const res = await fetch('/api/clients');
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
  document.getElementById('cliente-id').value    = c.id;
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
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { showMessage('Cliente eliminado', 'success'); loadClients(); }
  } catch { showMessage('Error al eliminar', 'error'); }
}

async function exportarClientes() { window.location.href = '/api/clients/export'; }

// ── Import Clientes CSV ──────────────────────────────
function importarClientes() { showModal('import-clientes-modal'); }

function handleClientesCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    const rows = lines.slice(1).map(l => l.split(',').map(v => v.trim().replace(/^"|"$/g,'')));
    App.csvClientes = rows.filter(r => r.length >= 2 && r[0]);
    document.getElementById('csv-clientes-info').textContent = `Se encontraron ${App.csvClientes.length} clientes para importar`;
    document.getElementById('csv-clientes-preview').style.display = 'block';
  };
  reader.readAsText(file, 'UTF-8');
}

async function confirmarImportarClientes() {
  if (!App.csvClientes.length) return;
  const input = document.getElementById('csv-clientes-input');
  const formData = new FormData();
  formData.append('file', input.files[0]);
  try {
    const res = await fetch('/api/clients/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      hideModal('import-clientes-modal');
      showMessage(data.message || `${data.imported_count} clientes importados`, 'success');
      document.getElementById('csv-clientes-preview').style.display = 'none';
      input.value = '';
      loadClients();
    } else { showMessage(data.error || 'Error al importar', 'error'); }
  } catch { showMessage('Error de conexión', 'error'); }
}

// ── Productos ─────────────────────────────────────────
async function loadProducts() {
  showLoading('products-table-body', 9);
  try {
    const res = await fetch('/api/products');
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
    return `<tr class="${low ? 'stock-bajo' : ''}">
      <td>${p.sku||'—'}</td>
      <td style="font-weight:500;">${p.nombre||'—'}</td>
      <td>${p.categoria||'—'}</td>
      <td>${p.proveedor||'—'}</td>
      <td>${formatCLP(p.precio||0)}</td>
      <td>${p.stock??0}</td>
      <td>${p.stock_minimo??0}</td>
      <td><span class="badge ${low ? 'badge-rechazado' : 'badge-aprobado'}">${low?'Stock Bajo':'Normal'}</span></td>
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
  setText('total-products', list.length);
  setText('total-categories', new Set(list.map(p=>p.categoria).filter(Boolean)).size);
  setText('total-value', formatCLP(list.reduce((s,p)=>s+(p.precio||0)*(p.stock||0),0)));
  setText('low-stock-count', list.filter(p=>p.stock<=p.stock_minimo).length);
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
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { showMessage('Producto eliminado', 'success'); loadProducts(); }
  } catch { showMessage('Error al eliminar', 'error'); }
}

// ── Import Productos CSV ─────────────────────────────
function importarProductos() { showModal('import-productos-modal'); }

function handleProductosCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    const rows = lines.slice(1).map(l => l.split(',').map(v => v.trim().replace(/^"|"$/g,'')));
    App.csvProductos = rows.filter(r => r.length >= 2 && r[0]);
    document.getElementById('csv-productos-info').textContent = `Se encontraron ${App.csvProductos.length} productos para importar`;
    document.getElementById('csv-productos-preview').style.display = 'block';
  };
  reader.readAsText(file, 'UTF-8');
}

async function confirmarImportarProductos() {
  if (!App.csvProductos.length) return;
  const input = document.getElementById('csv-productos-input');
  const formData = new FormData();
  formData.append('file', input.files[0]);
  try {
    const res = await fetch('/api/products/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      hideModal('import-productos-modal');
      showMessage(data.message || `${data.imported_count} productos importados`, 'success');
      document.getElementById('csv-productos-preview').style.display = 'none';
      input.value = '';
      loadProducts();
    } else { showMessage(data.error || 'Error al importar', 'error'); }
  } catch { showMessage('Error de conexión', 'error'); }
}

// ── Documentos ────────────────────────────────────────
async function loadDocuments() {
  showLoading('documents-table-body', 7);
  try {
    const res = await fetch('/api/documents');
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
          <button onclick="verDocumento(${d.id})" style="color:#60a5fa;background:none;border:none;cursor:pointer;padding:.25rem;" title="Ver"><i class="fas fa-eye"></i></button>
          <button onclick="generarPDF(${d.id})" style="color:#34d399;background:none;border:none;cursor:pointer;padding:.25rem;" title="PDF"><i class="fas fa-file-pdf"></i></button>
          <button onclick="cambiarEstadoDoc(${d.id})" style="color:#fbbf24;background:none;border:none;cursor:pointer;padding:.25rem;" title="Cambiar estado"><i class="fas fa-exchange-alt"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function filtrarDocumentos() {
  const tipo = document.getElementById('doc-filter-tipo').value;
  const estado = document.getElementById('doc-filter-estado').value;
  const filtered = App.documents.filter(d =>
    (!tipo || d.tipo === tipo) && (!estado || d.estado === estado)
  );
  renderDocuments(filtered);
}

async function cambiarEstadoDoc(id) {
  const doc = App.documents.find(d => d.id === id);
  if (!doc) return;
  const estados = ['pendiente','aprobado','rechazado'];
  const siguiente = estados[(estados.indexOf(doc.estado||'pendiente') + 1) % estados.length];
  try {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: siguiente })
    });
    const data = await res.json();
    if (data.success) { showMessage(`Estado cambiado a ${siguiente}`, 'success'); loadDocuments(); }
  } catch { showMessage('Error al cambiar estado', 'error'); }
}

function verDocumento(id) {
  const doc = App.documents.find(d => d.id === id);
  if (!doc) return;
  document.getElementById('ver-doc-title').textContent = doc.number || 'Documento';
  document.getElementById('doc-preview-content').innerHTML = generarHTMLDoc(doc);
  showModal('ver-documento-modal');
}

async function generarPDF(id) {
  try {
    const res = await fetch(`/api/generate-pdf/${id}`);
    const data = await res.json();
    if (data.success) showMessage('PDF generado exitosamente', 'success');
    else showMessage('Error al generar PDF', 'error');
  } catch { showMessage('Error al generar PDF', 'error'); }
}

// ── Crear Documento ──────────────────────────────────
function initCrearDoc() {
  const fechaEl = document.getElementById('doc-fecha');
  if (fechaEl && !fechaEl.value) {
    fechaEl.value = new Date().toISOString().split('T')[0];
  }
  // Cargar clientes en select si no hay opciones
  const sel = document.getElementById('doc-cliente');
  if (sel && sel.options.length <= 1 && App.clients.length > 0) {
    popularSelectClientes();
  } else if (sel && sel.options.length <= 1) {
    fetch('/api/clients').then(r => r.json()).then(cs => {
      App.clients = cs;
      popularSelectClientes();
    });
  }
  // Agregar una línea si no hay ninguna
  const lineas = document.getElementById('doc-lineas');
  if (lineas && !lineas.children.length) agregarLineaDoc();
}

function popularSelectClientes() {
  const sel = document.getElementById('doc-cliente');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar cliente —</option>';
  App.clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.razon_social} (${c.rut||'s/rut'})`;
    sel.appendChild(opt);
  });
}

function seleccionarTipoDoc(tipo) {
  document.getElementById('doc-tipo').value = tipo;
  document.querySelectorAll('.doc-type-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`tipo-${tipo}`);
  if (card) card.classList.add('selected');
  document.getElementById('doc-form-container').style.display = 'block';
  if (App.clients.length === 0) {
    fetch('/api/clients').then(r=>r.json()).then(cs => { App.clients = cs; popularSelectClientes(); });
  } else { popularSelectClientes(); }
  const fechaEl = document.getElementById('doc-fecha');
  if (fechaEl && !fechaEl.value) fechaEl.value = new Date().toISOString().split('T')[0];
  if (!document.getElementById('doc-lineas').children.length) agregarLineaDoc();
  actualizarPreview();
}

let lineaCounter = 0;
function agregarLineaDoc() {
  const id = ++lineaCounter;
  const container = document.getElementById('doc-lineas');
  const div = document.createElement('div');
  div.id = `linea-${id}`;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:.5rem;margin-bottom:.5rem;align-items:center;';
  div.innerHTML = `
    <input type="text" class="linea-input" placeholder="Descripción del producto/servicio"
      data-linea="${id}" data-field="desc" onkeyup="calcularTotales()">
    <input type="number" class="linea-input" placeholder="Cant." value="1" min="1"
      data-linea="${id}" data-field="qty" oninput="calcularTotales()">
    <input type="number" class="linea-input" placeholder="Precio unit."
      data-linea="${id}" data-field="price" oninput="calcularTotales()">
    <button onclick="eliminarLinea(${id})" style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:6px;padding:.3rem .5rem;cursor:pointer;font-size:.75rem;"><i class="fas fa-times"></i></button>
  `;
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
    const qty   = parseFloat(div.querySelector('[data-field="qty"]')?.value) || 0;
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
    const desc  = div.querySelector('[data-field="desc"]')?.value || '';
    const qty   = parseFloat(div.querySelector('[data-field="qty"]')?.value) || 0;
    const price = parseFloat(div.querySelector('[data-field="price"]')?.value) || 0;
    if (desc || price) lineas.push({ descripcion: desc, cantidad: qty, precio_unit: price, subtotal: qty * price });
  });
  return lineas;
}

function actualizarPreview() {
  const tipo     = document.getElementById('doc-tipo')?.value;
  const clienteId = parseInt(document.getElementById('doc-cliente')?.value);
  const cliente  = App.clients.find(c => c.id === clienteId);
  const fecha    = document.getElementById('doc-fecha')?.value;
  const notas    = document.getElementById('doc-notas')?.value;
  const lineas   = getLineas();
  const subtotalNum = lineas.reduce((s,l) => s + l.subtotal, 0);
  const ivaNum   = subtotalNum * 0.19;
  const totalNum = subtotalNum + ivaNum;

  if (!tipo) return;

  const cfg = App.config;
  const docData = {
    tipo, cliente, fecha, notas, lineas,
    subtotal: subtotalNum, iva: ivaNum, total: totalNum,
    number: `PREV-001`,
    config: cfg
  };

  const preview = document.getElementById('doc-live-preview');
  if (preview) preview.innerHTML = generarHTMLDoc(docData);
}

function generarHTMLDoc(doc) {
  const cfg = App.config || {};
  const tipoLabels = { cotizacion: 'COTIZACIÓN', orden_compra: 'ORDEN DE COMPRA', factura: 'FACTURA' };
  const tipoColors = { cotizacion: '#2563eb', orden_compra: '#7c3aed', factura: '#059669' };
  const color = tipoColors[doc.tipo] || '#2563eb';
  const empresa = {
    nombre: cfg.empresaNombre || 'Mi Empresa',
    rut: cfg.empresaRut || '',
    direccion: cfg.empresaDireccion || '',
    telefono: cfg.empresaTelefono || '',
    email: cfg.empresaEmail || ''
  };
  const lineas = doc.lineas || doc.items || [];
  const subtotal = doc.subtotal || lineas.reduce((s,l)=>s+(l.subtotal||0),0);
  const iva = doc.iva || subtotal * 0.19;
  const total = doc.total || subtotal + iva;
  const piePagina = cfg.piePagina || 'Gracias por su preferencia.';
  const logoHTML = cfg.logo ? `<img src="${cfg.logo}" style="max-height:60px;max-width:160px;object-fit:contain;">` : `<div style="font-size:1.4rem;font-weight:700;color:${color};">${empresa.nombre}</div>`;
  const mostrarEmpresa = cfg.mostrarEmpresa !== false;

  return `
    <div style="max-width:700px;margin:0 auto;">
      <div class="doc-preview-header">
        <div>${cfg.mostrarLogo !== false ? logoHTML : `<div style="font-size:1.4rem;font-weight:700;color:${color};">${empresa.nombre}</div>`}
          ${mostrarEmpresa ? `<div style="font-size:.75rem;color:#6b7280;margin-top:.35rem;">
            ${empresa.rut ? `RUT: ${empresa.rut}<br>` : ''}
            ${empresa.direccion ? `${empresa.direccion}<br>` : ''}
            ${empresa.telefono ? `Tel: ${empresa.telefono}` : ''}
          </div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.3rem;font-weight:800;color:${color};">${tipoLabels[doc.tipo]||'DOCUMENTO'}</div>
          <div style="font-size:.9rem;font-weight:700;margin-top:.2rem;">${doc.number||'—'}</div>
          <div style="font-size:.78rem;color:#6b7280;margin-top:.35rem;">Fecha: ${doc.date||(doc.fecha?doc.fecha.split('T')[0]:'')||'—'}</div>
        </div>
      </div>
      ${doc.cliente ? `
      <div style="background:#f9fafb;padding:.75rem 1rem;border-radius:6px;margin-bottom:1rem;font-size:.8rem;">
        <div style="font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;margin-bottom:.35rem;">Cliente</div>
        <strong>${doc.cliente.razon_social||'—'}</strong>
        ${doc.cliente.rut ? `<span style="color:#6b7280;"> · RUT: ${doc.cliente.rut}</span>` : ''}
        ${doc.cliente.direccion ? `<div style="color:#6b7280;margin-top:.2rem;">${doc.cliente.direccion}</div>` : ''}
        ${doc.cliente.email ? `<div style="color:#6b7280;">${doc.cliente.email}</div>` : ''}
      </div>` : ''}
      <table>
        <thead><tr>
          <th style="width:45%;">Descripción</th>
          <th style="width:15%;text-align:center;">Cant.</th>
          <th style="width:20%;text-align:right;">P. Unit.</th>
          <th style="width:20%;text-align:right;">Total</th>
        </tr></thead>
        <tbody>
          ${lineas.length ? lineas.map(l => `<tr>
            <td>${l.descripcion||'—'}</td>
            <td style="text-align:center;">${l.cantidad||1}</td>
            <td style="text-align:right;">${formatCLP(l.precio_unit||0)}</td>
            <td style="text-align:right;font-weight:500;">${formatCLP(l.subtotal||0)}</td>
          </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:1rem;">Sin items</td></tr>'}
        </tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:.75rem;">
        <div style="min-width:200px;font-size:.82rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:.25rem;"><span style="color:#6b7280;">Subtotal</span><span>${formatCLP(subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:.25rem;"><span style="color:#6b7280;">IVA (19%)</span><span>${formatCLP(iva)}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:.95rem;border-top:2px solid #111;padding-top:.35rem;margin-top:.35rem;"><span>Total</span><span>${formatCLP(total)}</span></div>
        </div>
      </div>
      ${doc.notas ? `<div style="margin-top:1rem;padding:.75rem;background:#f9fafb;border-radius:6px;font-size:.78rem;color:#374151;"><strong>Notas:</strong> ${doc.notas}</div>` : ''}
      <div style="margin-top:1.5rem;padding-top:.75rem;border-top:1px solid #e5e7eb;font-size:.72rem;color:#9ca3af;text-align:center;">${piePagina}</div>
    </div>`;
}

async function guardarDocumento() {
  const tipo = document.getElementById('doc-tipo').value;
  if (!tipo) { showMessage('Selecciona el tipo de documento', 'error'); return; }
  const clienteId = parseInt(document.getElementById('doc-cliente').value);
  if (!clienteId) { showMessage('Selecciona un cliente', 'error'); return; }
  const cliente = App.clients.find(c => c.id === clienteId);
  const lineas = getLineas();
  if (!lineas.length) { showMessage('Agrega al menos un producto', 'error'); return; }
  const subtotal = lineas.reduce((s,l) => s + l.subtotal, 0);
  const iva = subtotal * 0.19;
  const total = subtotal + iva;
  const payload = {
    tipo,
    cliente,
    fecha: document.getElementById('doc-fecha').value,
    validez: parseInt(document.getElementById('doc-validez').value) || 30,
    notas: document.getElementById('doc-notas').value,
    items: lineas,
    subtotal, iva, total
  };
  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showMessage(`Documento ${data.document.number} creado`, 'success');
      limpiarFormDoc();
      navigateTo('documentos');
    } else { showMessage(data.error || 'Error al guardar', 'error'); }
  } catch { showMessage('Error de conexión', 'error'); }
}

function limpiarFormDoc() {
  document.getElementById('doc-tipo').value = '';
  document.getElementById('doc-cliente').value = '';
  document.getElementById('doc-notas').value = '';
  document.getElementById('doc-lineas').innerHTML = '';
  document.querySelectorAll('.doc-type-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('doc-form-container').style.display = 'none';
  lineaCounter = 0;
  calcularTotales();
}

// ── Reportes ──────────────────────────────────────────
async function loadReportes() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    renderReportes(stats);
  } catch(e) { console.error('Error reportes', e); }
}

function renderReportes(stats) {
  const c = document.getElementById('reportes-content');
  if (!c) return;
  const clientRows = Object.entries(stats.client_stats||{})
    .sort((a,b) => b[1].total - a[1].total).slice(0,10)
    .map(([name,s]) => `<tr><td>${name}</td><td>${s.count}</td><td>${formatCLP(s.total)}</td></tr>`).join('')
    || `<tr><td colspan="3" class="empty-table-message">Sin datos</td></tr>`;
  const typeStats = stats.doc_type_stats || {};
  c.innerHTML = `
    <div class="stats-grid">
      <div class="card stat-card"><div class="stat-icon bg-blue"><i class="fas fa-file-alt"></i></div><div class="stat-info"><p class="stat-label">Total Documentos</p><p class="stat-value">${stats.total_documents??0}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-green"><i class="fas fa-dollar-sign"></i></div><div class="stat-info"><p class="stat-label">Ventas Totales</p><p class="stat-value">${formatCLP(stats.total_sales??0)}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-blue"><i class="fas fa-file-invoice"></i></div><div class="stat-info"><p class="stat-label">Cotizaciones</p><p class="stat-value">${typeStats.cotizacion?.count||0}</p></div></div>
      <div class="card stat-card"><div class="stat-icon bg-purple"><i class="fas fa-shopping-cart"></i></div><div class="stat-info"><p class="stat-label">Órdenes Compra</p><p class="stat-value">${typeStats.orden_compra?.count||0}</p></div></div>
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
        <h3 style="font-weight:600;margin-bottom:1rem;">Por Tipo de Documento</h3>
        ${['cotizacion','orden_compra','factura'].map(t => {
          const s = typeStats[t]||{count:0,total:0};
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 0;border-bottom:1px solid #1e2d3d;">
            <div style="display:flex;align-items:center;gap:.6rem;"><span class="badge badge-${t}">${tipoLabel(t)}</span></div>
            <div><strong>${s.count}</strong> docs — ${formatCLP(s.total)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── Formularios ───────────────────────────────────────
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

// ── Búsqueda ──────────────────────────────────────────
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

// ── Perfil ────────────────────────────────────────────
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

// ── Configuración ─────────────────────────────────────
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

function mostrarCfgPanel(panel) {
  document.querySelectorAll('.cfg-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cfg-tab').forEach(t => t.classList.remove('active'));
  const p = document.getElementById(`cfgpanel-${panel}`);
  const t = document.getElementById(`cfgtab-${panel}`);
  if (p) p.classList.add('active');
  if (t) t.classList.add('active');
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

function cambiarColor(color, btn) {
  document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  App.config.color = color;
  document.documentElement.style.setProperty('--primary-color', color);
}

// ── Dropdown ──────────────────────────────────────────
function toggleDropdown(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  closeDropdowns();
  if (!isOpen) menu.classList.add('open');
}

function closeDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
}

function setupDropdownClose() {
  document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) closeDropdowns();
  });
}

// ── Modales ───────────────────────────────────────────
function showModal(id) {
  const m = document.getElementById(id);
  if (m) { m.style.display = 'block'; m.classList.add('scale-in'); }
}

function hideModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
});

// ── Notificaciones ────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────
function setText(selector, value) {
  const el = typeof selector === 'string'
    ? (selector.startsWith('[') || selector.startsWith('#') && !document.getElementById(selector.slice(1))
       ? document.querySelector(selector) : document.getElementById(selector.replace(/^#/,'')))
    : selector;
  if (el) el.textContent = value;
}

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', minimumFractionDigits:0 }).format(amount);
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function tipoLabel(tipo) {
  const map = { cotizacion:'Cotización', orden_compra:'Orden Compra', factura:'Factura' };
  return map[tipo] || tipo || '—';
}

function showLoading(tbodyId, cols = 6) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty-table-message"><i class="fas fa-spinner fa-spin" style="margin-right:.5rem;"></i>Cargando...</td></tr>`;
}

function showError(tbodyId, msg, cols = 6) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty-table-message" style="color:#f87171;"><i class="fas fa-exclamation-circle" style="margin-right:.5rem;"></i>${msg}</td></tr>`;
}

} // fin bloque if pathname !== /login
