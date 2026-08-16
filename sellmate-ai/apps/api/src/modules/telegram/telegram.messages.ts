import { Product } from '@prisma/client';

export const ORDER_STATUS_AR: Record<string, string> = {
  PENDING: '⏳ قيد الانتظار',
  CONFIRMED: '✅ مؤكد',
  PROCESSING: '🔧 قيد التجهيز',
  SHIPPED: '🚚 تم الشحن',
  COMPLETED: '📦 مكتمل',
  CANCELLED: '❌ ملغى',
};

export function ownerWelcome(storeName: string): string {
  return [
    `👋 أهلًا بك، صاحب متجر «${storeName}».`,
    '',
    'أنت في لوحة إدارة متجرك عبر تيليجرام. من هنا يمكنك:',
    '• 📊 متابعة إحصائيات المتجر',
    '• 🤖 تشغيل/إيقاف مساعد المبيعات',
    '• 🧩 فتح لوحة التحكم الكاملة',
    '• ⚙️ ضبط إعدادات المساعد',
    '',
    'اختر من الأزرار بالأسفل.',
  ].join('\n');
}

export function customerWelcome(storeName: string, custom?: string | null): string {
  const intro = custom?.trim() || `مرحبًا بك في «${storeName}» 👋`;
  return [
    intro,
    '',
    'أنا مساعد المبيعات الذكي، وسعيد بخدمتك! يمكنني:',
    '• 🛍️ عرض منتجاتنا وأسعارها',
    '• 🔎 البحث عمّا تريده',
    '• 🛒 مساعدتك في إتمام طلبك',
    '• 📦 متابعة طلباتك',
    '',
    'كيف أقدر أساعدك اليوم؟',
  ].join('\n');
}

export function helpMessage(isOwner: boolean): string {
  const common = [
    '📖 الأوامر المتاحة:',
    '',
    '/start — البداية والقائمة الرئيسية',
    '/products — تصفّح المنتجات',
    '/order — إنشاء طلب جديد',
    '/orders — عرض طلباتك',
    '/support — التواصل مع المتجر',
    '/settings — الإعدادات',
    '/help — هذه القائمة',
  ];
  if (isOwner) {
    common.push('', 'بصفتك صاحب المتجر، يمكنك أيضًا متابعة الإحصائيات وتشغيل/إيقاف المساعد من /settings.');
  } else {
    common.push('', 'يمكنك أيضًا مراسلتي بأي سؤال وسأجيبك من معلومات المتجر مباشرة.');
  }
  return common.join('\n');
}

export function supportMessage(storeName: string, phone?: string | null, email?: string | null): string {
  const lines = [`🆘 الدعم — متجر «${storeName}»`, '', 'سنوصلك بفريق المتجر لمساعدتك.'];
  if (phone) {
    lines.push(`📞 الهاتف: ${phone}`);
  }
  if (email) {
    lines.push(`✉️ البريد: ${email}`);
  }
  if (!phone && !email) {
    lines.push('سيتواصل معك فريق المتجر في أقرب وقت.');
  }
  return lines.join('\n');
}

export function productDetail(p: Product, currency: string): string {
  const available = !p.trackInventory || p.stock > 0;
  const lines = [`🛍️ ${p.name}`, ''];
  if (p.description) {
    lines.push(p.description, '');
  }
  lines.push(`💵 السعر: ${p.price} ${currency}`);
  lines.push(available ? '✅ متوفّر' : '⛔ غير متوفّر حاليًا');
  return lines.join('\n');
}

export function ordersList(
  title: string,
  orders: Array<{ number: string; status: string; total: any; currency: string }>,
): string {
  if (!orders.length) {
    return 'لا توجد طلبات حتى الآن. تصفّح منتجاتنا عبر /products 🛍️';
  }
  const lines = [title, ''];
  for (const o of orders) {
    lines.push(`• #${o.number} — ${ORDER_STATUS_AR[o.status] ?? o.status} — ${o.total} ${o.currency}`);
  }
  return lines.join('\n');
}

export function statsMessage(o: any): string {
  return [
    '📊 إحصائيات المتجر',
    '',
    `💵 الإيرادات: ${o.revenue.total}`,
    `🧾 الطلبات: ${o.orders.total}`,
    `🛍️ المنتجات الفعّالة: ${o.products.active}`,
    `👥 العملاء: ${o.customers.total}`,
    `💬 محادثات مفتوحة: ${o.conversations.open}`,
    `🤖 رسائل المساعد (هذا الشهر): ${o.usage.aiMessages}`,
  ].join('\n');
}

export const MSG = {
  searchPrompt: '🔎 اكتب اسم المنتج أو ما تبحث عنه، وسأعرض لك ما لدينا.',
  orderPrompt: '🛒 ما المنتج والكمية التي تودّ طلبها؟\nمثال: «أريد قطعتين من القميص».',
  noProducts: 'لا توجد منتجات متاحة حاليًا. 🙏',
  productMissing: 'عذرًا، هذا المنتج غير متوفّر حاليًا.',
  assistantDisabled: 'المساعد الذكي متوقّف مؤقتًا. يمكنك تصفّح المنتجات عبر /products.',
  limitReached: 'خدمة المساعد غير متاحة مؤقتًا. يرجى المحاولة لاحقًا. 🙏',
  ownerOnly: '⚙️ هذا القسم مخصّص لصاحب المتجر.',
  assistantOn: '✅ تم تشغيل المساعد الذكي.',
  assistantOff: '⏸️ تم إيقاف المساعد الذكي.',
};
