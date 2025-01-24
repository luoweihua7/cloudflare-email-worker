import PostalMime from 'postal-mime';

export type EmailType = 'text' | 'markdown';

export interface ParsedMessage {
  from: string; // Email sender
  to: string; // Email recipient
  subject: string; // Email subject
  text: string; // Plain text content
  html?: string; // HTML content
  date?: Date; // Send timestamp
  messageId?: string; // Email message ID
  inReplyTo?: string; // Reply to message ID
  references?: string[]; // Related message ID list
  toText(): string;
  toMarkdown(): string;
}

interface MessageConfig {
  whitelist: string;
  codeKeywords: string;
}

export default class MessageHelper {
  private readonly whitelistItems: string[];
  private readonly codeKeywords: string[];
  private static readonly CODE_PATTERN = /\b\d[\d\s]{4,}\d\b/g;

  /**
   * Create message helper instance
   * @param config Message configuration
   * @throws {Error} Throws error when required configuration is missing
   */
  constructor({ whitelist, codeKeywords }: MessageConfig) {
    if (!whitelist) {
      throw new Error('Email whitelist is required');
    }
    if (!codeKeywords) {
      throw new Error('Code keywords are required');
    }

    this.whitelistItems = this.normalizeConfigList(whitelist);
    this.codeKeywords = this.normalizeConfigList(codeKeywords);
  }

  /**
   * Check if sender is in whitelist
   * @param from Sender address
   * @returns Whether in whitelist
   */
  isWhitelisted(from: string): boolean {
    const emailLower = from.toLowerCase();

    return this.whitelistItems.some((item) => {
      if (item.includes('@')) {
        return emailLower === item;
      }
      return emailLower.endsWith(`@${item}`) || emailLower.endsWith(`.${item}`);
    });
  }

  /**
   * Parse email content
   * @param message Forwardable email message
   * @returns Parsed message content
   */
  async parse(message: ForwardableEmailMessage): Promise<ParsedMessage> {
    const parser = new PostalMime();
    const rawEmail = new Response(message.raw);
    const email = await parser.parse(await rawEmail.arrayBuffer());

    const text = email.text || email.html?.replace(/<[^>]*>/g, '') || 'No Content';

    return {
      from: email.sender?.address || email.from?.address || message.from || 'Unknown Sender',
      to: email.to?.map((t) => t.text).join(', ') || message.to || 'Unknown Recipient',
      subject: email.subject || 'No Subject',
      text: this.processText(text),
      html: email.html,
      date: email.date ? new Date(email.date) : undefined,
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      references: email.references,
      toText: function (): string {
        const sections = [`From: ${this.from}`, `To: ${this.to}`, `Subject: ${this.subject}`];

        if (this.date) {
          sections.push(`Date: ${this.date.toLocaleString()}`);
        }

        sections.push('', this.text.replace(/\n{2,}/g, '\n\n').replace(/```/g, ''));

        return sections.join('\n');
      },
      toMarkdown: function (): string {
        const sections = [`**From:** ${this.from}`, `**To:** ${this.to}`, `**Subject:** ${this.subject}`];

        if (this.date) {
          sections.push(`**Date:** ${this.date.toLocaleString()}`);
        }

        sections.push('', this.text.replace(/\n{2,}/g, '\n\n'));

        return sections.join('\n');
      },
    };
  }

  /**
   * Normalize configuration list
   * @private
   */
  private normalizeConfigList(input: string): string[] {
    return input
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  /**
   * Process verification code text
   */
  processText(text: string, type: EmailType = 'markdown'): string {
    let processedText = text;
    const hasCodeKeyword = this.codeKeywords.some((keyword) => text.toLowerCase().includes(keyword));

    if (hasCodeKeyword) {
      const codes = text.match(MessageHelper.CODE_PATTERN);
      if (codes) {
        codes.map((code) => {
          const newCode = code.replace(/\s+/g, '');
          processedText = processedText.replace(code, type === 'text' ? newCode : ['```', newCode, '```'].join('\n'));
          console.log(`Verification code: ${newCode}`);
          return newCode;
        });
      }
    }

    return processedText;
  }
}
