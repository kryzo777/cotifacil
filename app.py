import io, csv, smtplib, hashlib, secrets, os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Response, Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime
from functools import wraps

# ── PostgreSQL o JSON fallback ────────────────────────────────────
DATABASE_URL = os.environ.get('DATABASE_URL', '')

if DATABASE_URL:
    import psycopg2
    import psycopg2.extras
    from psycopg2.pool import SimpleConnectionPool
    _pool = None

    def get_pool():
        global _pool
        if _pool is None:
            url = DATABASE_URL
            if url.startswith('postgres://'):
                url = url.replace('postgres://', 'postgresql://', 1)
            _pool = SimpleConnectionPool(1, 5, url)
        return _pool

    def get_conn():
        return get_pool().getconn()

    def put_conn(conn):
        get_pool().putconn(conn)

    def init_db():
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS user_data (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    data_type TEXT NOT NULL,
                    data JSONB NOT NULL DEFAULT '[]',
                    UNIQUE(user_id, data_type)
                );
                CREATE TABLE IF NOT EXISTS user_config (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    config JSONB NOT NULL DEFAULT '{}'
                );
            ''')
            # Admin por defecto
            cur.execute(
                "INSERT INTO users (email, password, name, role) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING",
                ('admin@cotifacil.com', 'admin123', 'Administrador', 'admin')
            )
            conn.commit()
        finally:
            cur.close(); put_conn(conn)

    def load_user_list():
        conn = get_conn()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT id, email, password, name, role FROM users ORDER BY id")
            return [dict(r) for r in cur.fetchall()]
        finally:
            cur.close(); put_conn(conn)

    def find_user_by_email(email):
        conn = get_conn()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT * FROM users WHERE LOWER(email)=%s", (email.lower(),))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            cur.close(); put_conn(conn)

    def find_user_by_id(uid):
        conn = get_conn()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT * FROM users WHERE id=%s", (uid,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            cur.close(); put_conn(conn)

    def create_user(email, password, name, role='user', verified=True):
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT TRUE")
            cur.execute(
                "INSERT INTO users (email, password, name, role, verified) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (email.lower(), password, name, role, verified)
            )
            uid = cur.fetchone()[0]
            conn.commit()
            return uid
        finally:
            cur.close(); put_conn(conn)

    def mark_user_verified(uid):
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute("UPDATE users SET verified=TRUE WHERE id=%s", (uid,))
            conn.commit()
        finally:
            cur.close(); put_conn(conn)

    def update_user(uid, fields):
        conn = get_conn()
        try:
            cur = conn.cursor()
            sets = ', '.join(f"{k}=%s" for k in fields)
            cur.execute(f"UPDATE users SET {sets} WHERE id=%s", list(fields.values()) + [uid])
            conn.commit()
        finally:
            cur.close(); put_conn(conn)

    def get_user_items(uid, data_type):
        conn = get_conn()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                "SELECT data FROM user_data WHERE user_id=%s AND data_type=%s",
                (uid, data_type)
            )
            row = cur.fetchone()
            return row['data'] if row else []
        finally:
            cur.close(); put_conn(conn)

    def save_user_items(uid, data_type, items):
        import json as _json
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO user_data (user_id, data_type, data)
                   VALUES (%s, %s, %s::jsonb)
                   ON CONFLICT (user_id, data_type) DO UPDATE SET data=EXCLUDED.data""",
                (uid, data_type, _json.dumps(items, ensure_ascii=False))
            )
            conn.commit()
        finally:
            cur.close(); put_conn(conn)

    def get_user_config(uid):
        conn = get_conn()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT config FROM user_config WHERE user_id=%s", (uid,))
            row = cur.fetchone()
            return row['config'] if row else {}
        finally:
            cur.close(); put_conn(conn)

    def save_user_config(uid, config):
        import json as _json
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO user_config (user_id, config) VALUES (%s, %s::jsonb)
                   ON CONFLICT (user_id) DO UPDATE SET config=EXCLUDED.config""",
                (uid, _json.dumps(config, ensure_ascii=False))
            )
            conn.commit()
        finally:
            cur.close(); put_conn(conn)

else:
    # ── Fallback JSON (desarrollo local) ─────────────────────────
    import json as _json

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    DB_FILE  = os.path.join(DATA_DIR, 'database.json')

    def _load():
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                return _json.load(f)
        except:
            return {"users": [], "user_data": {}, "user_config": {}}

    def _save(db):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            _json.dump(db, f, indent=2, ensure_ascii=False)

    def init_db():
        os.makedirs(DATA_DIR, exist_ok=True)
        if not os.path.exists(DB_FILE):
            _save({"users": [{"id":1,"email":"admin@cotifacil.com","password":"admin123","name":"Administrador","role":"admin"}], "user_data": {"1":{"clients":[],"products":[],"documents":[]}}, "user_config": {}})
        else:
            db = _load()
            # migrar formato viejo
            changed = False
            if 'clients' in db or 'products' in db or 'documents' in db:
                if 'user_data' not in db: db['user_data'] = {}
                for u in db.get('users',[]):
                    uid = str(u['id'])
                    if uid not in db['user_data']:
                        db['user_data'][uid] = {'clients': db.get('clients',[]), 'products': db.get('products',[]), 'documents': db.get('documents',[])}
                for k in ('clients','products','documents'): db.pop(k, None)
                changed = True
            if changed: _save(db)

    def load_user_list():
        return _load().get('users', [])

    def find_user_by_email(email):
        return next((u for u in _load().get('users',[]) if u['email'].lower()==email.lower()), None)

    def find_user_by_id(uid):
        return next((u for u in _load().get('users',[]) if u['id']==uid), None)

    def create_user(email, password, name, role='user', verified=True):
        db = _load()
        uid = max((u['id'] for u in db['users']), default=0) + 1
        db['users'].append({"id":uid,"email":email.lower(),"password":password,"name":name,"role":role,"verified":verified})
        if 'user_data' not in db: db['user_data'] = {}
        db['user_data'][str(uid)] = {"clients":[],"products":[],"documents":[]}
        _save(db)
        return uid

    def mark_user_verified(uid):
        db = _load()
        for i, u in enumerate(db['users']):
            if u['id'] == uid:
                db['users'][i]['verified'] = True; break
        _save(db)

    def update_user(uid, fields):
        db = _load()
        for i, u in enumerate(db['users']):
            if u['id'] == uid:
                db['users'][i].update(fields); break
        _save(db)

    def get_user_items(uid, data_type):
        db = _load()
        ud = db.get('user_data', {}).get(str(uid), {})
        return ud.get(data_type, [])

    def save_user_items(uid, data_type, items):
        db = _load()
        if 'user_data' not in db: db['user_data'] = {}
        if str(uid) not in db['user_data']: db['user_data'][str(uid)] = {}
        db['user_data'][str(uid)][data_type] = items
        _save(db)

    def get_user_config(uid):
        return _load().get('user_config', {}).get(str(uid), {})

    def save_user_config(uid, config):
        db = _load()
        if 'user_config' not in db: db['user_config'] = {}
        db['user_config'][str(uid)] = config
        _save(db)

# ── Flask app ─────────────────────────────────────────────────────
app = Flask(__name__)

# ── Tokens de verificación de email (persistidos en DB) ──────────
import time as _time

def _init_tokens_table():
    """Crea tabla de tokens si no existe (solo PostgreSQL)."""
    if not DATABASE_URL:
        return
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS verification_tokens (
                token TEXT PRIMARY KEY,
                uid   INTEGER,
                email TEXT,
                name  TEXT,
                expires DOUBLE PRECISION
            )
        ''')
        conn.commit()
        cur.close(); put_conn(conn)
    except: pass

