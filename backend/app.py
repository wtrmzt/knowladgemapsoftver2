# app.py
import os
import json
import logging
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify, g, make_response,send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import openai
import time_relation_logic
from functools import wraps
import pandas as pd
import jwt
from sqlalchemy import func, distinct, and_

# =============================================================================
# 1. Flask App Setup
# =============================================================================

# Flaskアプリケーションのインスタンスを作成
app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- アプリケーションの設定 ---
# CORS設定 (異なるオリジンからのリクエストを許可)
# これにより、手動でのOPTIONSメソッドの処理が不要になります。
CORS(app, 
     resources={r"/api/*": {"origins": "http://localhost:5173"}}, 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"]
)


# 1. データベース設定部分の修正
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a-default-fallback-secret-key')

# --- データベース接続設定 ---
database_url = os.getenv('DATABASE_URL')
if database_url:
    # RenderのPostgreSQLでは postgres:// が使われることがあるため、postgresql:// に変換
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    # PostgreSQL用の接続プール設定
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,    # 接続前の生存確認
        'pool_recycle': 299,      # 5分でコネクションをリサイクル
        'pool_timeout': 20,       # 接続取得のタイムアウト
        'pool_size': 10,          # 接続プールサイズ
        'max_overflow': 20,       # 最大オーバーフロー接続数
    }
else:
    # ローカル開発用のフォールバック（SQLiteまたはPostgreSQL）
    local_postgres_url = os.getenv('LOCAL_DATABASE_URL')
    if local_postgres_url:
        app.config['SQLALCHEMY_DATABASE_URI'] = local_postgres_url
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_pre_ping': True,
            'pool_recycle': 299,
        }
    else:
        # 最終的なフォールバック（SQLite）
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'knowledge_map_mvp.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['ADMIN_USERNAME'] = os.getenv('ADMIN_USERNAME', 'admin')

frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
CORS(app, 
     resources={r"/api/*": {"origins": frontend_url}}, 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"]
)


# OpenAI APIキーの設定


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
#print(f"OpenAI API Key: {OPENAI_API_KEY}")  # デバッグ用にAPIキーを出力（本番では削除すること）
if not OPENAI_API_KEY:
    app.logger.warning("警告: OpenAI APIキーが環境変数に設定されていません。")
else:
    openai.api_key = OPENAI_API_KEY
 
# --- データベースインスタンスの作成 ---
# appの設定がすべて完了した後に、dbインスタンスを一度だけ作成します。
db = SQLAlchemy(app)



# --- ユーザー認証のセットアップ ---
ALLOWED_USERS_CSV = 'allowed_users.csv'
allowed_user_ids = set()

