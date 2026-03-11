import io, csv, smtplib, hashlib, secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Response, Flask, render_template, request, jsonify, session, redirect, url_for
import json, os
from datetime import datetime
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'cotifacil_secret_key_2024')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_FILE  = os.path.join(DATA_DIR, 'database.json')

# ── Helpers contraseña ────────────────────────────────────────────
def hash_password(password):
    salt   = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password, stored):
    """Compatible con contraseñas legacy sin hash (como admin123)."""
    if ':' not in stored:
        return password == stored
    salt, hashed = stored.split(':', 1)
    return hashlib.sha256((salt + password).encode()).hexdigest() == hashed

# ── Base de datos ─────────────────────────────────────────────────
def init_db():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                "users": [{
                    "id": 1,
                    "email": "admin@cotifacil.com",
                    "password": "admin123",
                    "name": "Administrador",
                    "role": "admin"
                }],
                "user_data": {
                    "1": {"clients": [], "products": [], "documents": [], "config": {}}
                }
            }, f, indent=4, ensure_ascii=False)
    else:
        # Migrar DB antigua (clients/products/documents en raiz -> user_data)
        db = load_db_raw()
        changed = False
        if 'user_data' not in db:
            db['user_data'] = {}
            changed = True
        if 'clients' in db or 'products' in db or 'documents' in db:
            for user in db.get('users', []):
                uid = str(user['id'])
                if uid not in db['user_data']:
                    db['user_data'][uid] = {
                        'clients':   db.get('clients', []),
                        'products':  db.get('products', []),
                        'documents': db.get('documents', []),
                        'config':    {}
                    }
            db.pop('clients', None)
            db.pop('products', None)
            db.pop('documents', None)
            changed = True
        if changed:
            save_db(db)

def load_db_raw():
    with open(DB_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_db():
    try:
        return load_db_raw()
    except:
        init_db()
        return load_db_raw()

def save_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def get_user_data(db, uid):
    uid = str(uid)
    if 'user_data' not in db:
        db['user_data'] = {}
    if uid not in db['user_data']:
        db['user_data'][uid] = {'clients': [], 'products': [], 'documents': [], 'config': {}}
    return db['user_data'][uid]

def get_next_id(items):
    return max((item['id'] for item in items), default=0) + 1

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Login requerido"}), 401
        return f(*args, **kwargs)
    return decorated

# ── Email ─────────────────────────────────────────────────────────
def send_email_smtp(to_email, subject, html_body):
    smtp_host = os.environ.get('SMTP_HOST', '')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))
    smtp_user = os.environ.get('SMTP_USER', '')
    smtp_pass = os.environ.get('SMTP_PASS', '')
    if not smtp_host or not smtp_user:
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject; msg['From'] = smtp_user; msg['To'] = to_email
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo(); server.starttls(); server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[Email error] {e}"); return False

def generar_html_documento(doc):
    tipo_labels = {'cotizacion': 'COTIZACION', 'orden_compra': 'ORDEN DE COMPRA', 'factura': 'FACTURA'}
    lineas   = doc.get('items', [])
    subtotal = doc.get('subtotal', 0); iva = doc.get('iva', 0); total = doc.get('total', 0)
    cliente  = doc.get('cliente', {}) or {}
    rows = ''.join(
        f'<tr><td style="padding:.5rem;border-bottom:1px solid #eee;">{l.get("descripcion","")}</td>'
        f'<td style="padding:.5rem;border-bottom:1px solid #eee;text-align:center;">{l.get("cantidad",1)}</td>'
        f'<td style="padding:.5rem;border-bottom:1px solid #eee;text-align:right;">${l.get("precio_unit",0):,.0f}</td>'
        f'<td style="padding:.5rem;border-bottom:1px solid #eee;text-align:right;">${l.get("subtotal",0):,.0f}</td></tr>'
        for l in lineas
    )
    return (
        f'<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:2rem;">'
        f'<div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #1d4ed8;">'
        f'<div><h2 style="color:#1d4ed8;margin:0;">{tipo_labels.get(doc.get("tipo",""),"DOCUMENTO")}</h2>'
        f'<p style="margin:.25rem 0;">N {doc.get("number","")}</p></div>'
        f'<div style="text-align:right;font-size:.85rem;">Fecha: {(doc.get("date") or "")[:10]}</div></div>'
        f'<div style="background:#f9fafb;padding:.75rem;border-radius:6px;margin-bottom:1rem;">'
        f'<strong>Cliente:</strong> {cliente.get("razon_social","")}'
        f'{(" RUT: "+cliente.get("rut","")) if cliente.get("rut") else ""}</div>'
        f'<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f3f4f6;">'
        f'<th style="padding:.5rem;text-align:left;">Descripcion</th>'
        f'<th style="padding:.5rem;text-align:center;">Cant.</th>'
        f'<th style="padding:.5rem;text-align:right;">P.Unit.</th>'
        f'<th style="padding:.5rem;text-align:right;">Total</th></tr></thead>'
        f'<tbody>{rows}</tbody></table>'
        f'<div style="text-align:right;margin-top:1rem;">'
        f'<p>Subtotal: <strong>${subtotal:,.0f}</strong></p>'
        f'<p>IVA 19%: <strong>${iva:,.0f}</strong></p>'
        f'<p style="font-size:1.1rem;font-weight:700;color:#1d4ed8;">Total: ${total:,.0f}</p>'
        f'</div></div>'
    )