def crear_token_verificacion(uid, email, name):
    token   = secrets.token_urlsafe(32)
    expires = _time.time() + 3600
    if DATABASE_URL:
        try:
            conn = get_conn()
            cur  = conn.cursor()
            cur.execute(
                "INSERT INTO verification_tokens (token,uid,email,name,expires) VALUES (%s,%s,%s,%s,%s)",
                (token, uid, email, name, expires)
            )
            conn.commit(); cur.close(); put_conn(conn)
        except Exception as e:
            print(f'[Token] Error guardando token: {e}')
    else:
        # Fallback JSON: guardar en DB
        import json as _j
        db = _load()
        if 'tokens' not in db: db['tokens'] = {}
        db['tokens'][token] = {'uid':uid,'email':email,'name':name,'expires':expires}
        _save(db)
    return token

def consumir_token(token):
    if DATABASE_URL:
        try:
            conn = get_conn()
            cur  = conn.cursor()
            cur.execute("SELECT uid,email,name,expires FROM verification_tokens WHERE token=%s", (token,))
            row = cur.fetchone()
            if not row:
                cur.close(); put_conn(conn)
                return None, 'Enlace inválido o ya utilizado.'
            uid, email, name, expires = row
            cur.execute("DELETE FROM verification_tokens WHERE token=%s", (token,))
            conn.commit(); cur.close(); put_conn(conn)
            if _time.time() > expires:
                return None, 'El enlace expiró (1 hora). Regístrate nuevamente.'
            return {'uid':uid,'email':email,'name':name}, None
        except Exception as e:
            return None, f'Error interno: {e}'
    else:
        db = _load()
        tokens = db.get('tokens', {})
        data   = tokens.get(token)
        if not data:
            return None, 'Enlace inválido o ya utilizado.'
        if _time.time() > data['expires']:
            tokens.pop(token, None); db['tokens'] = tokens; _save(db)
            return None, 'El enlace expiró (1 hora). Regístrate nuevamente.'
        tokens.pop(token, None); db['tokens'] = tokens; _save(db)
        return data, None

