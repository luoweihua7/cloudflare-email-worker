import { Bot } from './bot';
import MessageHelper from './helper';

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    const { from = '', to = '' } = message;
    console.log(`receive message from ${from} to ${to}`);

    const helper = new MessageHelper({
      whitelist: env.EMAIL_WHITELIST,
      codeKeywords: env.CODE_KEYWORDS,
    });

    if (!helper.isWhitelisted(from)) {
      console.log(`Email from ${from} is not in whitelist, forwarding only`);
      await message.forward(env.FORWARD_TO);
      return;
    }

    try {
      const parsedMessage = await helper.parse(message);

      // Create Bot instance and send message
      const bot = new Bot(env);
      await bot.send(parsedMessage);

      console.log(`forwarding email to ${env.FORWARD_TO}`);
      await message.forward(env.FORWARD_TO);
    } catch (error) {
      console.error('Failed to process email:', error);
      await message.forward(env.FORWARD_TO);
    }
  },
} satisfies ExportedHandler<Env>;
