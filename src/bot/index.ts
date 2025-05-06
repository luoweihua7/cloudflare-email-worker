import type { ParsedMessage } from '../helper';
import TelegramMessage from './telegram';
import WeComMessage from './wecom';

export class Bot {
  private bots: (TelegramMessage | WeComMessage)[] = [];
  private kv: KVNamespace;
  private ttl: number;

  constructor(env: Env) {
    // Save KV instance
    this.kv = env.KV;
    
    // 从环境变量读取过期时间，如果未设置则使用默认值（2天 = 172800秒）
    this.ttl = parseInt(env.MESSAGE_EXPIRATION_TTL || '86400');

    // Initialize Telegram bot
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_IDS) {
      this.bots.push(
        new TelegramMessage({
          token: env.TELEGRAM_BOT_TOKEN,
          id: env.TELEGRAM_CHAT_IDS,
        }),
      );
    }

    // Initialize WeCom bot
    if (env.WECOM_BOT_GUID) {
      this.bots.push(
        new WeComMessage({
          guid: env.WECOM_BOT_GUID,
        }),
      );
    }

    // Output warning if no bot is configured
    if (this.bots.length === 0) {
      console.warn('No bot configuration found');
    }
  }

  /**
   * Check if message has been sent before
   * @private
   */
  private async checkIsMessageSent(messageId: string): Promise<boolean> {
    const sent = await this.kv.get(messageId);
    return sent !== null;
  }

  /**
   * Mark message as sent
   * @private
   */
  private async markMessageAsSent(messageId: string): Promise<void> {
    // 使用配置的过期时间
    await this.kv.put(messageId, '1', { expirationTtl: this.ttl });
  }

  /**
   * Send message to all configured bots
   * @param message Parsed message
   * @returns Promise<PromiseSettledResult<Response>[]>
   */
  async send(message: ParsedMessage): Promise<PromiseSettledResult<Response>[]> {
    const { messageId } = message;

    if (!messageId) {
      console.warn('Message ID is missing, proceeding without deduplication');
    } else {
      // Check if message was already sent
      const isSent = await this.checkIsMessageSent(messageId);
      if (isSent) {
        console.log(`Message ${messageId} was already sent, skipping`);
        return [];
      }
    }

    // Send message
    const promises = this.bots.map((bot) => bot.send(message));
    const results = await Promise.allSettled(promises);

    // Mark message as sent
    if (messageId) {
      await this.markMessageAsSent(messageId);
    }

    // Flatten results array
    return results.flat();
  }
}

// 重新导出具体的机器人类，以便需要时单独使用
export { TelegramMessage } from './telegram';
export { WeComMessage } from './wecom';