def html_email_verificacion(nombre, link):
    return f'''<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0d1117;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:2rem;text-align:center;">
        <h1 style="margin:0;font-size:1.5rem;color:white;">CotiFácil</h1>
        <p style="margin:.5rem 0 0;color:rgba(255,255,255,.8);font-size:.9rem;">Confirma tu cuenta</p>
      </div>
      <div style="padding:2rem;">
        <p style="font-size:1rem;margin-bottom:1rem;">Hola <strong>{nombre}</strong>,</p>
        <p style="color:#94a3b8;margin-bottom:2rem;line-height:1.6;">
          Gracias por registrarte en CotiFácil. Haz clic en el botón para confirmar tu dirección de correo y activar tu cuenta.
        </p>
        <div style="text-align:center;margin-bottom:2rem;">
          <a href="{link}" style="display:inline-block;padding:.85rem 2rem;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:white;text-decoration:none;border-radius:10px;font-weight:600;">
            ✅ Confirmar mi cuenta
          </a>
        </div>
        <p style="font-size:.8rem;color:#475569;text-align:center;">Este enlace expira en 1 hora.</p>
      </div>
    </div>'''

app.secret_key = os.environ.get('SECRET_KEY', 'cotifacil_secret_key_2024')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# ── Helpers contraseña ────────────────────────────────────────────
def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password, stored):
    if ':' not in stored:
        return password == stored   # legacy
    salt, hashed = stored.split(':', 1)
    return hashlib.sha256((salt + password).encode()).hexdigest() == hashed

def get_next_id(items):
    return max((item['id'] for item in items), default=0) + 1

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Login requerido"}), 401
        return f(*args, **kwargs)
    return decorated

# ── Estados válidos por tipo de documento ─────────────────────────
ESTADOS_VALIDOS = {
    'cotizacion':   ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'],
    'factura':      ['pendiente', 'enviada', 'pagada', 'anulada'],
    'orden_compra': ['borrador', 'enviada', 'recibida', 'cancelada'],
}
ESTADO_INICIAL = {
    'cotizacion':   'borrador',
    'factura':      'pendiente',
    'orden_compra': 'borrador',
}

# ── Email ─────────────────────────────────────────────────────────
def send_email_smtp(to_email, subject, html_body):
    smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))
    smtp_user = os.environ.get('SMTP_USER', '')
    smtp_pass = os.environ.get('SMTP_PASS', '').replace(' ', '')  # Gmail app passwords tienen espacios
    smtp_user = smtp_user.strip()
    if not smtp_user or not smtp_pass:
        print('[Email] Faltan SMTP_USER o SMTP_PASS')
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = f'CotiFácil <{smtp_user}>'
        msg['To']      = to_email
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
        print(f'[Email] Enviado OK → {to_email}')
        return True
    except Exception as e:
        print(f'[Email error] {type(e).__name__}: {e}')
        return False

def generar_html_documento(doc):
    tipo_labels = {'cotizacion':'COTIZACIÓN','orden_compra':'ORDEN DE COMPRA','factura':'FACTURA'}
    lineas   = doc.get('items', [])
    subtotal = doc.get('subtotal',0); iva = doc.get('iva',0); total = doc.get('total',0)
    cliente  = doc.get('cliente',{}) or {}
    proveedor= doc.get('proveedor',{}) or {}
    destinatario = proveedor if doc.get('tipo')=='orden_compra' else cliente
    dest_label   = 'PROVEEDOR' if doc.get('tipo')=='orden_compra' else 'CLIENTE'
    rows = ''.join(
        f'<tr><td style="padding:.5rem;border-bottom:1px solid #eee;">{l.get("descripcion","")}</td>'
        f'<td style="padding:.5rem;border-bottom:1px solid #eee;text-align:center;">{l.get("cantidad",1)}</td>'
        f'<td style="padding:.5rem;border-bottom:1px solid #eee;text-align:right;">${l.get("precio_unit",0):,.0f}</td>'
        f'<td style="padding:.5rem;border-bottom:1px solid #eee;text-align:right;">${l.get("subtotal",0):,.0f}</td></tr>'
        for l in lineas
    )
    nombre_dest = destinatario.get('razon_social') or destinatario.get('nombre','—')
    return (
        f'<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:2rem;">'
        f'<div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #111;">'
        f'<div><h2 style="margin:0;">{tipo_labels.get(doc.get("tipo",""),"DOCUMENTO")}</h2>'
        f'<p style="margin:.25rem 0;font-weight:700;">N° {doc.get("number","—")}</p></div>'
        f'<div style="text-align:right;font-size:.85rem;">Fecha: {(doc.get("date") or "—")[:10]}</div></div>'
        f'<div style="background:#f9fafb;padding:.75rem;border-radius:6px;margin-bottom:1rem;">'
        f'<strong>{dest_label}:</strong> {nombre_dest}'
        f'{(" · RUT: "+destinatario.get("rut","")) if destinatario.get("rut") else ""}</div>'
        f'<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f3f4f6;">'
        f'<th style="padding:.5rem;text-align:left;">Descripción</th>'
        f'<th style="padding:.5rem;text-align:center;">Cant.</th>'
        f'<th style="padding:.5rem;text-align:right;">P.Unit.</th>'
        f'<th style="padding:.5rem;text-align:right;">Total</th></tr></thead>'
        f'<tbody>{rows}</tbody></table>'
        f'<div style="text-align:right;margin-top:1rem;">'
        f'<p>Subtotal: <strong>${subtotal:,.0f}</strong></p>'
        f'<p>IVA 19%: <strong>${iva:,.0f}</strong></p>'
        f'<p style="font-size:1.1rem;font-weight:700;">Total: ${total:,.0f}</p>'
        f'</div></div>'
    )

