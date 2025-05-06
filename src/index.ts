import { Bot } from './bot';
import MessageHelper from './helper';

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    const { from = '', to = '' } = message;
    const { EMAIL_WHITELIST, CODE_KEYWORDS, FORWARD_TO } = env;
    console.log(`Handle message from ${from} to ${to}`);

    const helper = new MessageHelper({
      whitelist: EMAIL_WHITELIST,
      codeKeywords: CODE_KEYWORDS,
    });

    if (!helper.checkIsWhitelist(from)) {
      console.log(`Email from ${from} is not in whitelist, forwarding only`);
      await helper.forwardMessage(FORWARD_TO, message);
      return;
    }

    try {
      const parsedMessage = await helper.parse(message);

      // Create Bot instance and send message
      const bot = new Bot(env);
      await bot.send(parsedMessage);
    } catch (error) {
      console.error('Failed to process email: ', error);
    }

    console.log(`Forwarding email to ${FORWARD_TO}`);
    await helper.forwardMessage(FORWARD_TO, message);
    console.log(`Message sent successfully to ${FORWARD_TO}`);
  },
} satisfies ExportedHandler<Env>;
