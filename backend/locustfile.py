# locustfile.py
from locust import HttpUser, task, between
import random

class KnowledgeMapUser(HttpUser):
    # 各仮想ユーザーの待機時間（1秒から5秒の間）
    wait_time = between(1, 5)
    
    auth_token = None
    memo_id = None
    user_id = 0

    def on_start(self):
        """テスト開始時に、各仮想ユーザーが一度だけ実行する処理"""
        # ユーザーごとにユニークなユーザー名を作成
        self.user_id = random.randint(1, 100000)
        username = f"loadtest_user_{self.user_id}"
        
        # 1. ログインして認証トークンを取得
        with self.client.post("/api/login", json={"username": username}, catch_response=True) as response:
            if response.status_code == 200:
                self.auth_token = response.json().get("token")
                print(f"User {username} logged in successfully.")
            else:
                print(f"Login failed for user {username}. Status: {response.status_code}")
                response.failure("Login Failed")

    @task(10) # 10回に9回の割合で実行されるタスク
    def create_and_update_map(self):
        """メモの作成とマップの更新をシミュレートするタスク"""
        if not self.auth_token:
            return

        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # 2. 新しいメモを作成
        memo_content = f"This is a test memo from user {self.user_id} at {random.randint(1, 100)}."
        with self.client.post("/api/memos", headers=headers, json={"content": memo_content}, catch_response=True) as response:
            if response.status_code == 201:
                self.memo_id = response.json().get("id")
            else:
                response.failure(f"Memo creation failed: {response.status_code}")
                return

        # 3. マップを数回更新（自動保存をシミュレート）
        for i in range(3):
            map_data = {
                "nodes": [{"id": "node1", "data": {"label": f"Updated {i}"}, "position": {"x": 100, "y": 100}}],
                "edges": []
            }
            self.client.put(f"/api/maps/{self.memo_id}", headers=headers, json=map_data, name="/api/maps/[memo_id]")
    
    @task(1) # 10回に1回の割合で実行されるタスク
    def view_admin_stats(self):
        """（管理者ユーザーの場合）統計情報を閲覧するタスク"""
        # このタスクは、管理者としてログインした場合のみ意味があります
        if self.auth_token:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            self.client.get("/api/admin/stats", headers=headers)