# ── Auth ──────────────────────────────────────────────────────────
@app.route('/')
def index():
    if 'user_id' in session: return render_template('index.html')
    return redirect(url_for('login'))

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method=='GET' and 'user_id' in session: return redirect(url_for('index'))
    if request.method=='POST':
        try:
            data = request.get_json()
            email = data.get('email','').strip().lower()
            password = data.get('password','')
            user = find_user_by_email(email)
            if user and verify_password(password, user['password']):
                session['user_id']    = user['id']
                session['user_name']  = user['name']
                session['user_email'] = user['email']
                return jsonify({"success":True,"user":{"name":user['name'],"email":user['email']}})
            return jsonify({"success":False,"message":"Credenciales incorrectas"}), 401
        except Exception as e:
            return jsonify({"success":False,"message":str(e)}), 500
    return render_template('login.html')

@app.route('/register', methods=['GET','POST'])
def register():
    if request.method=='GET':
        if 'user_id' in session: return redirect(url_for('index'))
        return render_template('register.html')
    try:
        data  = request.get_json()
        name  = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        pwd   = data.get('password','')
        pwd2  = data.get('password2','')
        if not name or not email or not pwd:
            return jsonify({"success":False,"message":"Todos los campos son obligatorios"}), 400
        if len(pwd) < 6:
            return jsonify({"success":False,"message":"La contraseña debe tener al menos 6 caracteres"}), 400
        if pwd != pwd2:
            return jsonify({"success":False,"message":"Las contraseñas no coinciden"}), 400
        if find_user_by_email(email):
            return jsonify({"success":False,"message":"Este correo ya está registrado"}), 400

        # Crear usuario como no verificado
        uid   = create_user(email, hash_password(pwd), name, verified=False)
        token = crear_token_verificacion(uid, email, name)
        link  = f"{request.host_url.rstrip('/')}/verify-email/{token}"
        html  = html_email_verificacion(name, link)
        email_ok = send_email_smtp(email, 'Confirma tu cuenta en CotiFácil ✅', html)

        if email_ok:
            return jsonify({"success":True, "pending_verification":True,
                "message":f"Te enviamos un correo de confirmación a {email}. Revisa tu bandeja de entrada (y la carpeta de spam)."})
        else:
            # Si SMTP falla, activar cuenta directamente para no bloquear al usuario
            mark_user_verified(uid)
            session['user_id']    = uid
            session['user_name']  = name
            session['user_email'] = email
            return jsonify({"success":True,"user":{"name":name,"email":email}})
    except Exception as e:
        return jsonify({"success":False,"message":str(e)}), 500

@app.route('/verify-email/<token>')
def verify_email(token):
    data, error = consumir_token(token)
    if error:
        return render_template('verify_result.html', success=False, message=error)
    mark_user_verified(data['uid'])
    session['user_id']    = data['uid']
    session['user_name']  = data['name']
    session['user_email'] = data['email']
    return render_template('verify_result.html', success=True,
        message=f"¡Bienvenido, {data['name']}! Tu cuenta está activa.")

@app.route('/api/email/test', methods=['POST'])
@login_required
def api_test_email():
    uid  = session['user_id']
    user = find_user_by_id(uid)
    if not user: return jsonify({"success":False}), 400
    html = f'''<div style="font-family:Arial;padding:2rem;background:#0d1117;color:#e2e8f0;border-radius:12px;">
      <h2 style="color:#3b82f6;">✅ Prueba de email exitosa</h2>
      <p>Hola <strong>{user["name"]}</strong>, el SMTP de CotiFácil está funcionando correctamente.</p>
      <p style="color:#64748b;font-size:.85rem;margin-top:1rem;">Este es un mensaje de prueba generado desde la configuración.</p>
    </div>'''
    ok = send_email_smtp(user['email'], 'CotiFácil — Prueba de email ✓', html)
    return jsonify({"success": ok, "to": user['email'],
        "message": f"Email enviado a {user['email']}" if ok else "Error al enviar. Revisa los logs de Render → Logs."})

