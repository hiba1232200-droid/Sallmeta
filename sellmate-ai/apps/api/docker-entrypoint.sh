#!/bin/sh
# نقطة الدخول: تهيئة قاعدة البيانات ثم تشغيل الخادم.
# - إن وُجدت ملفات هجرات (prisma/migrations) → نطبّقها بأمان (migrate deploy).
# - وإلا (أوّل نشر بلا هجرات) → نزامن المخطط مباشرة (db push) لإنشاء الجداول.
# - DB_RESET=1 (لمرّة واحدة فقط) → إعادة ضبط القاعدة كاملةً ثم إنشاء الجداول
#   (يُستخدم لإصلاح قاعدة في حالة جزئية تالفة؛ يمسح كل البيانات — أزِل المتغيّر بعدها).
set -e

if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "[entrypoint] تطبيق الهجرات (prisma migrate deploy)..."
  npx prisma migrate deploy
elif [ "$DB_RESET" = "1" ]; then
  echo "[entrypoint] DB_RESET=1 → إعادة ضبط القاعدة وإنشاء الجداول (db push --force-reset)..."
  npx prisma db push --skip-generate --accept-data-loss --force-reset
else
  echo "[entrypoint] لا توجد هجرات — مزامنة المخطط (prisma db push)..."
  npx prisma db push --skip-generate --accept-data-loss
fi

echo "[entrypoint] تشغيل الخادم..."
exec node dist/main.js
