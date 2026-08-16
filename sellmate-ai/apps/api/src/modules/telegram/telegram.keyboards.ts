import { Product } from '@prisma/client';
import { BTN, CB } from './telegram.constants';

/** لوحة أزرار العميل الدائمة. */
export function customerReplyKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: BTN.PRODUCTS }, { text: BTN.SEARCH }],
        [{ text: BTN.MY_ORDERS }, { text: BTN.SUPPORT }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    },
  };
}

/** لوحة أزرار المالك الدائمة. */
export function ownerReplyKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: BTN.STATS }, { text: BTN.ORDERS_ADMIN }],
        [{ text: BTN.ASSISTANT }, { text: BTN.SETTINGS }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    },
  };
}

/** قائمة العميل الضمنية (inline). */
export function customerMenuInline() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍️ تصفّح المنتجات', callback_data: `${CB.PRODUCTS_PAGE}:0` }],
        [
          { text: '📦 طلباتي', callback_data: CB.MY_ORDERS },
          { text: '🆘 الدعم', callback_data: CB.SUPPORT },
        ],
      ],
    },
  };
}

/** قائمة المالك الضمنية (inline) مع روابط لوحة التحكم. */
export function ownerMenuInline(appUrl: string, assistantEnabled: boolean) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 إحصائيات المتجر', callback_data: CB.STATS }],
        [
          {
            text: assistantEnabled ? '🤖 إيقاف المساعد' : '🤖 تشغيل المساعد',
            callback_data: assistantEnabled ? CB.AI_OFF : CB.AI_ON,
          },
        ],
        [
          { text: '🧩 لوحة التحكم', url: appUrl },
          { text: '⚙️ إعداد المساعد', url: `${appUrl}/settings` },
        ],
      ],
    },
  };
}

/** قائمة منتجات مع أزرار وتنقّل صفحات. */
export function productsInline(
  items: Product[],
  currency: string,
  offset: number,
  limit: number,
  total: number,
) {
  const rows: any[] = items.map((p) => [
    { text: `${p.name} — ${p.price} ${currency}`, callback_data: `${CB.PRODUCT}:${p.id}` },
  ]);
  const nav: any[] = [];
  if (offset > 0) {
    nav.push({ text: '« السابق', callback_data: `${CB.PRODUCTS_PAGE}:${Math.max(0, offset - limit)}` });
  }
  if (offset + limit < total) {
    nav.push({ text: 'التالي »', callback_data: `${CB.PRODUCTS_PAGE}:${offset + limit}` });
  }
  if (nav.length) {
    rows.push(nav);
  }
  return { reply_markup: { inline_keyboard: rows } };
}

/** أزرار تفاصيل منتج. */
export function productDetailInline(productId: string) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 اطلب الآن', callback_data: `${CB.BUY}:${productId}` }],
        [{ text: '« رجوع للمنتجات', callback_data: `${CB.PRODUCTS_PAGE}:0` }],
      ],
    },
  };
}

/** أزرار إعدادات المالك الضمنية. */
export function ownerSettingsInline(appUrl: string, assistantEnabled: boolean) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: assistantEnabled ? '🤖 إيقاف المساعد' : '🤖 تشغيل المساعد',
            callback_data: assistantEnabled ? CB.AI_OFF : CB.AI_ON,
          },
        ],
        [
          { text: '🧩 لوحة التحكم', url: appUrl },
          { text: '⚙️ إعداد المساعد', url: `${appUrl}/settings` },
        ],
      ],
    },
  };
}