@app.route('/logout')
def logout():
    session.clear(); return jsonify({"success":True})

@app.route('/api/user')
def api_user():
    if 'user_id' in session:
        return jsonify({"id":session['user_id'],"name":session['user_name'],"email":session['user_email']})
    return jsonify({"error":"No autenticado"}), 401

@app.route('/api/user/update', methods=['PUT'])
@login_required
def api_user_update():
    try:
        data_in = request.get_json(); uid = session['user_id']
        user = find_user_by_id(uid)
        if not user: return jsonify({"success":False,"error":"Usuario no encontrado"}), 404
        fields = {}
        if data_in.get('name'):  fields['name']  = data_in['name']
        if data_in.get('email'): fields['email'] = data_in['email']
        if data_in.get('password_nueva'):
            if not verify_password(data_in.get('password_actual',''), user['password']):
                return jsonify({"success":False,"error":"Contraseña actual incorrecta"}), 400
            fields['password'] = hash_password(data_in['password_nueva'])
        if fields:
            update_user(uid, fields)
            if 'name'  in fields: session['user_name']  = fields['name']
            if 'email' in fields: session['user_email'] = fields['email']
        return jsonify({"success":True})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

# ── Config de usuario ─────────────────────────────────────────────
@app.route('/api/user/config', methods=['GET','PUT'])
@login_required
def api_user_config():
    uid = session['user_id']
    if request.method == 'GET':
        return jsonify(get_user_config(uid))
    try:
        config = request.get_json()
        save_user_config(uid, config)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ── Clientes ──────────────────────────────────────────────────────
@app.route('/api/clients', methods=['GET','POST'])
@login_required
def api_clients():
    try:
        uid = session['user_id']
        if request.method=='GET':
            return jsonify(get_user_items(uid, 'clients'))
        clients = get_user_items(uid, 'clients')
        nc = request.get_json()
        nc['id'] = get_next_id(clients)
        nc.setdefault('documentos',0); nc.setdefault('total',0)
        clients.append(nc); save_user_items(uid, 'clients', clients)
        return jsonify({"success":True,"client":nc})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/clients/<int:client_id>', methods=['GET','PUT','DELETE'])
@login_required
def api_client(client_id):
    try:
        uid = session['user_id']
        clients = get_user_items(uid, 'clients')
        if request.method=='GET':
            c = next((c for c in clients if c['id']==client_id), None)
            return jsonify(c) if c else (jsonify({"error":"No encontrado"}),404)
        elif request.method=='PUT':
            payload = request.get_json()
            for i,c in enumerate(clients):
                if c['id']==client_id:
                    clients[i].update(payload); save_user_items(uid,'clients',clients)
                    return jsonify({"success":True,"client":clients[i]})
            return jsonify({"error":"No encontrado"}),404
        elif request.method=='DELETE':
            clients = [c for c in clients if c['id']!=client_id]
            save_user_items(uid,'clients',clients); return jsonify({"success":True})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/clients/export')
@login_required
def api_export_clients():
    try:
        uid = session['user_id']; clients = get_user_items(uid, 'clients')
        output = io.StringIO(); writer = csv.writer(output)
        writer.writerow(['RUT','Razón Social','Dirección','Región','Ciudad','Email','Teléfono','Nota','Documentos','Total'])
        for c in clients:
            writer.writerow([c.get('rut',''),c.get('razon_social',''),c.get('direccion',''),c.get('region',''),
                             c.get('ciudad',''),c.get('email',''),c.get('telefono',''),c.get('nota',''),
                             c.get('documentos',0),c.get('total',0)])
        output.seek(0)
        return Response(output.getvalue(), mimetype="text/csv",
                        headers={"Content-Disposition":"attachment; filename=clientes_cotifacil.csv"})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/clients/import', methods=['POST'])
@login_required
def api_import_clients():
    try:
        if 'file' not in request.files: return jsonify({"success":False,"error":"No se proporcionó archivo"}), 400
        file = request.files['file']
        if not file.filename.lower().endswith('.csv'): return jsonify({"success":False,"error":"Solo archivos CSV"}), 400
        uid = session['user_id']; clients = get_user_items(uid, 'clients')
        content = file.stream.read()
        try:    text = content.decode('utf-8-sig')
        except: text = content.decode('latin-1', errors='replace')
        stream = io.StringIO(text, newline=None); reader = csv.reader(stream); next(reader, None)
        new_clients = []
        for row in reader:
            if not row or len(row)<2 or not row[0].strip(): continue
            rut = row[0].strip()
            if any(c.get('rut','').strip()==rut for c in clients+new_clients): continue
            new_clients.append({'id':get_next_id(clients+new_clients),'rut':rut,
                'razon_social':row[1].strip() if len(row)>1 else '',
                'direccion':   row[2].strip() if len(row)>2 else '',
                'region':      row[3].strip() if len(row)>3 else '',
                'ciudad':      row[4].strip() if len(row)>4 else '',
                'email':       row[5].strip() if len(row)>5 else '',
                'telefono':    row[6].strip() if len(row)>6 else '',
                'nota':        row[7].strip() if len(row)>7 else '',
                'documentos':0,'total':0})
        clients.extend(new_clients); save_user_items(uid,'clients',clients)
        return jsonify({"success":True,"message":f"Se importaron {len(new_clients)} clientes","imported_count":len(new_clients)})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