# ── Rutas principales ─────────────────────────────────────────────
@app.route('/')
def index():
    if 'user_id' in session:
        return render_template('index.html')
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET' and 'user_id' in session:
        return redirect(url_for('index'))
    if request.method == 'POST':
        try:
            data     = request.get_json()
            email    = data.get('email', '').strip().lower()
            password = data.get('password', '')
            db       = load_db()
            for user in db['users']:
                if user['email'].lower() == email and verify_password(password, user['password']):
                    session['user_id']    = user['id']
                    session['user_name']  = user['name']
                    session['user_email'] = user['email']
                    return jsonify({"success": True, "user": {"name": user['name'], "email": user['email']}})
            return jsonify({"success": False, "message": "Credenciales incorrectas"}), 401
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        if 'user_id' in session:
            return redirect(url_for('index'))
        return render_template('register.html')
    try:
        data  = request.get_json()
        name  = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        pwd   = data.get('password', '')
        pwd2  = data.get('password2', '')

        if not name or not email or not pwd:
            return jsonify({"success": False, "message": "Todos los campos son obligatorios"}), 400
        if len(pwd) < 6:
            return jsonify({"success": False, "message": "La contrasena debe tener al menos 6 caracteres"}), 400
        if pwd != pwd2:
            return jsonify({"success": False, "message": "Las contrasenas no coinciden"}), 400

        db = load_db()
        if any(u['email'].lower() == email for u in db['users']):
            return jsonify({"success": False, "message": "Este correo ya esta registrado"}), 400

        new_user = {
            "id":       get_next_id(db['users']),
            "email":    email,
            "password": hash_password(pwd),
            "name":     name,
            "role":     "user"
        }
        db['users'].append(new_user)
        get_user_data(db, new_user['id'])
        save_db(db)

        session['user_id']    = new_user['id']
        session['user_name']  = new_user['name']
        session['user_email'] = new_user['email']
        return jsonify({"success": True, "user": {"name": new_user['name'], "email": new_user['email']}})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/logout')
def logout():
    session.clear()
    return jsonify({"success": True})

@app.route('/api/user')
def api_user():
    if 'user_id' in session:
        return jsonify({"id": session['user_id'], "name": session['user_name'], "email": session['user_email']})
    return jsonify({"error": "No autenticado"}), 401

