import type { ParsedMessage } from '../helper';

interface TelegramConfig {
  token: string;
  id: string;
}

export default class TelegramMessage {
  private readonly apiUrl: string;
  private readonly chatIds: string[];

  constructor({ token, id }: TelegramConfig) {
    if (!token) {
      throw new Error('Telegram bot token is required');
    }
    if (!id) {
      throw new Error('Telegram chat ID is required');
    }

    this.apiUrl = `https://api.telegram.org/bot${token.trim()}/sendMessage`;
    this.chatIds = this.getValidChatIds(id);
  }

  private getValidChatIds(rawId: string): string[] {
    const chatIds = rawId
      .split(',')
      .map((id) => id.trim())
      .filter((id) => {
        const isValid = /^-?\d+$/.test(id);
        if (!isValid) {
          console.warn(`Invalid Telegram chat ID: ${id}`);
        }
        return isValid;
      });

    if (chatIds.length === 0) {
      throw new Error('No valid Telegram chat IDs provided');
    }

    return chatIds;
  }

  /**
   * Escape Markdown special characters
   * @private
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~>#+=|{}.!@\\-])/g, '\\$1');
  }

  /**
   * Format message to Telegram MarkdownV2 format
   * @private
   */
  private format(message: ParsedMessage): string {
    const { from, to, subject, text, date } = message;

    const sections = [
      `*From:* ${this.escapeMarkdown(from)}`,
      `*To:* ${this.escapeMarkdown(to)}`,
      `*Subject:* ${this.escapeMarkdown(subject)}`,
    ];

    // Add date information if exists
    if (date) {
      sections.push(`*Date:* ${this.escapeMarkdown(date.toLocaleString())}`);
    }

    // Add message body
    sections.push('', this.escapeMarkdown(text).replace(/\n{2,}/g, '\n'));

    return sections.join('\n');
  }

  /**
   * Send message to Telegram
   * @param message Parsed message object
   * @returns Promise<PromiseSettledResult<Response>[]>
   */
  async send(message: ParsedMessage): Promise<PromiseSettledResult<Response>[]> {
    const { chatIds, apiUrl } = this;
    const formattedText = this.format(message);

    const promises = chatIds.map(async (chatId) => {
      const body = {
        chat_id: chatId,
        text: formattedText,
        parse_mode: 'MarkdownV2',
      };

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Telegram API error for chat ${chatId}: ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`,
          );
        }
        return response;
      } catch (error) {
        console.error(`Failed to send Telegram message to ${chatId}:`, JSON.stringify(body), error);
        return new Response(JSON.stringify({ error: `Failed to send message to ${chatId}` }), { status: 500 });
      }
    });

    return Promise.allSettled(promises);
  }
}