# ── Proveedores ───────────────────────────────────────────────────
@app.route('/api/providers', methods=['GET','POST'])
@login_required
def api_providers():
    try:
        uid = session['user_id']
        if request.method=='GET':
            return jsonify(get_user_items(uid, 'providers'))
        providers = get_user_items(uid, 'providers')
        np = request.get_json()
        np['id'] = get_next_id(providers)
        np.setdefault('ordenes', 0); np.setdefault('total', 0)
        providers.append(np); save_user_items(uid, 'providers', providers)
        return jsonify({"success":True,"provider":np})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/providers/<int:provider_id>', methods=['GET','PUT','DELETE'])
@login_required
def api_provider(provider_id):
    try:
        uid = session['user_id']
        providers = get_user_items(uid, 'providers')
        if request.method=='GET':
            p = next((p for p in providers if p['id']==provider_id), None)
            return jsonify(p) if p else (jsonify({"error":"No encontrado"}),404)
        elif request.method=='PUT':
            payload = request.get_json()
            for i,p in enumerate(providers):
                if p['id']==provider_id:
                    providers[i].update(payload); save_user_items(uid,'providers',providers)
                    return jsonify({"success":True,"provider":providers[i]})
            return jsonify({"error":"No encontrado"}),404
        elif request.method=='DELETE':
            providers = [p for p in providers if p['id']!=provider_id]
            save_user_items(uid,'providers',providers); return jsonify({"success":True})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

# ── Productos ─────────────────────────────────────────────────────
@app.route('/api/products', methods=['GET','POST'])
@login_required
def api_products():
    try:
        uid = session['user_id']
        if request.method=='GET':
            return jsonify(get_user_items(uid, 'products'))
        products = get_user_items(uid, 'products')
        np = request.get_json(); np['id'] = get_next_id(products)
        products.append(np); save_user_items(uid,'products',products)
        return jsonify({"success":True,"product":np})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET','PUT','DELETE'])
@login_required
def api_product(product_id):
    try:
        uid = session['user_id']; products = get_user_items(uid,'products')
        if request.method=='GET':
            p = next((p for p in products if p['id']==product_id), None)
            return jsonify(p) if p else (jsonify({"error":"No encontrado"}),404)
        elif request.method=='PUT':
            payload = request.get_json()
            for i,p in enumerate(products):
                if p['id']==product_id:
                    products[i].update(payload); save_user_items(uid,'products',products)
                    return jsonify({"success":True,"product":products[i]})
            return jsonify({"error":"No encontrado"}),404
        elif request.method=='DELETE':
            products = [p for p in products if p['id']!=product_id]
            save_user_items(uid,'products',products); return jsonify({"success":True})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/products/import', methods=['POST'])
@login_required
def api_import_products():
    try:
        if 'file' not in request.files: return jsonify({"success":False,"error":"No se proporcionó archivo"}), 400
        file = request.files['file']
        if not file.filename.lower().endswith('.csv'): return jsonify({"success":False,"error":"Solo archivos CSV"}), 400
        uid = session['user_id']; products = get_user_items(uid,'products')
        content = file.stream.read()
        try:    text = content.decode('utf-8-sig')
        except: text = content.decode('latin-1', errors='replace')
        stream = io.StringIO(text, newline=None); reader = csv.reader(stream); next(reader, None)
        new_products = []
        for row in reader:
            if not row or len(row)<2 or not row[0].strip(): continue
            sku = row[0].strip()
            if any(p.get('sku','').strip()==sku for p in products+new_products): continue
            try:    precio = float(str(row[2]).strip().replace('.','').replace(',','.')) if len(row)>2 and row[2].strip() else 0
            except: precio = 0
            try:    stock = int(row[3].strip()) if len(row)>3 and str(row[3]).strip().isdigit() else 0
            except: stock = 0
            try:    stock_min = int(row[4].strip()) if len(row)>4 and str(row[4]).strip().isdigit() else 0
            except: stock_min = 0
            new_products.append({'id':get_next_id(products+new_products),'sku':sku,
                'nombre':    row[1].strip() if len(row)>1 else '',
                'precio':    precio,'stock':stock,'stock_minimo':stock_min,
                'categoria': row[5].strip() if len(row)>5 else '',
                'proveedor': row[6].strip() if len(row)>6 else ''})
        products.extend(new_products); save_user_items(uid,'products',products)
        return jsonify({"success":True,"message":f"Se importaron {len(new_products)} productos","imported_count":len(new_products)})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

