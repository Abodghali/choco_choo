# ربط Supabase وVercel

1. افتح مشروع Supabase ثم SQL Editor ثم New query.
2. انسخ محتوى `supabase/setup.sql` بالكامل وشغله باستخدام Run. ينشئ الجداول والدوال والصلاحيات والقائمة الحالية وإعدادات المتجر. يمكن تشغيله مجدداً دون مسح البيانات أو استبدال إعداداتك. لا ينقل الطلبات التجريبية القديمة.
3. من Connect أو إعدادات Data API انسخ Project URL. من Settings > API Keys أنشئ أو انسخ Secret key (يبدأ عادة sb_secret_). لا تستخدم Publishable أو anon ولا كلمة مرور قاعدة البيانات.
4. في Vercel > Settings > Environment Variables أضف للبيئة Production:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET
APP_URL=https://YOUR_SITE.vercel.app
```

يبقى ADMIN_PASSWORD وJWT_SECRET كما ضبطتهما في Vercel. المفتاح القديم service_role مدعوم اختيارياً باسم SUPABASE_SERVICE_ROLE_KEY؛ لا تحتاجه إذا أضفت SUPABASE_SECRET_KEY.
لا تضف NEXT_PUBLIC_ لأي مفتاح سري. لا ترسل المفاتيح في المحادثة.
5. ارفع التعديلات الجديدة إلى GitHub ثم أعد النشر على Vercel. يجب أن يحتوي commit على supabase/setup.sql وتعديلات src وpackage.json وpackage-lock.json.
6. ادخل /admin باسم yaman. اختبر حفظ تعديل في القائمة ثم تحديث الصفحة، وإنشاء طلب نقدي والتحقق من ظهوره في choco_orders داخل Supabase وفي لوحة الإدارة. لا تختبر المدفوعات الحقيقية قبل نجاح ذلك.
7. للتجربة محلياً مع نفس قاعدة البيانات أضف المتغيرين إلى .env.local وأعد تشغيل الخادم. حينها تكون تعديلاتك المحلية على نفس البيانات المنشورة؛ استعمل مشروعاً منفصلاً للاختبارات المستقلة.

## تصميم التخزين

choco_store للقائمة والإعدادات، choco_orders صف لكل طلب، choco_order_counters للترقيم اليومي بتوقيت براغ. الكتابة تتم من خادم Next.js بمفتاح سري؛ لا توجد صلاحيات anon أو authenticated لهذه الجداول والدوال. عند إعداد Supabase لا يستعمل الموقع قفل الملفات المحلي ولا يعود إلى التخزين المحلي عند فشل الخدمة. على Vercel تكون إعدادات Supabase مطلوبة.

اختبارات محلية: npm run test:security وnpm run test:supabase وnpm run typecheck وnpm run build. اختبار SQL يستخدم PostgreSQL محلياً عبر PGlite ولا يتصل بحسابك. يلزم التحقق الفعلي بعد تشغيل SQL وإضافة المتغيرات.

تحديد المعدل ما زال لكل عملية خادم، وتأكيد المدفوعات يعتمد على فتح العميل أو الإدارة؛ قبل استقبال حجم كبير من العمليات يلزم تحديد معدل مشترك وإشعارات دفع أو تحقق دوري مستقل.
