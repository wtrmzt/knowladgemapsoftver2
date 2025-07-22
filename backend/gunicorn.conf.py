# gunicorn.conf.py

# ワーカープロセスの数を指定
workers = 8

# ★★★ 最も重要な設定 ★★★
# 非同期ライブラリとしてgeventを使用するよう指定
worker_class = 'gevent'

# 各ワーカーが同時に処理できる接続数
# worker_classにgeventを指定した場合、この値を大きくできる
worker_connections = 1000

# タイムアウト時間（秒）
# 時間のかかるAPI呼び出しが中断されないように長めに設定
timeout = 120

# 一定数のリクエストを処理した後にワーカーを再起動し、メモリリークを防ぐ
max_requests = 1000
max_requests_jitter = 50

# ログ設定
# Renderのログに正しく出力されるように設定
log_level = 'info'
accesslog = '-'
errorlog = '-'