# ── Documentos ────────────────────────────────────────────────────
@app.route('/api/documents', methods=['GET','POST'])
@login_required
def api_documents():
    try:
        uid = session['user_id']
        if request.method=='GET':
            return jsonify(get_user_items(uid, 'documents'))
        documents = get_user_items(uid, 'documents')
        clients   = get_user_items(uid, 'clients')
        payload   = request.get_json()
        new_id    = get_next_id(documents)
        tipo      = payload.get('tipo','cotizacion')

        # Número de documento con prefijos configurables
        config    = get_user_config(uid)
        prefijos  = {'cotizacion': config.get('prefijosCot','COT'), 'orden_compra': config.get('prefijosOC','OC'), 'factura': config.get('prefijosFac','FAC')}
        prefix    = prefijos.get(tipo, 'DOC')
        count     = len([d for d in documents if d.get('tipo')==tipo]) + 1

        payload['id']     = new_id
        payload['number'] = f"{prefix}-{count:04d}"
        payload['date']   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload['estado'] = ESTADO_INICIAL.get(tipo, 'borrador')
        enviar_email = payload.pop('enviar_email', False)

        documents.append(payload)

        # Actualizar stats del cliente (solo si no es orden de compra)
        if tipo != 'orden_compra':
            cliente = payload.get('cliente')
            if cliente and cliente.get('id'):
                for i,c in enumerate(clients):
                    if c['id']==cliente['id']:
                        clients[i]['documentos'] = clients[i].get('documentos',0) + 1
                        clients[i]['total']      = clients[i].get('total',0) + payload.get('total',0)
                        break
                save_user_items(uid,'clients',clients)

        # Actualizar stats del proveedor (solo orden de compra)
        if tipo == 'orden_compra':
            proveedor = payload.get('proveedor')
            if proveedor and proveedor.get('id'):
                providers = get_user_items(uid, 'providers')
                for i,p in enumerate(providers):
                    if p['id']==proveedor['id']:
                        providers[i]['ordenes'] = providers[i].get('ordenes',0) + 1
                        providers[i]['total']   = providers[i].get('total',0) + payload.get('total',0)
                        break
                save_user_items(uid,'providers',providers)

        save_user_items(uid,'documents',documents)

        email_sent = False
        if enviar_email and tipo != 'orden_compra':
            cliente_email = (payload.get('cliente') or {}).get('email','')
            if cliente_email:
                subject  = f"{payload['number']} - {(payload.get('cliente') or {}).get('razon_social','')}"
                html_doc = generar_html_documento(payload)
                email_sent = send_email_smtp(cliente_email, subject, html_doc)

        return jsonify({"success":True,"document":payload,"email_sent":email_sent})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/documents/<int:doc_id>', methods=['GET','PUT','DELETE'])
@login_required
def api_document(doc_id):
    try:
        uid = session['user_id']; documents = get_user_items(uid,'documents')
        if request.method=='GET':
            d = next((d for d in documents if d['id']==doc_id), None)
            return jsonify(d) if d else (jsonify({"error":"No encontrado"}),404)
        elif request.method=='PUT':
            payload = request.get_json()
            # Validar estado si viene en el payload
            if 'estado' in payload:
                doc = next((d for d in documents if d['id']==doc_id), None)
                if doc:
                    tipo = doc.get('tipo','cotizacion')
                    if payload['estado'] not in ESTADOS_VALIDOS.get(tipo,[]):
                        return jsonify({"success":False,"error":f"Estado inválido para {tipo}"}), 400
            for i,d in enumerate(documents):
                if d['id']==doc_id:
                    documents[i].update(payload); save_user_items(uid,'documents',documents)
                    return jsonify({"success":True,"document":documents[i]})
            return jsonify({"error":"No encontrado"}),404
        elif request.method=='DELETE':
            documents = [d for d in documents if d['id']!=doc_id]
            save_user_items(uid,'documents',documents); return jsonify({"success":True})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/documents/<int:doc_id>/convertir', methods=['POST'])