@app.route('/api/user/update', methods=['PUT'])
@login_required
def api_user_update():
    try:
        data_in = request.get_json(); db = load_db(); uid = session['user_id']
        for i, user in enumerate(db['users']):
            if user['id'] == uid:
                if data_in.get('name'):  db['users'][i]['name']  = data_in['name']
                if data_in.get('email'): db['users'][i]['email'] = data_in['email']
                if data_in.get('password_nueva'):
                    if not verify_password(data_in.get('password_actual', ''), user['password']):
                        return jsonify({"success": False, "error": "Contrasena actual incorrecta"}), 400
                    db['users'][i]['password'] = hash_password(data_in['password_nueva'])
                save_db(db)
                session['user_name']  = db['users'][i]['name']
                session['user_email'] = db['users'][i]['email']
                return jsonify({"success": True})
        return jsonify({"success": False, "error": "Usuario no encontrado"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Clientes ──────────────────────────────────────────────────────
@app.route('/api/clients', methods=['GET', 'POST'])
@login_required
def api_clients():
    try:
        db = load_db(); ud = get_user_data(db, session['user_id'])
        if request.method == 'GET':
            return jsonify(ud['clients'])
        nc = request.get_json()
        nc['id'] = get_next_id(ud['clients'])
        nc.setdefault('documentos', 0); nc.setdefault('total', 0)
        ud['clients'].append(nc); save_db(db)
        return jsonify({"success": True, "client": nc})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/<int:client_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_client(client_id):
    try:
        db = load_db(); ud = get_user_data(db, session['user_id'])
        if request.method == 'GET':
            c = next((c for c in ud['clients'] if c['id'] == client_id), None)
            return jsonify(c) if c else (jsonify({"error": "No encontrado"}), 404)
        elif request.method == 'PUT':
            payload = request.get_json()
            for i, c in enumerate(ud['clients']):
                if c['id'] == client_id:
                    ud['clients'][i].update(payload); save_db(db)
                    return jsonify({"success": True, "client": ud['clients'][i]})
            return jsonify({"error": "No encontrado"}), 404
        elif request.method == 'DELETE':
            ud['clients'] = [c for c in ud['clients'] if c['id'] != client_id]
            save_db(db); return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/export')
@login_required
def api_export_clients():
    try:
        db = load_db(); ud = get_user_data(db, session['user_id'])
        output = io.StringIO(); writer = csv.writer(output)
        writer.writerow(['RUT','Razon Social','Direccion','Region','Ciudad','Email','Telefono','Nota','Documentos','Total'])
        for c in ud['clients']:
            writer.writerow([c.get('rut',''), c.get('razon_social',''), c.get('direccion',''), c.get('region',''),
                             c.get('ciudad',''), c.get('email',''), c.get('telefono',''), c.get('nota',''),
                             c.get('documentos',0), c.get('total',0)])
        output.seek(0)
        return Response(output.getvalue(), mimetype="text/csv",
                        headers={"Content-Disposition": "attachment; filename=clientes_cotifacil.csv"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/import', methods=['POST'])
@login_required
def api_import_clients():
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No se proporciono archivo"}), 400
        file = request.files['file']
        if not file.filename.lower().endswith('.csv'):
            return jsonify({"success": False, "error": "Solo archivos CSV"}), 400
        db = load_db(); ud = get_user_data(db, session['user_id'])
        content = file.stream.read()
        try:    text = content.decode('utf-8-sig')
        except: text = content.decode('latin-1', errors='replace')
        stream = io.StringIO(text, newline=None); reader = csv.reader(stream); next(reader, None)
        new_clients = []
        for row in reader:
            if not row or len(row) < 2 or not row[0].strip(): continue
            rut = row[0].strip()
            if any(c.get('rut','').strip() == rut for c in ud['clients'] + new_clients): continue
            new_clients.append({
                'id': get_next_id(ud['clients'] + new_clients), 'rut': rut,
                'razon_social': row[1].strip() if len(row)>1 else '',
                'direccion':    row[2].strip() if len(row)>2 else '',
                'region':       row[3].strip() if len(row)>3 else '',
                'ciudad':       row[4].strip() if len(row)>4 else '',
                'email':        row[5].strip() if len(row)>5 else '',
                'telefono':     row[6].strip() if len(row)>6 else '',
                'nota':         row[7].strip() if len(row)>7 else '',
                'documentos': 0, 'total': 0
            })
        ud['clients'].extend(new_clients); save_db(db)
        return jsonify({"success": True, "message": f"Se importaron {len(new_clients)} clientes exitosamente", "imported_count": len(new_clients)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Productos ─────────────────────────────────────────────────────
@app.route('/api/products', methods=['GET', 'POST'])
@login_required
def api_products():
    try:
        db = load_db(); ud = get_user_data(db, session['user_id'])
        if request.method == 'GET':
            return jsonify(ud['products'])
        np_ = request.get_json()
        np_['id'] = get_next_id(ud['products'])
        ud['products'].append(np_); save_db(db)
        return jsonify({"success": True, "product": np_})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_product(product_id):
    try:
        db = load_db(); ud = get_user_data(db, session['user_id'])
        if request.method == 'GET':
            p = next((p for p in ud['products'] if p['id'] == product_id), None)
            return jsonify(p) if p else (jsonify({"error": "No encontrado"}), 404)
        elif request.method == 'PUT':
            payload = request.get_json()
            for i, p in enumerate(ud['products']):
                if p['id'] == product_id:
                    ud['products'][i].update(payload); save_db(db)
                    return jsonify({"success": True, "product": ud['products'][i]})
            return jsonify({"error": "No encontrado"}), 404
        elif request.method == 'DELETE':
            ud['products'] = [p for p in ud['products'] if p['id'] != product_id]
            save_db(db); return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/products/import', methods=['POST'])
@login_required
def api_import_products():
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No se proporciono archivo"}), 400
        file = request.files['file']
        if not file.filename.lower().endswith('.csv'):
            return jsonify({"success": False, "error": "Solo archivos CSV"}), 400
        db = load_db(); ud = get_user_data(db, session['user_id'])
        content = file.stream.read()
        try:    text = content.decode('utf-8-sig')
        except: text = content.decode('latin-1', errors='replace')
        stream = io.StringIO(text, newline=None); reader = csv.reader(stream); next(reader, None)
        new_products = []
        for row in reader:
            if not row or len(row) < 2 or not row[0].strip(): continue
            sku = row[0].strip()
            if any(p.get('sku','').strip() == sku for p in ud['products'] + new_products): continue
            try:    precio = float(str(row[2]).strip().replace('.','').replace(',','.')) if len(row)>2 and row[2].strip() else 0
            except: precio = 0
            try:    stock = int(row[3].strip()) if len(row)>3 and str(row[3]).strip().isdigit() else 0
            except: stock = 0
            try:    stock_min = int(row[4].strip()) if len(row)>4 and str(row[4]).strip().isdigit() else 0
            except: stock_min = 0
            new_products.append({
                'id': get_next_id(ud['products'] + new_products), 'sku': sku,
                'nombre':    row[1].strip() if len(row)>1 else '',
                'precio':    precio, 'stock': stock, 'stock_minimo': stock_min,
                'categoria': row[5].strip() if len(row)>5 else '',
                'proveedor': row[6].strip() if len(row)>6 else ''
            })
        ud['products'].extend(new_products); save_db(db)
        return jsonify({"success": True, "message": f"Se importaron {len(new_products)} productos exitosamente", "imported_count": len(new_products)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Documentos ────────────────────────────────────────────────────
@app.route('/api/documents', methods=['GET', 'POST'])
@login_required
def api_documents():
    try:
        db = load_db(); ud = get_user_data(db, session['user_id'])
        if request.method == 'GET':
            return jsonify(ud['documents'])
        payload = request.get_json()
        new_id  = get_next_id(ud['documents'])
        tipo    = payload.get('tipo', 'cotizacion')
        prefix  = {'cotizacion': 'COT', 'orden_compra': 'OC', 'factura': 'FAC'}.get(tipo, 'DOC')
        count   = len([d for d in ud['documents'] if d.get('tipo') == tipo]) + 1
        payload['id']     = new_id
        payload['number'] = f"{prefix}-{count:04d}"
        payload['date']   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload.setdefault('estado', 'pendiente')
        enviar_email = payload.pop('enviar_email', False)
        ud['documents'].append(payload)
        cliente = payload.get('cliente')
        if cliente and cliente.get('id'):
            cid = cliente['id']
            for i, c in enumerate(ud['clients']):
                if c['id'] == cid:
                    ud['clients'][i]['documentos'] = ud['clients'][i].get('documentos', 0) + 1
                    ud['clients'][i]['total']      = ud['clients'][i].get('total', 0) + payload.get('total', 0)
                    break
        save_db(db)
        email_sent = False
        if enviar_email:
            cliente_email = (cliente or {}).get('email', '')
            if cliente_email:
                subject  = f"{payload['number']} - {(cliente or {}).get('razon_social','')}"
                html_doc = generar_html_documento(payload)
                email_sent = send_email_smtp(cliente_email, subject, html_doc)
        return jsonify({"success": True, "document": payload, "email_sent": email_sent})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/documents/<int:doc_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_document(doc_id):
    try:
        db = load_db(); ud = get_user_data(db, session['user_id'])
        if request.method == 'GET':
            d = next((d for d in ud['documents'] if d['id'] == doc_id), None)
            return jsonify(d) if d else (jsonify({"error": "No encontrado"}), 404)
        elif request.method == 'PUT':
            payload = request.get_json()
            for i, d in enumerate(ud['documents']):
                if d['id'] == doc_id:
                    ud['documents'][i].update(payload); save_db(db)
                    return jsonify({"success": True, "document": ud['documents'][i]})
            return jsonify({"error": "No encontrado"}), 404
        elif request.method == 'DELETE':
            ud['documents'] = [d for d in ud['documents'] if d['id'] != doc_id]
            save_db(db); return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Stats ─────────────────────────────────────────────────────────
@app.route('/api/stats')
@login_required
def api_stats():
    try:
        db = load_db(); ud = get_user_data(db, session['user_id'])
        docs        = ud['documents']
        total_sales = sum(d.get('total', 0) for d in docs)
        recent_docs = sorted(docs, key=lambda x: x.get('date', ''), reverse=True)[:5]
        client_stats   = {}
        doc_type_stats = {'cotizacion': {'count':0,'total':0}, 'orden_compra': {'count':0,'total':0}, 'factura': {'count':0,'total':0}}
        for doc in docs:
            name = (doc.get('cliente') or {}).get('razon_social', 'Sin nombre')
            client_stats.setdefault(name, {'count':0,'total':0})
            client_stats[name]['count'] += 1; client_stats[name]['total'] += doc.get('total', 0)
            tipo = doc.get('tipo', 'cotizacion')
            if tipo in doc_type_stats:
                doc_type_stats[tipo]['count'] += 1; doc_type_stats[tipo]['total'] += doc.get('total', 0)
        return jsonify({
            "total_documents": len(docs),
            "total_clients":   len(ud['clients']),
            "total_products":  len(ud['products']),
            "total_sales":     total_sales,
            "recent_documents": recent_docs,
            "client_stats":    client_stats,
            "doc_type_stats":  doc_type_stats
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

init_db()

if __name__ == '__main__':
    app.run(debug=True)
