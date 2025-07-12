// src/services/loggingService.ts
import apiClient from './apiClient';

interface LogDetails {
  [key: string]: any;
}

/**
 * ユーザーの活動ログをサーバーに送信する
 * @param activityType - ログの種類を示す文字列 (例: 'CREATE_MEMO')
 * @param details - 操作に関する追加情報 (例: { memoId: 123 })
 */
const logActivity = async (activityType: string, details?: LogDetails): Promise<void> => {
  try {
    // サーバーにログを送信する。成功しても特に何もする必要はないので、待機しない（fire and forget）
    apiClient.post('/log_activity', {
      activity_type: activityType,
      details: details || {},
    });
    console.log(`[Log] 送信完了: ${activityType}`, details || '');
  } catch (error) {
    // ログの送信失敗はユーザー体験に影響を与えないように、コンソールにエラーを出力するだけにする
    console.error('Failed to log activity:', error);
  }
};

export const loggingService = {
  logActivity,
};