@login_required
def api_convertir_documento(doc_id):
    """Convierte una cotización aceptada en factura."""
    try:
        uid = session['user_id']
        documents = get_user_items(uid, 'documents')
        origen = next((d for d in documents if d['id']==doc_id), None)
        if not origen:
            return jsonify({"success":False,"error":"Documento no encontrado"}), 404
        if origen.get('tipo') != 'cotizacion':
            return jsonify({"success":False,"error":"Solo se pueden convertir cotizaciones"}), 400
        if origen.get('estado') != 'aceptada':
            return jsonify({"success":False,"error":"La cotización debe estar en estado 'aceptada' para convertir"}), 400

        config   = get_user_config(uid)
        prefix   = config.get('prefijosFac','FAC')
        count    = len([d for d in documents if d.get('tipo')=='factura']) + 1

        nueva_factura = {
            "id":           get_next_id(documents),
            "number":       f"{prefix}-{count:04d}",
            "tipo":         "factura",
            "estado":       "pendiente",
            "date":         datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "cliente":      origen.get('cliente'),
            "items":        origen.get('items', []),
            "subtotal":     origen.get('subtotal', 0),
            "iva":          origen.get('iva', 0),
            "total":        origen.get('total', 0),
            "validez":      origen.get('validez', 30),
            "notas":        origen.get('notas',''),
            "origen_id":    doc_id,       # referencia a la cotización original
            "origen_number":origen.get('number',''),
        }
        documents.append(nueva_factura)

        # Marcar cotización como facturada
        for i,d in enumerate(documents):
            if d['id'] == doc_id:
                documents[i]['estado']          = 'aceptada'
                documents[i]['factura_id']      = nueva_factura['id']
                documents[i]['factura_number']  = nueva_factura['number']
                break

        save_user_items(uid, 'documents', documents)
        return jsonify({"success":True,"factura":nueva_factura})
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

@app.route('/api/documents/<int:doc_id>/estados', methods=['GET'])
@login_required
def api_estados_documento(doc_id):
    """Retorna los estados válidos para un documento."""
    uid = session['user_id']
    documents = get_user_items(uid, 'documents')
    doc = next((d for d in documents if d['id']==doc_id), None)
    if not doc: return jsonify({"error":"No encontrado"}), 404
    tipo = doc.get('tipo','cotizacion')
    return jsonify({
        "tipo":    tipo,
        "estado":  doc.get('estado', ESTADO_INICIAL.get(tipo)),
        "estados": ESTADOS_VALIDOS.get(tipo,[]),
        "puede_convertir": tipo=='cotizacion' and doc.get('estado')=='aceptada' and not doc.get('factura_id')
    })

# ── Stats ─────────────────────────────────────────────────────────
@app.route('/api/stats')
@login_required
def api_stats():
    try:
        uid = session['user_id']
        docs     = get_user_items(uid,'documents')
        clients  = get_user_items(uid,'clients')
        products = get_user_items(uid,'products')

        total_sales = sum(d.get('total',0) for d in docs if d.get('tipo') == 'factura')
        total_compras = sum(d.get('total',0) for d in docs if d.get('tipo') == 'orden_compra')
        recent_docs = sorted(docs, key=lambda x: x.get('date',''), reverse=True)[:5]

        client_stats = {}
        doc_type_stats = {
            'cotizacion':   {'count':0,'total':0},
            'orden_compra': {'count':0,'total':0},
            'factura':      {'count':0,'total':0}
        }
        estado_stats = {}

        for doc in docs:
            # Por cliente
            name = (doc.get('cliente') or {}).get('razon_social','Sin nombre')
            client_stats.setdefault(name,{'count':0,'total':0})
            client_stats[name]['count'] += 1
            if doc.get('tipo') != 'orden_compra':
                client_stats[name]['total'] += doc.get('total',0)
            # Por tipo
            tipo = doc.get('tipo','cotizacion')
            if tipo in doc_type_stats:
                doc_type_stats[tipo]['count'] += 1
                doc_type_stats[tipo]['total'] += doc.get('total',0)
            # Por estado
            estado = doc.get('estado','pendiente')
            estado_stats.setdefault(estado, 0)
            estado_stats[estado] += 1

        # Documentos por mes (últimos 6 meses)
        from collections import defaultdict
        ventas_mes = defaultdict(float)
        for doc in docs:
            if doc.get('tipo')=='orden_compra': continue
            fecha = (doc.get('date') or '')[:7]  # YYYY-MM
            if fecha: ventas_mes[fecha] += doc.get('total',0)

        return jsonify({
            "total_documents": len(docs),
            "total_clients":   len(clients),
            "total_products":  len(products),
            "total_sales":     total_sales,
            "total_compras":   total_compras,
            "recent_documents": recent_docs,
            "client_stats":    client_stats,
            "doc_type_stats":  doc_type_stats,
            "estado_stats":    estado_stats,
            "ventas_mes":      dict(sorted(ventas_mes.items())[-6:]),
        })
    except Exception as e:
        return jsonify({"success":False,"error":str(e)}), 500

init_db()
_init_tokens_table()

if __name__ == '__main__':
    app.run(debug=True)

if __name__ == "__main__":
    # Render asigna un puerto dinámico, esta línea lo captura
    port = int(os.environ.get("PORT", 5000))
    # Es vital usar 0.0.0.0 para que sea accesible externamente
    app.run(host='0.0.0.0', port=port)