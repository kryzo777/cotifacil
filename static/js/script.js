/* =====================================================
   CotiFácil — script.js
   ===================================================== */

// Si estamos en la página de login, no ejecutar nada
if (window.location.pathname === '/login') {
  // El login tiene su propio script inline, salir aquí
  throw new Error('login-page-exit');
}

// ── Estado global ──────────────────────────────────────
const App = {
  currentPage: 'dashboard',
  clients: [],
  products: [],
  documents: [],
  user: null,
};

// ── Inicialización ────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  setupNavigation();
  setupLogout();
  setupForms();
  setupSearch();

  // Cargar página según hash actual
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);
});

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
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await fetch('/logout');
    window.location.href = '/login';
  });
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
  // Ocultar todas las páginas
  document.querySelectorAll('.page-content').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('active');
  });

  // Quitar active de nav links
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  // Mostrar página destino
  const target = document.getElementById(`${page}-page`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  // Activar nav link
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Actualizar título del header
  const titles = {
    dashboard: 'Dashboard',
    clientes: 'Clientes',
    productos: 'Productos',
    documentos: 'Documentos',
    'crear-documento': 'Crear Documento',
    reportes: 'Reportes',
  };
  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;

  App.currentPage = page;

  // Cargar datos de la página
  switch (page) {
    case 'dashboard':   loadDashboard();   break;
    case 'clientes':    loadClients();     break;
    case 'productos':   loadProducts();    break;
    case 'documentos':  loadDocuments();   break;
    case 'reportes':    loadReportes();    break;
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
  } catch (e) {
    console.error('Error cargando dashboard', e);
  }
}

function renderRecentDocs(docs) {
  const container = document.getElementById('recent-docs');
  if (!container) return;

  if (!docs.length) {
    container.innerHTML = '<p class="text-gray-400 text-sm">No hay documentos recientes.</p>';
    return;
  }

  container.innerHTML = docs.map(d => `
    <div class="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
      <div>
        <p class="text-sm font-medium">${d.number || '—'}</p>
        <p class="text-xs text-gray-400">${d.cliente?.razon_social || 'Sin cliente'}</p>
      </div>
      <span class="text-sm font-semibold">${formatCLP(d.total || 0)}</span>
    </div>`).join('');
}

// ── Clientes ──────────────────────────────────────────
async function loadClients() {
  showLoading('clients-table-body');
  try {
    const res = await fetch('/api/clients');
    App.clients = await res.json();
    renderClients(App.clients);
  } catch {
    showError('clients-table-body', 'Error cargando clientes');
  }
}

function renderClients(list) {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-table-message">No hay clientes registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${c.rut || '—'}</td>
      <td>${c.razon_social || '—'}</td>
      <td>${c.direccion || '—'}</td>
      <td>${c.region || '—'}</td>
      <td>${c.ciudad || '—'}</td>
      <td>
        <div class="text-sm">${c.email || '—'}</div>
        <div class="text-xs text-gray-400">${c.telefono || ''}</div>
      </td>
      <td>${c.documentos || 0}</td>
      <td>${formatCLP(c.total || 0)}</td>
      <td>
        <div class="flex gap-2">
          <button onclick="editarCliente(${c.id})" class="text-blue-400 hover:text-blue-300 transition" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="eliminarCliente(${c.id})" class="text-red-400 hover:text-red-300 transition" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
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
  const client = App.clients.find(c => c.id === id);
  if (!client) return;

  document.getElementById('cliente-modal-title').textContent = 'Editar Cliente';
  document.getElementById('cliente-id').value   = client.id;
  document.getElementById('rut').value           = client.rut || '';
  document.getElementById('razon-social').value  = client.razon_social || '';
  document.getElementById('direccion').value     = client.direccion || '';
  document.getElementById('region').value        = client.region || '';
  document.getElementById('ciudad').value        = client.ciudad || '';
  document.getElementById('telefono').value      = client.telefono || '';
  document.getElementById('email').value         = client.email || '';
  document.getElementById('nota').value          = client.nota || '';
  showModal('cliente-modal');
}

async function eliminarCliente(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  try {
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showMessage('Cliente eliminado', 'success');
      loadClients();
    }
  } catch {
    showMessage('Error al eliminar cliente', 'error');
  }
}

async function exportarClientes() {
  window.location.href = '/api/clients/export';
}

// ── Productos ─────────────────────────────────────────
async function loadProducts() {
  showLoading('products-table-body');
  try {
    const res = await fetch('/api/products');
    App.products = await res.json();
    renderProducts(App.products);
    updateProductStats(App.products);
  } catch {
    showError('products-table-body', 'Error cargando productos');
  }
}

