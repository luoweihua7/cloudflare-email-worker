import type { ParsedMessage } from '../helper';

interface WeComConfig {
  guid: string; // Support multiple GUIDs, separated by commas
}

export default class WeComMessage {
  private readonly webhookUrls: string[];

  constructor({ guid }: WeComConfig) {
    if (!guid) {
      throw new Error('WeCom bot GUID is required');
    }

    this.webhookUrls = this.getValidWebhookUrls(guid);
  }

  private getValidWebhookUrls(rawGuid: string): string[] {
    const guids = rawGuid
      .split(',')
      .map((id) => id.trim())
      .filter((id) => {
        // WeCom bot GUID should be a UUID format string
        const isValid = /^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(id);
        if (!isValid) {
          console.warn(`Invalid WeCom bot GUID: ${id}`);
        }
        return isValid;
      });

    if (guids.length === 0) {
      throw new Error('No valid WeCom bot GUIDs provided');
    }

    return guids.map((guid) => `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${guid}`);
  }

  /**
   * Format message to Markdown format
   * @private
   */
  private format(message: ParsedMessage): string {
    const { from, to, subject, text, date } = message;

    const sections = [`**From:** ${from}`, `**To:** ${to}`, `**Subject:** ${subject}`];

    if (date) {
      sections.push(`**Date:** ${date.toLocaleString()}`);
    }

    // Add message body with original format
    sections.push('', text);

    return sections.join('\n');
  }

  /**
   * Send message to WeCom
   * @param message Parsed message object
   * @returns Promise<PromiseSettledResult<Response>[]>
   */
  async send(message: ParsedMessage): Promise<PromiseSettledResult<Response>[]> {
    const formattedText = this.format(message);

    const promises = this.webhookUrls.map(async (webhookUrl) => {
      const body = {
        msgtype: 'markdown',
        markdown: {
          content: formattedText,
        },
      };

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`WeCom API error: ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`);
        }
        return response;
      } catch (error) {
        console.error('Failed to send WeCom message:', error);
        return new Response(JSON.stringify({ error: 'Failed to send message' }), { status: 500 });
      }
    });

    return Promise.allSettled(promises);
  }
}
