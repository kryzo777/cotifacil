import io
import csv
from flask import Response
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
from datetime import datetime
from functools import wraps

app = Flask(__name__)
app.secret_key = 'cotifacil_secret_key_2024'
app.config['SESSION_TYPE'] = 'filesystem'

# Archivo de base de datos simple
DB_FILE = 'data/database.json'

# Inicializar base de datos si no existe
def init_db():
    if not os.path.exists('data'):
        os.makedirs('data')

    if not os.path.exists(DB_FILE):
        data = {
            "users": [
                {"id": 1, "email": "admin@cotifacil.com", "password": "admin123", "name": "Admin"}
            ],
            "clients": [],
            "products": [
                {"id": 1, "sku": "PROD001", "nombre": "Producto Ejemplo", "precio": 100000, "stock": 50, "stock_minimo": 5}
            ],
            "documents": []
        }
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

# Cargar datos
def load_db():
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        init_db()
        return load_db()
    except Exception as e:
        print(f"Error loading database: {str(e)}")
        return {"users": [], "clients": [], "products": [], "documents": []}

# Guardar datos
def save_db(data):
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving database: {str(e)}")

# Obtener el próximo ID disponible para una lista
def get_next_id(items):
    if not items:
        return 1
    return max(item['id'] for item in items) + 1

# Decorador para requerir login
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Login requerido"}), 401
        return f(*args, **kwargs)
    return decorated_function

# Rutas de la aplicación
@app.route('/')
def index():
    if 'user_id' in session:
        return render_template('index.html')
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        try:
            data = request.get_json()
            email = data.get('email')
            password = data.get('password')

            db_data = load_db()
            for user in db_data['users']:
                if user['email'] == email and user['password'] == password:
                    session['user_id'] = user['id']
                    session['user_name'] = user['name']
                    session['user_email'] = user['email']
                    return jsonify({
                        "success": True,
                        "user": {
                            "name": user['name'],
                            "email": user['email']
                        }
                    })

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
        return jsonify({
            "id": session['user_id'],
            "name": session['user_name'],
            "email": session['user_email']
        })
    return jsonify({"error": "No autenticado"}), 401

# API Routes
@app.route('/api/clients', methods=['GET', 'POST'])
@login_required
def api_clients():
    try:
        data = load_db()

        if request.method == 'GET':
            return jsonify(data['clients'])

        elif request.method == 'POST':
            new_client = request.get_json()
            new_client['id'] = get_next_id(data['clients'])
            new_client['documentos'] = 0
            new_client['total'] = 0
            data['clients'].append(new_client)
            save_db(data)
            return jsonify({"success": True, "client": new_client})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/products', methods=['GET', 'POST'])
@login_required
def api_products():
    try:
        data = load_db()

        if request.method == 'GET':
            return jsonify(data['products'])

        elif request.method == 'POST':
            new_product = request.get_json()
            new_product['id'] = get_next_id(data['products'])
            data['products'].append(new_product)
            save_db(data)
            return jsonify({"success": True, "product": new_product})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_product(product_id):
    try:
        data = load_db()

        if request.method == 'GET':
            product = next((p for p in data['products'] if p['id'] == product_id), None)
            if product:
                return jsonify(product)
            return jsonify({"error": "Producto no encontrado"}), 404

        elif request.method == 'PUT':
            product_data = request.get_json()
            for i, product in enumerate(data['products']):
                if product['id'] == product_id:
                    # Actualizar producto
                    for key, value in product_data.items():
                        data['products'][i][key] = value
                    save_db(data)
                    return jsonify({"success": True, "product": data['products'][i]})
            return jsonify({"error": "Producto no encontrado"}), 404

        elif request.method == 'DELETE':
            data['products'] = [p for p in data['products'] if p['id'] != product_id]
            save_db(data)
            return jsonify({"success": True})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/documents', methods=['GET', 'POST'])