function renderProducts(list) {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-table-message">No hay productos registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const lowStock = p.stock <= p.stock_minimo;
    return `
    <tr class="${lowStock ? 'stock-bajo' : 'stock-normal'}">
      <td>${p.sku || '—'}</td>
      <td>${p.nombre || '—'}</td>
      <td>${p.categoria || '—'}</td>
      <td>${p.proveedor || '—'}</td>
      <td>${formatCLP(p.precio || 0)}</td>
      <td>${p.stock ?? 0}</td>
      <td>${p.stock_minimo ?? 0}</td>
      <td>
        <span class="px-2 py-1 rounded text-xs font-medium ${lowStock
          ? 'bg-red-900 text-red-300'
          : 'bg-green-900 text-green-300'}">
          ${lowStock ? 'Stock Bajo' : 'Normal'}
        </span>
      </td>
      <td>
        <div class="flex gap-2">
          <button onclick="editarProducto(${p.id})" class="text-blue-400 hover:text-blue-300 transition" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="eliminarProducto(${p.id})" class="text-red-400 hover:text-red-300 transition" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateProductStats(list) {
  setText('total-products', list.length);
  const cats = new Set(list.map(p => p.categoria).filter(Boolean));
  setText('total-categories', cats.size);
  const value = list.reduce((sum, p) => sum + (p.precio || 0) * (p.stock || 0), 0);
  setText('total-value', formatCLP(value));
  const low = list.filter(p => p.stock <= p.stock_minimo).length;
  setText('low-stock-count', low);
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
  document.getElementById('producto-id').value     = p.id;
  document.getElementById('sku').value             = p.sku || '';
  document.getElementById('nombre').value          = p.nombre || '';
  document.getElementById('precio').value          = p.precio || '';
  document.getElementById('stock').value           = p.stock ?? '';
  document.getElementById('stock_minimo').value    = p.stock_minimo ?? '';
  document.getElementById('categoria').value       = p.categoria || '';
  document.getElementById('proveedor').value       = p.proveedor || '';
  showModal('producto-modal');
}

async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showMessage('Producto eliminado', 'success');
      loadProducts();
    }
  } catch {
    showMessage('Error al eliminar producto', 'error');
  }
}

// ── Documentos ────────────────────────────────────────
async function loadDocuments() {
  showLoading('documents-table-body');
  try {
    const res = await fetch('/api/documents');
    App.documents = await res.json();
    renderDocuments(App.documents);
  } catch {
    showError('documents-table-body', 'Error cargando documentos');
  }
}

function renderDocuments(list) {
  const tbody = document.getElementById('documents-table-body');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table-message">No hay documentos registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(d => `
    <tr>
      <td>${d.number || '—'}</td>
      <td>${d.date ? d.date.split(' ')[0] : '—'}</td>
      <td>${d.cliente?.razon_social || '—'}</td>
      <td>${formatCLP(d.total || 0)}</td>
      <td>
        <span class="px-2 py-1 rounded text-xs font-medium ${estadoBadge(d.estado)}">
          ${capitalize(d.estado || 'pendiente')}
        </span>
      </td>
      <td>
        <div class="flex gap-2">
          <button onclick="verDocumento(${d.id})" class="text-blue-400 hover:text-blue-300 transition" title="Ver">
            <i class="fas fa-eye"></i>
          </button>
          <button onclick="generarPDF(${d.id})" class="text-green-400 hover:text-green-300 transition" title="PDF">
            <i class="fas fa-file-pdf"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function estadoBadge(estado) {
  const map = {
    pendiente: 'bg-yellow-900 text-yellow-300',
    aprobado:  'bg-green-900 text-green-300',
    rechazado: 'bg-red-900 text-red-300',
  };
  return map[estado] || 'bg-gray-700 text-gray-300';
}

async function generarPDF(id) {
  try {
    const res = await fetch(`/api/generate-pdf/${id}`);
    const data = await res.json();
    if (data.success) showMessage('PDF generado exitosamente', 'success');
    else showMessage('Error al generar PDF', 'error');
  } catch {
    showMessage('Error al generar PDF', 'error');
  }
}

function verDocumento(id) {
  const doc = App.documents.find(d => d.id === id);
  if (!doc) return;
  alert(`Documento: ${doc.number}\nCliente: ${doc.cliente?.razon_social || '—'}\nTotal: ${formatCLP(doc.total || 0)}\nEstado: ${doc.estado}`);
}

// ── Reportes ──────────────────────────────────────────
async function loadReportes() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    renderReportes(stats);
  } catch (e) {
    console.error('Error cargando reportes', e);
  }
}