def load_allowed_users():
    """Loads allowed user IDs from a CSV file at startup."""
    global allowed_user_ids
    try:
        if os.path.exists(ALLOWED_USERS_CSV):
            df = pd.read_csv(ALLOWED_USERS_CSV)
            allowed_user_ids = set(df['userId'].astype(str).tolist())
            app.logger.info(f"Successfully loaded {len(allowed_user_ids)} allowed users.")
        else:
            app.logger.warning(f"'{ALLOWED_USERS_CSV}' not found. No users will be allowed to log in.")
            # Create a dummy file for convenience
            pd.DataFrame({'userId': ['user1', 'user2']}).to_csv(ALLOWED_USERS_CSV, index=False)
            app.logger.info(f"Created a sample '{ALLOWED_USERS_CSV}'. Please edit it with actual user IDs.")
            load_allowed_users() # Retry loading
    except Exception as e:
        app.logger.error(f"Failed to load allowed users: {e}")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(" ")[1]
        if not token: return jsonify({'message': 'Token is missing'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            g.current_user_id = data['user_id']
            # ★★★ トークンに管理者フラグがあれば、gオブジェクトにセット ★★★
            g.is_admin = data.get('is_admin', False) 
        except Exception as e: return jsonify({'message': f'Token is invalid: {str(e)}'}), 401
        return f(*args, **kwargs)
    return decorated

# ★★★ 管理者専用APIのためのデコレータを新設 ★★★
def admin_required(f):
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if not g.is_admin:
            return jsonify({'message': 'Administrator privileges required'}), 403
        return f(*args, **kwargs)
    return decorated

# --- CORSプリフライトリクエストの処理 ---
def _build_cors_preflight_response():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
    response.headers.add('Access-Control-Allow-Methods', "GET,POST,PUT,DELETE,OPTIONS")
    return response

# --- APIルート ---

# ★★★ 修正: Google認証の代わりに、IDベースのログインエンドポイントを実装 ★★★
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    if not username: return jsonify({"message": "Username is required"}), 400
    
    try:
        user = User.query.filter_by(username=username).first()
        if not user:
            user = User(username=username)
            db.session.add(user)
            db.session.commit()
        
        # ★★★ ログインユーザーが管理者か判定し、トークンに権限情報を追加 ★★★
        is_admin = (username == app.config['ADMIN_USERNAME'])
        
        token_payload = {
            'user_id': user.id,
            'is_admin': is_admin,
            'exp': datetime.now(timezone.utc) + timedelta(hours=24)
        }
        jwt_token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({"token": jwt_token, "is_admin": is_admin}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Server error during login"}), 500



# =============================================================================
# 2. Database Models
# =============================================================================
from sqlalchemy.dialects.postgresql import UUID
import uuid

class User(db.Model):
    __tablename__ = 'users'  # テーブル名を明示的に指定
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    memos = db.relationship('Memo', backref='author', lazy=True, cascade="all, delete-orphan")
    logs = db.relationship('UserActivityLog', backref='user', lazy=True, cascade="all, delete-orphan")

class Memo(db.Model):
    __tablename__ = 'memos'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    history_entries = db.relationship('MapHistory', backref='memo', lazy=True, cascade="all, delete-orphan")

class MapHistory(db.Model):
    __tablename__ = 'map_history'
    
    id = db.Column(db.Integer, primary_key=True)
    memo_id = db.Column(db.Integer, db.ForeignKey('memos.id'), nullable=False, index=True)
    map_data = db.Column(db.JSON, nullable=False)  # PostgreSQLのJSONB型が自動選択される
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

class KnowledgeMap(db.Model):
    __tablename__ = 'knowledge_maps'
    
    id = db.Column(db.Integer, primary_key=True)
    memo_id = db.Column(db.Integer, db.ForeignKey('memos.id'), nullable=False, unique=True)
    map_data = db.Column(db.JSON, nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class UserActivityLog(db.Model):
    __tablename__ = 'user_activity_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    activity_type = db.Column(db.String(100), nullable=False, index=True)
    details = db.Column(db.JSON)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

# =============================================================================
# 3. Helper Functions
# =============================================================================

def get_current_user():
    """リクエストヘッダーからトークンを検証し、ユーザーを返す"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]

    if token.startswith("demo_app_token_for_"):
        try:
            user_id = int(token.split("demo_app_token_for_")[1])
            return User.query.get(user_id)
        except (IndexError, ValueError):
            return None
    return None

# ★★★ 未定義だったCORSプリフライトリクエスト用のヘルパー関数を追加 ★★★
def _build_cors_preflight_response():
    """CORSのプリフライトリクエストに対するレスポンスを構築する"""
    response = jsonify(message="CORS preflight successful")
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    return response

# =============================================================================
# 4. API Endpoints
# =============================================================================



# 3. データベース初期化とマイグレーション用の関数
def init_database():
    """データベースの初期化"""
    try:
        # テーブルの作成
        db.create_all()
        app.logger.info("Database tables created successfully.")
        
        # インデックスの確認・作成
        with db.engine.connect() as conn:
            # 必要に応じて追加のインデックスを作成
            try:
                conn.execute(db.text("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memos_user_created ON memos(user_id, created_at DESC)"))
                conn.execute(db.text("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_map_history_memo_created ON map_history(memo_id, created_at DESC)"))
                conn.commit()
                app.logger.info("Additional indexes created successfully.")
            except Exception as e:
                app.logger.warning(f"Could not create additional indexes: {e}")
                
    except Exception as e:
        app.logger.error(f"Database initialization failed: {e}")
        raise

# app.py - CSVエクスポート機能の改良版

@app.route('/api/admin/export_csv', methods=['GET'])
@admin_required
def export_database_csv():
    """全テーブルをCSV形式でエクスポート"""
    import io
    import zipfile
    from datetime import datetime
    
    try:
        # メモリ上にZIPファイルを作成
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            
            # ユーザーテーブル
            users_data = []
            users = User.query.all()
            for user in users:
                users_data.append({
                    'id': user.id,
                    'username': user.username,
                    'created_at': user.created_at.isoformat() if user.created_at else ''
                })
            if users_data:  # データが存在する場合のみCSVを作成
                users_df = pd.DataFrame(users_data)
                users_csv = users_df.to_csv(index=False)
                zip_file.writestr('users.csv', users_csv)
            
            # メモテーブル
            memos_data = []
            memos = Memo.query.all()
            for memo in memos:
                memos_data.append({
                    'id': memo.id,
                    'user_id': memo.user_id,
                    'content': memo.content,
                    'created_at': memo.created_at.isoformat() if memo.created_at else ''
                })
            if memos_data:
                memos_df = pd.DataFrame(memos_data)
                memos_csv = memos_df.to_csv(index=False)
                zip_file.writestr('memos.csv', memos_csv)
            
            # マップ履歴テーブル
            history_data = []
            histories = MapHistory.query.all()
            for history in histories:
                history_data.append({
                    'id': history.id,
                    'memo_id': history.memo_id,
                    'map_data': json.dumps(history.map_data, ensure_ascii=False) if history.map_data else '',
                    'created_at': history.created_at.isoformat() if history.created_at else ''
                })
            if history_data:
                history_df = pd.DataFrame(history_data)
                history_csv = history_df.to_csv(index=False)
                zip_file.writestr('map_history.csv', history_csv)
            
            # ナレッジマップテーブル（存在する場合）
            try:
                knowledge_maps_data = []
                knowledge_maps = KnowledgeMap.query.all()
                for km in knowledge_maps:
                    knowledge_maps_data.append({
                        'id': km.id,
                        'memo_id': km.memo_id,
                        'map_data': json.dumps(km.map_data, ensure_ascii=False) if km.map_data else '',
                        'generated_at': km.generated_at.isoformat() if km.generated_at else ''
                    })
                if knowledge_maps_data:
                    km_df = pd.DataFrame(knowledge_maps_data)
                    km_csv = km_df.to_csv(index=False)
                    zip_file.writestr('knowledge_maps.csv', km_csv)
            except Exception as e:
                app.logger.warning(f"Could not export knowledge_maps table: {e}")
            
            # アクティビティログテーブル
            activity_data = []
            activities = UserActivityLog.query.all()
            for activity in activities:
                activity_data.append({
                    'id': activity.id,
                    'user_id': activity.user_id,
                    'activity_type': activity.activity_type,
                    'details': json.dumps(activity.details, ensure_ascii=False) if activity.details else '',
                    'timestamp': activity.timestamp.isoformat() if activity.timestamp else ''
                })
            if activity_data:
                activity_df = pd.DataFrame(activity_data)
                activity_csv = activity_df.to_csv(index=False)
                zip_file.writestr('user_activity_logs.csv', activity_csv)
            
            # エクスポート情報ファイルを追加
            export_info = f"""データベースエクスポート情報
エクスポート日時: {datetime.now().isoformat()}
総ユーザー数: {len(users_data)}
総メモ数: {len(memos_data)}
総マップ履歴数: {len(history_data)}
総アクティビティログ数: {len(activity_data)}
"""
            zip_file.writestr('export_info.txt', export_info)
        
        # レスポンス準備
        zip_buffer.seek(0)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        response = make_response(zip_buffer.read())
        response.headers['Content-Type'] = 'application/zip'
        response.headers['Content-Disposition'] = f'attachment; filename=database_export_{timestamp}.zip'
        response.headers['Content-Length'] = len(zip_buffer.getvalue())
        
        app.logger.info(f"Database CSV export completed successfully for admin user")
        return response
        
    except Exception as e:
        app.logger.error(f"CSV export failed: {e}", exc_info=True)
        return jsonify({"message": f"Export failed: {str(e)}"}), 500


# 4. データベース接続の健全性チェック
@app.route('/api/health', methods=['GET'])
def health_check():
    """データベース接続の健全性チェック"""
    try:
        # シンプルなクエリでデータベース接続をテスト
        db.session.execute(db.text('SELECT 1'))
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        app.logger.error(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# ★★★ 修正点: GETとPUTを一つの関数に統合 ★★★
@app.route('/api/maps/<int:memo_id>', methods=['GET', 'PUT'])
@token_required
def handle_single_map(memo_id):
    user_id = g.current_user_id
    memo = Memo.query.filter_by(id=memo_id, user_id=user_id).first()
    if not memo:
        app.logger.warning(f"Map/Memo with id {memo_id} not found for user {user_id}")
        return jsonify({"message": "Map not found or access denied"}), 404

    # --- GETリクエストの処理 ---
    if request.method == 'GET':
        app.logger.info(f"Handling GET request for map with memo_id: {memo_id}")
        latest_history = MapHistory.query.filter_by(memo_id=memo_id).order_by(MapHistory.created_at.desc()).first()
        print(f"Latest history for memo_id {memo_id}: {latest_history.map_data if latest_history else 'None'}")
        if not latest_history:
            app.logger.warning(f"No map history found for memo_id: {memo_id}")
            return jsonify({"message": "Knowledge map history not found for this memo"}), 404
        return jsonify({
            "memo_id": memo_id, 
            "map_data": latest_history.map_data, 
            "generated_at": latest_history.created_at.isoformat()
        }), 200

    # --- PUTリクエストの処理 ---
    if request.method == 'PUT':
        app.logger.info(f"Handling PUT request for map with memo_id: {memo_id}")
        new_map_data = request.get_json()
        print(f"New map data received for memo_id {memo_id}: {new_map_data}")
        if not new_map_data or 'nodes' not in new_map_data or 'edges' not in new_map_data:
            return jsonify({"message": "Invalid map data format"}), 400
        try:
            new_history_entry = MapHistory(memo_id=memo_id, map_data=new_map_data)
            db.session.add(new_history_entry)
            db.session.commit()
            return jsonify({"message": "Map history created successfully"}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"DB Error on PUT for map with memo_id {memo_id}: {e}", exc_info=True)
            return jsonify({"message": "Failed to create map history"}), 500


# ★★★ 修正: この関数を修正しました ★★★
@app.route('/api/memos', methods=['GET', 'POST'])
@token_required
def handle_memos():
    # @token_requiredデコレータによってg.current_user_idにユーザーIDがセットされる
    user_id = g.current_user_id

    # POSTリクエスト（新しいメモの作成）
    if request.method == 'POST':
        data = request.get_json()
        if not data or not data.get('content'): 
            return jsonify({"message": "Memo content is required"}), 400
        
        # user_idを使って新しいMemoオブジェクトを作成
        memo = Memo(user_id=user_id, content=data['content'])
        db.session.add(memo)
        db.session.commit()
        return jsonify({"id": memo.id, "content": memo.content, "created_at": memo.created_at.isoformat()}), 201
    
    # GETリクエスト（メモ一覧の取得）
    # user_idを使って、そのユーザーのメモのみを取得
    memos = Memo.query.filter_by(user_id=user_id).order_by(Memo.created_at.desc()).all()
    return jsonify([{"id": m.id, "content": m.content, "created_at": m.created_at.isoformat()} for m in memos]), 200

# ★★★ 修正: 重複を削除し、ここに一つだけ定義 ★★★
@app.route('/api/log_activity', methods=['POST'])
@token_required
def log_user_activity():
    """Logs a specific user activity."""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
        
    user_id = g.current_user_id
    data = request.get_json()
    if not data or 'activity_type' not in data:
        return jsonify({"message": "activity_type is required"}), 400

    try:
        log_entry = UserActivityLog(
            user_id=user_id,
            activity_type=data.get('activity_type'),
            details=data.get('details', {})
        )
        db.session.add(log_entry)
        db.session.commit()
        app.logger.info(f"Activity '{data.get('activity_type')}' logged for user {user_id}")
        return jsonify({"status": "success"}), 201
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error logging activity: {e}", exc_info=True)
        return jsonify({"message": "Server error while logging activity"}), 500

# ★★★ 修正点: このAPIの内部ロジックをより堅牢な方式に変更 ★★★
@app.route('/api/memos_with_map', methods=['POST'])
@token_required
def create_memo_with_map():
    user_id = g.current_user_id
    data = request.get_json()
    if not data or not data.get('content'):
        return jsonify({"message": "Memo content is required"}), 400
    
    content = data['content']
    
    try:
        # 1. 新しいメモオブジェクトを作成
        new_memo = Memo(user_id=user_id, content=content)

        # 2. 初期マップデータを作成
        initial_map_data = {
            "nodes": [{
                "id": f"initial-node-{int(datetime.now().timestamp())}",
                "data": {"label": content[:20] or "最初のノード"},
                "position": {"x": 100, "y": 100}
            }],
            "edges": []
        }

        # 3. 新しいマップ履歴を作成し、メモの履歴リストに追加
        new_history_entry = MapHistory(map_data=initial_map_data)
        new_memo.history_entries.append(new_history_entry)

        # 4. メモオブジェクトをセッションに追加
        #    (SQLAlchemyが親子関係を理解し、両方を正しく保存してくれる)
        db.session.add(new_memo)
        db.session.commit()

        return jsonify({
            "memo": {
                "id": new_memo.id,
                "content": new_memo.content,
                "created_at": new_memo.created_at.isoformat()
            },
            "map": {
                "memo_id": new_memo.id,
                "map_data": initial_map_data,
                "generated_at": new_history_entry.created_at.isoformat()
            }
        }), 201

    except Exception as e:
        db.session.rollback() # エラーが発生した場合は全ての変更を取り消す
        app.logger.error(f"Failed to create memo with map: {e}", exc_info=True)
        return jsonify({"message": "Failed to create memo and map"}), 500


# ★★★ 修正: 既存のマップ生成関数を、履歴追加に特化させる ★★★
@app.route('/api/memos/<int:memo_id>/generate_map', methods=['POST'])
@token_required
def generate_map_for_memo(memo_id):
    user_id = g.current_user_id
    memo = Memo.query.filter_by(id=memo_id, user_id=user_id).first()
    if not memo:
        return jsonify({"message": "Memo not found or access denied"}), 404

    map_data_to_save = None
    
    # OpenAI APIキーが設定されている場合のみAPIを呼び出す
    if os.getenv("OPENAI_API_KEY"):
        try:
            prompt_text = f"""
            入力された生徒の振り返り記述から、学習内容の理解を深めるための知識マップを生成してください。
            - 振り返りの中心となる重要な概念をノードとして抽出します。
            - 各ノードには、140字以内で簡潔な説明文（sentence）を生成します。
            - ノード間の関連性をエッジとして定義します。
            - 出力は必ず以下のJSON形式に従ってください。
            {{
              "nodes": [
                {{"id": "unique_id_1", "label": "ノード名1", "sentence": "説明文1"}},
                {{"id": "unique_id_2", "label": "ノード名2", "sentence": "説明文2"}}
              ],
              "edges": [
                {{"source": "unique_id_1", "target": "unique_id_2"}}
              ]
            }}
            入力:
            ---
            {memo.content}
            ---
            """
            client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "あなたは優秀な教員アシスタントで、与えられたテキストから知識マップをJSON形式で生成します。"},
                    {"role": "user", "content": prompt_text}
                ],
                model="gpt-4o", # 推奨モデル
                response_format={"type": "json_object"},
                temperature=0.2
            )
            response_content = chat_completion.choices[0].message.content
            map_data_to_save = json.loads(response_content)
        except Exception as e:
            app.logger.error(f"OpenAI API Error for memo {memo_id}: {e}", exc_info=True)
            # APIエラー時はダミーデータにフォールバック
            map_data_to_save = None

    # APIキーがない、またはAPI呼び出しに失敗した場合
    if map_data_to_save is None:
        map_data_to_save = {
            "nodes": [{"id": "dummy_node_1", "data": {"label": "主要な概念"}, "position": {"x": 100, "y": 100}}],
            "edges": []
        }

    try:
        # 常に新しい履歴として保存
        new_history_entry = MapHistory(memo_id=memo_id, map_data=map_data_to_save)
        db.session.add(new_history_entry)
        db.session.commit()
        
        return jsonify({
            "memo_id": memo_id, 
            "map_data": map_data_to_save, 
            "generated_at": new_history_entry.created_at.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"DB error saving new map history for memo {memo_id}: {e}", exc_info=True)
        return jsonify({"message": "Database error while saving map"}), 500

@app.route('/api/nodes/<path:node_label>/suggest_related', methods=['GET'])
@token_required
def suggest_related_nodes_api(node_label):
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()

    user_id = g.current_user_id
    if not user_id:
        app.logger.warning(f"Suggest related nodes attempt for '{node_label}' by unauthenticated user.")
        return jsonify({"message": "Authentication required"}), 401

    if not node_label:
        app.logger.warning("Node label is missing for suggesting related nodes.")
        return jsonify({"message": "Node label is required"}), 400

    app.logger.info(f"Suggesting related nodes for label: {node_label}")

    if not OPENAI_API_KEY or OPENAI_API_KEY == "YOUR_OPENAI_API_KEY_HERE":
        app.logger.info(f"Using dummy suggestions for '{node_label}' as OpenAI API key is not set.")
        dummy_suggestions = [
            {"id": f"dummy_suggest_1_{node_label.replace(' ', '_')}", "label": f"{node_label} - 関連候補1", "sentence": f"これは「{node_label}」に関するダミーの関連情報候補1です。"},
            {"id": f"dummy_suggest_2_{node_label.replace(' ', '_')}", "label": f"{node_label} - 関連候補2", "sentence": f"APIキーを設定すると、より適切な候補が生成されます。"},
            {"id": f"dummy_suggest_3_{node_label.replace(' ', '_')}", "label": f"{node_label} - 関連候補3", "sentence": f"この情報はOpenAI APIなしで提供されています。"},
        ]
        return jsonify({"suggested_nodes": dummy_suggestions}), 200

    try:
        prompt_text = f"""
        与えられた中心トピック「{node_label}」について、学習を深めるための関連キーワードや補足情報を3つ提案してください。
        各提案は、以下のJSONオブジェクトのリスト形式で、リスト全体を返してください:
        [
            {{'id':add_i,'label':'node_name','sentence':'writetext','extend_query':['relate contents1','relate contents2','relate contents3','relate contents4','relate contents5']}},
            {{'id':add_j,'label':'node_name','sentence':'writetext','extend_query':['relate contents1','relate contents2','relate contents3','relate contents4','relate contents5']}}
          ]

        nodes：ノードが格納される。add_idにはadd_[ノードの番号]を格納。labelにはノード名、sentenceには説明文を140字以内で、extend_queryではそのノードについてwikipediaにおける拡張概念を5つ程度リストによって格納する。
        edges：エッジが格納される。fromには始点のノード番号、toには終点のノード番号を格納する。
        """
        
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "あなたは優秀なリサーチャーで、与えられたトピックから関連性の高い情報を抽出し、構造化して提案します。"},
                {"role": "user", "content": prompt_text}
            ],
            model="gpt-4.1",
            temperature=0.0
        )
        
        response_content = chat_completion.choices[0].message.content
        app.logger.info(f"OpenAI raw response for suggest_related_nodes ('{node_label}'): {response_content}")
        
        try:
            suggested_nodes_data = json.loads(response_content) 
            
            if not isinstance(suggested_nodes_data, list):
                if isinstance(suggested_nodes_data, dict) and "suggested_nodes" in suggested_nodes_data and isinstance(suggested_nodes_data["suggested_nodes"], list):
                    suggested_nodes_data = suggested_nodes_data["suggested_nodes"]
                else:
                    raise ValueError("OpenAI response is not a list, nor an object containing a 'suggested_nodes' list.")

            valid_suggestions = []
            for i, node in enumerate(suggested_nodes_data):
                if isinstance(node, dict) and all(key in node for key in ["label", "sentence"]):
                    node["id"] = node.get("id", f"suggested_temp_{i+1}")
                    valid_suggestions.append(node)
                else:
                    app.logger.warning(f"Invalid node structure in suggestion: {node}")
            
            if not valid_suggestions:
                 raise ValueError("No valid suggestions found in OpenAI response.")

            app.logger.info(f"Successfully parsed {len(valid_suggestions)} suggestions for '{node_label}'.")
            return jsonify({"suggested_nodes": valid_suggestions}), 200

        except (json.JSONDecodeError, ValueError) as e:
            app.logger.error(f"Failed to parse OpenAI response for '{node_label}': {e}. Response was: {response_content}", exc_info=True)
            return jsonify({"message": f"OpenAI応答の解析に失敗: {str(e)}"}), 500

    except openai.APIError as e:
        app.logger.error(f"OpenAI API Error during suggestions for '{node_label}': {e}", exc_info=True)
        return jsonify({"message": f"OpenAI API Error: {str(e)}"}), 503
    except Exception as e:
        app.logger.error(f"Error generating suggestions for '{node_label}': {e}", exc_info=True)
        return jsonify({"message": f"Error generating suggestions: {str(e)}"}), 500


@app.route('/api/temporal_related_nodes', methods=['POST'])
@token_required
def calculate_temporal_related_nodes():
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()

    user_id = g.current_user_id
    if not user_id:
        return jsonify({"message": "Authentication required"}), 401
    
    data = request.get_json()
    if not data or 'node' not in data:
        return jsonify({"message": "Request body must be JSON and contain a 'node' object"}), 400
    
    input_node_data = data['node']
    
    if not input_node_data.get('label'):
        return jsonify({"message": "Node 'label' is required"}), 400

    app.logger.info(f"API: Received request for temporal related nodes for: '{input_node_data.get('label')}'")

    try:
        result = time_relation_logic.find_temporal_relation(input_node_data)
        return jsonify(result), 200

    except FileNotFoundError as e:
        app.logger.error(f"API Error: Master data file not found: {e}", exc_info=True)
        return jsonify({"message": f"サーバーエラー: 関連データの読み込みに失敗しました。"}), 500
    except Exception as e:
        app.logger.error(f"API Error: Error calculating temporal related nodes for '{input_node_data.get('label')}': {e}", exc_info=True)
        return jsonify({"message": f"時系列関連ノードの算出中に予期せぬエラーが発生しました。"}), 500

@app.route('/api/maps/<int:memo_id>', methods=['PUT'])
@token_required
def update_map(memo_id):
    user_id = g.current_user_id
    app.logger.info(f"[update_map] Received request for memo_id: {memo_id} from user_id: {user_id}")

    memo = Memo.query.filter_by(id=memo_id).first()
    if not memo:
        app.logger.warning(f"[update_map] Memo with id {memo_id} not found.")
        return jsonify({"message": "Memo not found"}), 404
    
    if not g.is_admin and memo.user_id != user_id:
        app.logger.warning(f"[update_map] Access denied for user {user_id} on memo {memo_id}")
        return jsonify({"message": "Access denied"}), 403

    new_map_data = request.get_json()
    if not new_map_data or 'nodes' not in new_map_data or 'edges' not in new_map_data:
        app.logger.error("[update_map] Invalid map data format received.")
        return jsonify({"message": "Invalid map data format"}), 400

    try:
        app.logger.info(f"[update_map] Creating new MapHistory entry for memo_id: {memo_id}")
        new_history_entry = MapHistory(memo_id=memo_id, map_data=new_map_data)
        db.session.add(new_history_entry)
        
        app.logger.info("[update_map] Committing transaction to the database...")
        db.session.commit()
        app.logger.info("[update_map] Commit successful.")
        
        return jsonify({"message": "Map history created successfully"}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"[update_map] Failed to create map history for memo {memo_id}: {e}", exc_info=True)
        return jsonify({"message": "Failed to create map history"}), 500

# =============================================================================
# 5. Admin API Endpoints
# =============================================================================
@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    users = User.query.all()
    return jsonify([{'id': u.id, 'username': u.username} for u in users]), 200

@app.route('/api/admin/memos/<int:user_id>', methods=['GET'])
@admin_required
def get_user_memos(user_id):
    memos = Memo.query.filter_by(user_id=user_id).order_by(Memo.created_at.desc()).all()
    return jsonify([{'id': m.id, 'content': m.content, 'created_at': m.created_at.isoformat()} for m in memos]), 200

@app.route('/api/admin/map_history/<int:memo_id>', methods=['GET'])
@admin_required
def get_full_map_history(memo_id):
    history_entries = MapHistory.query.filter_by(memo_id=memo_id).order_by(MapHistory.created_at.asc()).all()
    return jsonify([{
        'history_id': h.id,
        'map_data': h.map_data,
        'created_at': h.created_at.isoformat()
    } for h in history_entries]), 200

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_system_stats():
    """システム全体の統計情報を返す"""
    try:
        total_users = db.session.query(func.count(User.id)).scalar()
        total_memos = db.session.query(func.count(Memo.id)).scalar()
        total_map_revisions = db.session.query(func.count(MapHistory.id)).scalar()
        
        # ★★★ 修正点: 統計クエリをより安全で明示的なものに修正 ★★★
        user_activity = db.session.query(
            User.username,
            func.count(distinct(Memo.id)).label('memo_count'),
            func.count(distinct(MapHistory.id)).label('revision_count')
        ).outerjoin(Memo, User.id == Memo.user_id) \
         .outerjoin(MapHistory, Memo.id == MapHistory.memo_id) \
         .group_by(User.id).order_by(User.id).all()
        
        activity_data = [{'username': u, 'memo_count': mc, 'revision_count': rc} for u, mc, rc in user_activity]

        return jsonify({
            'total_users': total_users,
            'total_memos': total_memos,
            'total_map_revisions': total_map_revisions,
            'user_activity': activity_data
        }), 200
    except Exception as e:
        app.logger.error(f"Error fetching stats: {e}", exc_info=True)
        return jsonify({"message": "Failed to fetch system statistics"}), 500

import uuid # ★ 変更点: UUIDライブラリをインポート

@app.route('/api/nodes/create_manual', methods=['POST'])
@token_required
def create_manual_node():
    """ユーザーが手動で入力したラベルに基づいて新しいノードを生成する"""
    data = request.get_json()
    node_label = data.get('label')

    if not node_label:
        return jsonify({"message": "Node label is required"}), 400

    app.logger.info(f"Manually creating node for label: {node_label}")

    # OpenAIキーが設定されていない場合は、ダミーデータを返す
    if not OPENAI_API_KEY or OPENAI_API_KEY == "YOUR_OPENAI_API_KEY_HERE":
        app.logger.info(f"Using dummy data for manually created node '{node_label}' as OpenAI API key is not set.")
        new_node_data = {
            "id": f"manual_{node_label.replace(' ', '_')}_{uuid.uuid4().hex[:6]}",
            "label": node_label,
            "sentence": f"これは「{node_label}」について手動で作成されたダミーノードです。APIキーを設定すると、AIによる説明が生成されます。",
            "extend_query": [f"{node_label}とは", f"{node_label}の例"]
        }
        return jsonify(new_node_data), 200

    try:
        # AIに渡すプロンプトを定義
        prompt_text = f"""
        与えられたトピック「{node_label}」について、学習のための情報を生成してください。
        以下のJSONオブジェクト形式で、オブジェクト単体を返してください:
        {{
          "id": "manual_{str(uuid.uuid4())}",
          "label": "{node_label}",
          "sentence": "トピックに関する140字以内の簡潔な説明文",
          "extend_query": ["関連検索クエリ1", "関連検索クエリ2", "関連検索クエリ3"]
        }}

        - idは "manual_" で始まるユニークな文字列にしてください。
        """
        
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "あなたは優秀な教育アシスタントで、与えられたトピックから知識ノードの情報をJSON形式で生成します。"},
                {"role": "user", "content": prompt_text}
            ],
            model="gpt-4-turbo",
            response_format={ "type": "json_object" },
            temperature=0.2
        )
        
        response_content = chat_completion.choices[0].message.content
        app.logger.info(f"OpenAI raw response for create_manual_node ('{node_label}'): {response_content}")
        
        new_node_data = json.loads(response_content)
        
        # 必須キーの検証
        if not all(key in new_node_data for key in ["id", "label", "sentence", "extend_query"]):
             raise ValueError("OpenAI response is missing required keys.")

        return jsonify(new_node_data), 201

    except openai.APIError as e:
        app.logger.error(f"OpenAI API Error during manual node creation for '{node_label}': {e}", exc_info=True)
        return jsonify({"message": f"OpenAI API Error: {str(e)}"}), 503
    except Exception as e:
        app.logger.error(f"Error creating manual node for '{node_label}': {e}", exc_info=True)
        return jsonify({"message": f"Error creating manual node: {str(e)}"}), 500

@app.route('/api/admin/rollback/<int:memo_id>', methods=['POST'])
@admin_required
def rollback_map_history(memo_id):
    """指定された履歴IDの状態にマップをロールバックする"""
    data = request.get_json()
    history_id_to_rollback = data.get('history_id')
    if not history_id_to_rollback:
        return jsonify({"message": "history_id is required"}), 400

    target_history = MapHistory.query.filter_by(id=history_id_to_rollback, memo_id=memo_id).first()
    if not target_history:
        return jsonify({"message": "Target history entry not found"}), 404

    try:
        new_history_entry = MapHistory(memo_id=memo_id, map_data=target_history.map_data)
        db.session.add(new_history_entry)
        db.session.commit()
        return jsonify({"message": "Rollback successful"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to perform rollback"}), 500
    

# 既存のバックアップ関数の修正版（Render対応）
@app.route('/api/admin/backup_db', methods=['GET'])
@admin_required
def backup_database():
    """SQLAlchemyを使ったバックアップ（Render環境対応）"""
    try:
        # SQLAlchemyのメタデータを使ってSQLダンプを生成
        from sqlalchemy import create_engine, MetaData
        from sqlalchemy.schema import CreateTable
        
        engine = db.engine
        metadata = MetaData()
        metadata.reflect(bind=engine)
        
        backup_sql = []
        backup_sql.append("-- Database backup generated by Knowledge Map App")
        backup_sql.append(f"-- Generated at: {datetime.now().isoformat()}")
        backup_sql.append("")
        
        # テーブル作成文を生成
        for table in metadata.sorted_tables:
            backup_sql.append(f"-- Table: {table.name}")
            create_stmt = str(CreateTable(table).compile(engine))
            backup_sql.append(create_stmt + ";")
            backup_sql.append("")
        
        # データのINSERT文を生成
        with engine.connect() as conn:
            for table in metadata.sorted_tables:
                result = conn.execute(table.select())
                rows = result.fetchall()
                
                if rows:
                    backup_sql.append(f"-- Data for table: {table.name}")
                    for row in rows:
                        values = []
                        for value in row:
                            if value is None:
                                values.append('NULL')
                            elif isinstance(value, str):
                                values.append(f"'{value.replace("'", "''")}'")
                            elif isinstance(value, dict):
                                values.append(f"'{json.dumps(value).replace("'", "''")}'")
                            else:
                                values.append(str(value))
                        
                        columns = [col.name for col in table.columns]
                        insert_stmt = f"INSERT INTO {table.name} ({', '.join(columns)}) VALUES ({', '.join(values)});"
                        backup_sql.append(insert_stmt)
                    backup_sql.append("")
        
        backup_content = '\n'.join(backup_sql)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        response = make_response(backup_content)
        response.headers['Content-Type'] = 'application/sql'
        response.headers['Content-Disposition'] = f'attachment; filename=knowledge_map_backup_{timestamp}.sql'
        
        return response
        
    except Exception as e:
        app.logger.error(f"Backup failed: {e}", exc_info=True)
        return jsonify({"message": f"Backup failed: {str(e)}"}), 500

# ★★★ 新規追加: 全ユーザーの最新マップを統合して取得するAPI ★★★
@app.route('/api/admin/combined_map', methods=['GET'])
@admin_required
def get_combined_map():
    """全ユーザーの最新のマップデータを取得する"""
    try:
        # 各memo_idに対する最新のcreated_atを持つサブクエリを作成
        latest_history_subquery = db.session.query(
            MapHistory.memo_id,
            func.max(MapHistory.created_at).label('max_created_at')
        ).group_by(MapHistory.memo_id).subquery()

        # サブクエリを使って、最新の履歴のみを効率的に取得
        latest_maps = db.session.query(
            User.username,
            MapHistory.map_data
        ).join(
            latest_history_subquery,
            and_(
                MapHistory.memo_id == latest_history_subquery.c.memo_id,
                MapHistory.created_at == latest_history_subquery.c.max_created_at
            )
        ).join(Memo, MapHistory.memo_id == Memo.id)\
         .join(User, Memo.user_id == User.id).all()

        # フロントエンドが扱いやすい形式に整形
        response_data = [
            {"username": username, "map_data": map_data}
            for username, map_data in latest_maps
        ]
        
        return jsonify(response_data), 200
    except Exception as e:
        app.logger.error(f"Error fetching combined map: {e}", exc_info=True)
        return jsonify({"message": "Failed to fetch combined map data"}), 500
# =============================================================================


if __name__ == '__main__':
    with app.app_context():
        # Create database tables if they don't exist
        db.create_all()
        app.logger.info("Database tables checked/created.")
    app.run(debug=True, port=5001)