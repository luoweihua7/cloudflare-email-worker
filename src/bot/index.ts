import type { ParsedMessage } from '../helper';
import TelegramMessage from './telegram';
import WeComMessage from './wecom';

export class Bot {
  private bots: (TelegramMessage | WeComMessage)[] = [];
  private kv: KVNamespace;

  constructor(env: Env) {
    // Save KV instance
    this.kv = env.KV;

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
  private async isMessageSent(messageId: string): Promise<boolean> {
    const sent = await this.kv.get(messageId);
    return sent !== null;
  }

  /**
   * Mark message as sent
   * @private
   */
  private async markMessageAsSent(messageId: string): Promise<void> {
    // Set KV with 2-hour expiration
    await this.kv.put(messageId, '1', { expirationTtl: 7200 });
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
      const sent = await this.isMessageSent(messageId);
      if (sent) {
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
