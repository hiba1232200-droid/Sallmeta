import { TelegramDispatcher } from '../../src/modules/telegram/telegram.dispatcher';

/**
 * تكامل خط معالجة محادثة الذكاء (Identify → limits → AI → validate → send).
 * نستدعي processAi عبر cast لاختبار التنسيق بين الوحدات بمعزل عن HTTP.
 */
describe('AI conversation pipeline (TelegramDispatcher.processAi)', () => {
  let deps: Record<string, any>;
  let dispatcher: TelegramDispatcher;
  let ctx: any;

  beforeEach(() => {
    deps = {
      prisma: {},
      config: { get: jest.fn().mockReturnValue('http://localhost:3000') },
      merchants: {},
      products: {},
      orders: {},
      conversations: { addMessage: jest.fn().mockResolvedValue({}), setStatus: jest.fn().mockResolvedValue({}) },
      usage: { assertWithinMessageLimit: jest.fn().mockResolvedValue(undefined), increment: jest.fn().mockResolvedValue(undefined) },
      analytics: {},
      agent: { process: jest.fn() },
      notifications: { humanAssistance: jest.fn().mockResolvedValue(undefined) },
    };
    dispatcher = new TelegramDispatcher(
      deps.prisma,
      deps.config,
      deps.merchants,
      deps.products,
      deps.orders,
      deps.conversations,
      deps.usage,
      deps.analytics,
      deps.agent,
      deps.notifications,
    );
    ctx = {
      tg: { sendMessage: jest.fn().mockResolvedValue({}), sendChatAction: jest.fn().mockResolvedValue({}) },
      bot: { ownerChatId: 'owner-chat' },
      merchantId: 'store-A',
      chatId: '999',
      isOwner: false,
      customer: { id: 'cust-1' },
      conversationId: 'conv-1',
      conversationStatus: 'AI_ACTIVE',
    };
  });

  const run = (text = 'بدي سماعة') => (dispatcher as any).processAi(ctx, text);

  it('stops and warns when the monthly message limit is reached', async () => {
    deps.usage.assertWithinMessageLimit.mockRejectedValue(new Error('limit'));
    await run();
    expect(ctx.tg.sendMessage).toHaveBeenCalledTimes(1); // رسالة بلوغ الحد
    expect(deps.agent.process).not.toHaveBeenCalled();
  });

  it('logs the customer + assistant messages and replies', async () => {
    deps.agent.process.mockResolvedValue({
      reply: 'السماعة متوفرة بسعر 45$',
      disabled: false,
      handoff: false,
      createdOrder: null,
      toolTrace: [],
      validated: true,
    });
    await run();
    expect(deps.conversations.addMessage).toHaveBeenCalledTimes(2); // CUSTOMER + ASSISTANT
    expect(ctx.tg.sendMessage).toHaveBeenCalledWith('999', 'السماعة متوفرة بسعر 45$', expect.anything());
    expect(deps.usage.increment).toHaveBeenCalledWith('store-A', 'TELEGRAM_MESSAGE');
  });

  it('escalates to a human on handoff (status + owner notification)', async () => {
    deps.agent.process.mockResolvedValue({ reply: 'سأحوّلك لموظف', disabled: false, handoff: true });
    await run();
    expect(deps.conversations.setStatus).toHaveBeenCalledWith('store-A', 'conv-1', 'WAITING_FOR_HUMAN');
    expect(deps.notifications.humanAssistance).toHaveBeenCalledWith(
      'store-A',
      expect.objectContaining({ customerId: 'cust-1', conversationId: 'conv-1' }),
    );
  });

  it('shows a disabled message when the assistant is turned off', async () => {
    deps.agent.process.mockResolvedValue({ disabled: true });
    await run();
    expect(ctx.tg.sendMessage).toHaveBeenCalledTimes(1);
    // لا يُسجّل ردّ المساعد لأنه معطّل
    expect(deps.conversations.addMessage).toHaveBeenCalledTimes(1); // رسالة العميل فقط
  });
});