function renderReportes(stats) {
  const container = document.getElementById('reportes-content');
  if (!container) return;

  const clientRows = Object.entries(stats.client_stats || {})
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, s]) => `
      <tr>
        <td>${name}</td>
        <td>${s.count}</td>
        <td>${formatCLP(s.total)}</td>
      </tr>`).join('') || `<tr><td colspan="3" class="empty-table-message">Sin datos</td></tr>`;

  container.innerHTML = `
    <div class="stats-grid mb-6">
      <div class="card stat-card">
        <div class="stat-icon bg-blue"><i class="fas fa-file-alt"></i></div>
        <div class="stat-info">
          <p class="stat-label">Total Documentos</p>
          <p class="stat-value">${stats.total_documents ?? 0}</p>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon bg-green"><i class="fas fa-dollar-sign"></i></div>
        <div class="stat-info">
          <p class="stat-label">Ventas Totales</p>
          <p class="stat-value">${formatCLP(stats.total_sales ?? 0)}</p>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 class="text-lg font-semibold mb-4">Top Clientes por Ventas</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Cliente</th><th>Documentos</th><th>Total</th></tr></thead>
          <tbody>${clientRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Formularios ───────────────────────────────────────
function setupForms() {
  // Formulario clientes
  const clienteForm = document.getElementById('cliente-form');
  if (clienteForm) {
    clienteForm.addEventListener('submit', async e => {
      e.preventDefault();
      const id = document.getElementById('cliente-id').value;
      const payload = {
        rut:          document.getElementById('rut').value.trim(),
        razon_social: document.getElementById('razon-social').value.trim(),
        direccion:    document.getElementById('direccion').value.trim(),
        region:       document.getElementById('region').value.trim(),
        ciudad:       document.getElementById('ciudad').value.trim(),
        telefono:     document.getElementById('telefono').value.trim(),
        email:        document.getElementById('email').value.trim(),
        nota:         document.getElementById('nota').value.trim(),
      };

      try {
        const url    = id ? `/api/clients/${id}` : '/api/clients';
        const method = id ? 'PUT' : 'POST';
        const res    = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          hideModal('cliente-modal');
          showMessage(id ? 'Cliente actualizado' : 'Cliente creado', 'success');
          loadClients();
        } else {
          showMessage(data.error || 'Error guardando cliente', 'error');
        }
      } catch {
        showMessage('Error de conexión', 'error');
      }
    });
  }

  // Formulario productos
  const productoForm = document.getElementById('producto-form');
  if (productoForm) {
    productoForm.addEventListener('submit', async e => {
      e.preventDefault();
      const id = document.getElementById('producto-id').value;
      const payload = {
        sku:          document.getElementById('sku').value.trim(),
        nombre:       document.getElementById('nombre').value.trim(),
        precio:       parseFloat(document.getElementById('precio').value) || 0,
        stock:        parseInt(document.getElementById('stock').value)    || 0,
        stock_minimo: parseInt(document.getElementById('stock_minimo').value) || 0,
        categoria:    document.getElementById('categoria').value.trim(),
        proveedor:    document.getElementById('proveedor').value.trim(),
      };

      try {
        const url    = id ? `/api/products/${id}` : '/api/products';
        const method = id ? 'PUT' : 'POST';
        const res    = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          hideModal('producto-modal');
          showMessage(id ? 'Producto actualizado' : 'Producto creado', 'success');
          loadProducts();
        } else {
          showMessage(data.error || 'Error guardando producto', 'error');
        }
      } catch {
        showMessage('Error de conexión', 'error');
      }
    });
  }
}

// ── Búsqueda ──────────────────────────────────────────
function setupSearch() {
  const clientSearch = document.getElementById('client-search');
  if (clientSearch) {
    clientSearch.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = App.clients.filter(c =>
        (c.rut           || '').toLowerCase().includes(q) ||
        (c.razon_social  || '').toLowerCase().includes(q) ||
        (c.ciudad        || '').toLowerCase().includes(q) ||
        (c.email         || '').toLowerCase().includes(q)
      );
      renderClients(filtered);
    });
  }

  const productSearch = document.getElementById('product-search');
  if (productSearch) {
    productSearch.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = App.products.filter(p =>
        (p.sku       || '').toLowerCase().includes(q) ||
        (p.nombre    || '').toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q) ||
        (p.proveedor || '').toLowerCase().includes(q)
      );
      renderProducts(filtered);
    });
  }
}

// ── Modales ───────────────────────────────────────────
function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'block';
    modal.classList.add('scale-in');
  }
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

// Cerrar modal con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  }
});

// ── Notificaciones ────────────────────────────────────
function showMessage(text, type = 'success') {
  // Eliminar mensaje anterior si existe
  const prev = document.getElementById('global-message');
  if (prev) prev.remove();

  const div = document.createElement('div');
  div.id = 'global-message';
  div.style.cssText = `
    position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999;
    padding: 0.875rem 1.25rem; border-radius: 10px;
    font-size: 0.9rem; font-weight: 500;
    display: flex; align-items: center; gap: 0.6rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    ${type === 'success'
      ? 'background:#052e16; border:1px solid #166534; color:#86efac;'
      : 'background:#2d0808; border:1px solid #7f1d1d; color:#fca5a5;'}
  `;
  div.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
    <span>${text}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

// ── Helpers ───────────────────────────────────────────
function setText(selector, value) {
  const el = typeof selector === 'string'
    ? (selector.startsWith('[') ? document.querySelector(selector) : document.getElementById(selector))
    : selector;
  if (el) el.textContent = value;
}

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0
  }).format(amount);
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function showLoading(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-table-message">
      <i class="fas fa-spinner fa-spin mr-2"></i>Cargando...
    </td></tr>`;
  }
}

function showError(tbodyId, msg) {
  const tbody = document.getElementById(tbodyId);
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-table-message text-red-400">
      <i class="fas fa-exclamation-circle mr-2"></i>${msg}
    </td></tr>`;
  }
}
