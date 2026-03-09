import io
import csv
from flask import Response, Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
from datetime import datetime
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'cotifacil_secret_key_2024')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

DB_FILE = 'data/database.json'

def init_db():
    if not os.path.exists('data'):
        os.makedirs('data')
    if not os.path.exists(DB_FILE):
        data = {
            "users": [{"id": 1, "email": "admin@cotifacil.com", "password": "admin123", "name": "Administrador", "role": "admin"}],
            "clients": [], "products": [], "documents": []
        }
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

def load_db():
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        init_db()
        return load_db()

def save_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def get_next_id(items):
    return max((item['id'] for item in items), default=0) + 1

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Login requerido"}), 401
        return f(*args, **kwargs)
    return decorated

# ── Rutas principales ─────────────────────────────────
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
            data = request.get_json()
            email = data.get('email', '').strip().lower()
            password = data.get('password', '')
            db = load_db()
            for user in db['users']:
                if user['email'].lower() == email and user['password'] == password:
                    session['user_id'] = user['id']
                    session['user_name'] = user['name']
                    session['user_email'] = user['email']
                    return jsonify({"success": True, "user": {"name": user['name'], "email": user['email']}})
            return jsonify({"success": False, "message": "Credenciales incorrectas"}), 401
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500
    return render_template('login.html')

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
        data_in = request.get_json()
        db = load_db()
        uid = session['user_id']
        for i, user in enumerate(db['users']):
            if user['id'] == uid:
                if data_in.get('name'):
                    db['users'][i]['name'] = data_in['name']
                if data_in.get('email'):
                    db['users'][i]['email'] = data_in['email']
                if data_in.get('password_nueva'):
                    if user['password'] != data_in.get('password_actual', ''):
                        return jsonify({"success": False, "error": "Contraseña actual incorrecta"}), 400
                    db['users'][i]['password'] = data_in['password_nueva']
                save_db(db)
                session['user_name'] = db['users'][i]['name']
                session['user_email'] = db['users'][i]['email']
                return jsonify({"success": True})
        return jsonify({"success": False, "error": "Usuario no encontrado"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Clientes ──────────────────────────────────────────
@app.route('/api/clients', methods=['GET', 'POST'])
@login_required
def api_clients():
    try:
        db = load_db()
        if request.method == 'GET':
            return jsonify(db['clients'])
        new_client = request.get_json()
        new_client['id'] = get_next_id(db['clients'])
        new_client.setdefault('documentos', 0)
        new_client.setdefault('total', 0)
        db['clients'].append(new_client)
        save_db(db)
        return jsonify({"success": True, "client": new_client})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/<int:client_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_client(client_id):
    try:
        db = load_db()
        if request.method == 'GET':
            c = next((c for c in db['clients'] if c['id'] == client_id), None)
            return jsonify(c) if c else (jsonify({"error": "No encontrado"}), 404)
        elif request.method == 'PUT':
            payload = request.get_json()
            for i, c in enumerate(db['clients']):
                if c['id'] == client_id:
                    db['clients'][i].update(payload)
                    save_db(db)
                    return jsonify({"success": True, "client": db['clients'][i]})
            return jsonify({"error": "No encontrado"}), 404
        elif request.method == 'DELETE':
            db['clients'] = [c for c in db['clients'] if c['id'] != client_id]
            save_db(db)
            return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/export')
@login_required
def api_export_clients():
    try:
        db = load_db()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['RUT','Razón Social','Dirección','Región','Ciudad','Email','Teléfono','Nota','Documentos','Total'])
        for c in db['clients']:
            writer.writerow([c.get('rut',''), c.get('razon_social',''), c.get('direccion',''),
                c.get('region',''), c.get('ciudad',''), c.get('email',''),
                c.get('telefono',''), c.get('nota',''), c.get('documentos',0), c.get('total',0)])
        output.seek(0)
        return Response(output.getvalue(), mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=clientes_cotifacil.csv"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/import', methods=['POST'])
@login_required
def api_import_clients():
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No se proporcionó archivo"}), 400
        file = request.files['file']
        if not file.filename.endswith('.csv'):
            return jsonify({"success": False, "error": "Solo archivos CSV"}), 400
        db = load_db()
        new_clients = []
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        reader = csv.reader(stream)
        next(reader, None)  # skip header
        for row in reader:
            if len(row) < 2 or not row[0]:
                continue
            rut = row[0].strip()
            if any(c.get('rut') == rut for c in db['clients'] + new_clients):
                continue
            new_clients.append({
                'id': get_next_id(db['clients'] + new_clients),
                'rut': rut,
                'razon_social': row[1] if len(row) > 1 else '',
                'direccion':    row[2] if len(row) > 2 else '',
                'region':       row[3] if len(row) > 3 else '',
                'ciudad':       row[4] if len(row) > 4 else '',
                'email':        row[5] if len(row) > 5 else '',
                'telefono':     row[6] if len(row) > 6 else '',
                'nota':         row[7] if len(row) > 7 else '',
                'documentos': 0, 'total': 0
            })
        db['clients'].extend(new_clients)
        save_db(db)
        return jsonify({"success": True, "message": f"Se importaron {len(new_clients)} clientes", "imported_count": len(new_clients)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Productos ─────────────────────────────────────────
@app.route('/api/products', methods=['GET', 'POST'])
@login_required
def api_products():
    try:
        db = load_db()
        if request.method == 'GET':
            return jsonify(db['products'])
        new_product = request.get_json()
        new_product['id'] = get_next_id(db['products'])
        db['products'].append(new_product)
        save_db(db)
        return jsonify({"success": True, "product": new_product})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_product(product_id):
    try:
        db = load_db()
        if request.method == 'GET':
            p = next((p for p in db['products'] if p['id'] == product_id), None)
            return jsonify(p) if p else (jsonify({"error": "No encontrado"}), 404)
        elif request.method == 'PUT':
            payload = request.get_json()
            for i, p in enumerate(db['products']):
                if p['id'] == product_id:
                    db['products'][i].update(payload)
                    save_db(db)
                    return jsonify({"success": True, "product": db['products'][i]})
            return jsonify({"error": "No encontrado"}), 404
        elif request.method == 'DELETE':
            db['products'] = [p for p in db['products'] if p['id'] != product_id]
            save_db(db)
            return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/products/import', methods=['POST'])
@login_required
def api_import_products():
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No se proporcionó archivo"}), 400
        file = request.files['file']
        if not file.filename.endswith('.csv'):
            return jsonify({"success": False, "error": "Solo archivos CSV"}), 400
        db = load_db()
        new_products = []
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        reader = csv.reader(stream)
        next(reader, None)
        for row in reader:
            if len(row) < 2 or not row[0]:
                continue
            sku = row[0].strip()
            if any(p.get('sku') == sku for p in db['products'] + new_products):
                continue
            new_products.append({
                'id': get_next_id(db['products'] + new_products),
                'sku': sku,
                'nombre':       row[1] if len(row) > 1 else '',
                'precio':       float(row[2]) if len(row) > 2 and row[2].replace('.','').replace(',','').isdigit() else 0,
                'stock':        int(row[3]) if len(row) > 3 and row[3].isdigit() else 0,
                'stock_minimo': int(row[4]) if len(row) > 4 and row[4].isdigit() else 0,
                'categoria':    row[5] if len(row) > 5 else '',
                'proveedor':    row[6] if len(row) > 6 else '',
            })
        db['products'].extend(new_products)
        save_db(db)
        return jsonify({"success": True, "message": f"Se importaron {len(new_products)} productos", "imported_count": len(new_products)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Documentos ────────────────────────────────────────
@app.route('/api/documents', methods=['GET', 'POST'])
@login_required
def api_documents():
    try:
        db = load_db()
        if request.method == 'GET':
            return jsonify(db['documents'])
        payload = request.get_json()
        new_id = get_next_id(db['documents'])
        tipo = payload.get('tipo', 'cotizacion')
        prefijos = {'cotizacion': 'COT', 'orden_compra': 'OC', 'factura': 'FAC'}
        prefix = prefijos.get(tipo, 'DOC')
        # Contar documentos del mismo tipo para numeración
        count = len([d for d in db['documents'] if d.get('tipo') == tipo]) + 1
        payload['id'] = new_id
        payload['number'] = f"{prefix}-{count:04d}"
        payload['date'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload.setdefault('estado', 'pendiente')
        db['documents'].append(payload)
        # Actualizar estadísticas del cliente
        if payload.get('cliente') and payload['cliente'].get('id'):
            cid = payload['cliente']['id']
            for i, c in enumerate(db['clients']):
                if c['id'] == cid:
                    db['clients'][i]['documentos'] = db['clients'][i].get('documentos', 0) + 1
                    db['clients'][i]['total'] = db['clients'][i].get('total', 0) + payload.get('total', 0)
                    break
        save_db(db)
        return jsonify({"success": True, "document": payload})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/documents/<int:doc_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_document(doc_id):
    try:
        db = load_db()
        if request.method == 'GET':
            d = next((d for d in db['documents'] if d['id'] == doc_id), None)
            return jsonify(d) if d else (jsonify({"error": "No encontrado"}), 404)
        elif request.method == 'PUT':
            payload = request.get_json()
            for i, d in enumerate(db['documents']):
                if d['id'] == doc_id:
                    db['documents'][i].update(payload)
                    save_db(db)
                    return jsonify({"success": True, "document": db['documents'][i]})
            return jsonify({"error": "No encontrado"}), 404
        elif request.method == 'DELETE':
            db['documents'] = [d for d in db['documents'] if d['id'] != doc_id]
            save_db(db)
            return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Stats ─────────────────────────────────────────────
@app.route('/api/stats')
@login_required
def api_stats():
    try:
        db = load_db()
        total_sales = sum(d.get('total', 0) for d in db['documents'])
        recent_docs = sorted(db['documents'], key=lambda x: x.get('date', ''), reverse=True)[:5]
        client_stats = {}
        doc_type_stats = {'cotizacion': {'count': 0, 'total': 0}, 'orden_compra': {'count': 0, 'total': 0}, 'factura': {'count': 0, 'total': 0}}
        for doc in db['documents']:
            name = doc.get('cliente', {}).get('razon_social', 'Sin nombre')
            if name not in client_stats:
                client_stats[name] = {'count': 0, 'total': 0}
            client_stats[name]['count'] += 1
            client_stats[name]['total'] += doc.get('total', 0)
            tipo = doc.get('tipo', 'cotizacion')
            if tipo in doc_type_stats:
                doc_type_stats[tipo]['count'] += 1
                doc_type_stats[tipo]['total'] += doc.get('total', 0)
        return jsonify({
            "total_documents": len(db['documents']),
            "total_clients": len(db['clients']),
            "total_products": len(db['products']),
            "total_sales": total_sales,
            "recent_documents": recent_docs,
            "client_stats": client_stats,
            "doc_type_stats": doc_type_stats
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/generate-pdf/<int:doc_id>')
@login_required
def api_generate_pdf(doc_id):
    try:
        db = load_db()
        doc = next((d for d in db['documents'] if d['id'] == doc_id), None)
        if not doc:
            return jsonify({"success": False, "error": "Documento no encontrado"}), 404
        return jsonify({"success": True, "message": "PDF generado", "document": doc})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
