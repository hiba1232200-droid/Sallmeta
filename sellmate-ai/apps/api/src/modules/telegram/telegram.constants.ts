/** أوامر البوت الظاهرة في قائمة تيليجرام. */
export const BOT_COMMANDS = [
  { command: 'start', description: 'ابدأ' },
  { command: 'help', description: 'المساعدة' },
  { command: 'products', description: 'تصفّح المنتجات' },
  { command: 'order', description: 'إنشاء طلب' },
  { command: 'orders', description: 'طلباتي' },
  { command: 'support', description: 'الدعم' },
  { command: 'settings', description: 'الإعدادات' },
];

/** بادئات بيانات الأزرار الضمنية (inline callback_data) — قصيرة (< 64 بايت). */
export const CB = {
  MENU: 'menu',
  PRODUCTS_PAGE: 'pg', // pg:<offset>
  PRODUCT: 'p', // p:<productId>
  BUY: 'buy', // buy:<productId>
  MY_ORDERS: 'myorders',
  SUPPORT: 'support',
  HELP: 'help',
  AI_ON: 'ai_on',
  AI_OFF: 'ai_off',
  STATS: 'stats',
};

/** نصوص أزرار Reply Keyboard (تُطابَق في معالج النص). */
export const BTN = {
  // العميل
  PRODUCTS: '🛍️ المنتجات',
  SEARCH: '🔎 بحث',
  MY_ORDERS: '📦 طلباتي',
  SUPPORT: '🆘 الدعم',
  // المالك
  STATS: '📊 الإحصائيات',
  ORDERS_ADMIN: '📦 الطلبات',
  ASSISTANT: '🤖 المساعد',
  SETTINGS: '⚙️ الإعدادات',
};