@login_required
def api_documents():
    try:
        data = load_db()

        if request.method == 'GET':
            return jsonify(data['documents'])

        elif request.method == 'POST':
            new_document = request.get_json()
            new_document['id'] = get_next_id(data['documents'])
            new_document['date'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            new_document['number'] = f"COT-{get_next_id(data['documents']):04d}"
            new_document['estado'] = 'pendiente'

            data['documents'].append(new_document)
            save_db(data)
            return jsonify({"success": True, "document": new_document})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/stats')
@login_required
def api_stats():
    try:
        data = load_db()

        # Calcular total de ventas
        total_sales = sum(doc.get('total', 0) for doc in data['documents'])

        # Documentos recientes (últimos 5)
        recent_docs = sorted(data['documents'], key=lambda x: x.get('date', ''), reverse=True)[:5]

        # Calcular documentos por cliente
        client_stats = {}
        for doc in data['documents']:
            client_name = doc.get('cliente', {}).get('razon_social', 'Sin nombre')
            if client_name not in client_stats:
                client_stats[client_name] = {'count': 0, 'total': 0}
            client_stats[client_name]['count'] += 1
            client_stats[client_name]['total'] += doc.get('total', 0)

        stats = {
            "total_documents": len(data['documents']),
            "total_clients": len(data['clients']),
            "total_products": len(data['products']),
            "total_sales": total_sales,
            "recent_documents": recent_docs,
            "client_stats": client_stats
        }

        return jsonify(stats)
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/generate-pdf/<int:doc_id>')
@login_required
def api_generate_pdf(doc_id):
    try:
        data = load_db()
        document = next((doc for doc in data['documents'] if doc['id'] == doc_id), None)

        if not document:
            return jsonify({"success": False, "error": "Documento no encontrado"}), 404

        # Simular generación de PDF (en una implementación real, usaríamos una librería)
        return jsonify({
            "success": True,
            "message": "PDF generado exitosamente",
            "document": document
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/<int:client_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_client(client_id):
    try:
        data = load_db()

        if request.method == 'GET':
            client = next((c for c in data['clients'] if c['id'] == client_id), None)
            if client:
                return jsonify(client)
            return jsonify({"error": "Cliente no encontrado"}), 404

        elif request.method == 'PUT':
            client_data = request.get_json()
            for i, client in enumerate(data['clients']):
                if client['id'] == client_id:
                    # Actualizar cliente
                    for key, value in client_data.items():
                        data['clients'][i][key] = value
                    save_db(data)
                    return jsonify({"success": True, "client": data['clients'][i]})
            return jsonify({"error": "Cliente no encontrado"}), 404

        elif request.method == 'DELETE':
            data['clients'] = [c for c in data['clients'] if c['id'] != client_id]
            save_db(data)
            return jsonify({"success": True})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/export', methods=['GET'])
@login_required
def api_export_clients():
    try:
        data = load_db()

        # Crear un archivo CSV en memoria
        output = io.StringIO()
        writer = csv.writer(output)

        # Escribir encabezados
        writer.writerow(['RUT', 'Razón Social', 'Dirección', 'Región', 'Ciudad', 'Email', 'Teléfono', 'Nota', 'Documentos', 'Total'])

        # Escribir datos
        for client in data['clients']:
            writer.writerow([
                client.get('rut', ''),
                client.get('razon_social', ''),
                client.get('direccion', ''),
                client.get('region', ''),
                client.get('ciudad', ''),
                client.get('email', ''),
                client.get('telefono', ''),
                client.get('nota', ''),
                client.get('documentos', 0),
                client.get('total', 0)
            ])

        # Preparar respuesta
        output.seek(0)
        response = Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=clientes_cotifacil.csv"}
        )

        return response
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/clients/import', methods=['POST'])
@login_required
def api_import_clients():
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No se proporcionó archivo"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "Nombre de archivo vacío"}), 400

        # Verificar extensión
        if not file.filename.endswith('.csv'):
            return jsonify({"success": False, "error": "Formato de archivo no válido. Use CSV."}), 400

        data = load_db()
        existing_clients = data['clients']
        new_clients = []

        # Procesar CSV
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.reader(stream)

        # Saltar encabezados
        next(csv_reader, None)

        for row in csv_reader:
            if len(row) >= 8:  # Mínimo de campos requeridos
                # Verificar si el cliente ya existe por RUT
                rut = row[0].replace('.', '').replace('-', '') if row[0] else None
                exists = any(c.get('rut') == rut for c in existing_clients)

                if not exists and rut:
                    new_client = {
                        'id': get_next_id(data['clients'] + new_clients),
                        'rut': rut,
                        'razon_social': row[1],
                        'direccion': row[2],
                        'region': row[3],
                        'ciudad': row[4],
                        'email': row[5],
                        'telefono': row[6],
                        'nota': row[7] if len(row) > 7 else '',
                        'documentos': int(row[8]) if len(row) > 8 and row[8].isdigit() else 0,
                        'total': int(row[9]) if len(row) > 9 and row[9].isdigit() else 0
                    }
                    new_clients.append(new_client)

        # Agregar nuevos clientes a la base de datos
        data['clients'].extend(new_clients)
        save_db(data)

        return jsonify({
            "success": True,
            "message": f"Se importaron {len(new_clients)} clientes correctamente",
            "imported_count": len(new_clients)
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True)