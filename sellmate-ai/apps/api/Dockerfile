# syntax=docker/dockerfile:1
# ---------- SellMate AI — Backend (NestJS + Prisma) ----------
# صورة إنتاج متعدّدة المراحل. سياق البناء = مجلد apps/api.

FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ---- تبعيات الإنتاج فقط + توليد عميل Prisma ----
FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate

# ---- بناء التطبيق (يحتاج تبعيات التطوير) ----
FROM base AS build
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npx prisma generate && npm run build

# ---- صورة التشغيل النهائية ----
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p storage/uploads
EXPOSE 4000
# يهيّئ قاعدة البيانات (migrate deploy أو db push) ثم يشغّل الخادم.
# PORT تضبطه المنصّة (Railway) تلقائيًا.
CMD ["./docker-entrypoint.sh"]
