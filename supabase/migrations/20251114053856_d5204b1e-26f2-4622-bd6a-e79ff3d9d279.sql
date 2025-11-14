-- Çok dilli mesaj şablonları tablosu
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  template_key TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'tr',
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agency_id, template_key, language)
);

-- RLS politikaları
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can view own templates"
ON public.message_templates
FOR SELECT
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Agencies can manage own templates"
ON public.message_templates
FOR ALL
USING (
  agency_id = get_user_agency_id(auth.uid()) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Updated_at trigger
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Varsayılan şablonlar ekle (tüm dillerde)
INSERT INTO public.message_templates (agency_id, template_key, language, subject, content, variables) VALUES
-- Türkçe Şablonlar
('00000000-0000-0000-0000-000000000000', 'reservation_confirmed', 'tr', 'Rezervasyon Onayı', 
'Merhaba {full_name}! 🎉

{tour_name} turunuz için rezervasyonunuz onaylandı.

📅 Tarih: {date}
👥 Kişi Sayısı: {pax}
💰 Toplam Tutar: {total_amount} {currency}

Tur detayları ve toplanma bilgileri tur tarihinden önce tarafınıza iletilecektir.

Sorularınız için bizimle iletişime geçebilirsiniz.

İyi günler! 🌟', 
'["full_name", "tour_name", "date", "pax", "total_amount", "currency"]'::jsonb),

('00000000-0000-0000-0000-000000000000', 'reservation_cancelled', 'tr', 'Rezervasyon İptali',
'Merhaba {full_name},

{tour_name} turunuz için rezervasyonunuz iptal edilmiştir.

📅 İptal Edilen Tarih: {date}
👥 Kişi Sayısı: {pax}

İptal politikamız gereği iade işlemleri 5-7 iş günü içinde hesabınıza yansıyacaktır.

Başka bir konuda yardımcı olabilirsek lütfen bizimle iletişime geçin.

İyi günler.', 
'["full_name", "tour_name", "date", "pax"]'::jsonb),

('00000000-0000-0000-0000-000000000000', 'payment_reminder', 'tr', 'Ödeme Hatırlatma',
'Merhaba {full_name},

{tour_name} turunuz için ödemenizi bekliyoruz.

📅 Tur Tarihi: {date}
💰 Ödenecek Tutar: {amount} {currency}
⏰ Son Ödeme Tarihi: {payment_deadline}

Ödeme yapmak için: {payment_link}

Sorularınız için bizimle iletişime geçebilirsiniz.', 
'["full_name", "tour_name", "date", "amount", "currency", "payment_deadline", "payment_link"]'::jsonb),

('00000000-0000-0000-0000-000000000000', 'tour_reminder', 'tr', 'Tur Hatırlatma',
'Merhaba {full_name}! 🎊

{tour_name} turunuz yaklaşıyor!

📅 Tur Tarihi: {date}
⏰ Toplanma Saati: {meeting_time}
📍 Toplanma Yeri: {meeting_point}

Lütfen zamanında toplanma noktasında olun. Gecikme durumunda bizimle iletişime geçin.

İyi yolculuklar! ✈️', 
'["full_name", "tour_name", "date", "meeting_time", "meeting_point"]'::jsonb),

-- İngilizce Şablonlar
('00000000-0000-0000-0000-000000000000', 'reservation_confirmed', 'en', 'Reservation Confirmation',
'Hello {full_name}! 🎉

Your reservation for {tour_name} has been confirmed.

📅 Date: {date}
👥 Number of People: {pax}
💰 Total Amount: {total_amount} {currency}

Tour details and meeting information will be sent to you before the tour date.

Feel free to contact us if you have any questions.

Have a great day! 🌟', 
'["full_name", "tour_name", "date", "pax", "total_amount", "currency"]'::jsonb),

('00000000-0000-0000-0000-000000000000', 'reservation_cancelled', 'en', 'Reservation Cancellation',
'Hello {full_name},

Your reservation for {tour_name} has been cancelled.

📅 Cancelled Date: {date}
👥 Number of People: {pax}

According to our cancellation policy, refund will be processed within 5-7 business days.

Please contact us if we can help you with anything else.

Best regards.', 
'["full_name", "tour_name", "date", "pax"]'::jsonb),

('00000000-0000-0000-0000-000000000000', 'payment_reminder', 'en', 'Payment Reminder',
'Hello {full_name},

We are waiting for your payment for {tour_name}.

📅 Tour Date: {date}
💰 Amount Due: {amount} {currency}
⏰ Payment Deadline: {payment_deadline}

To make payment: {payment_link}

Feel free to contact us if you have any questions.', 
'["full_name", "tour_name", "date", "amount", "currency", "payment_deadline", "payment_link"]'::jsonb),

('00000000-0000-0000-0000-000000000000', 'tour_reminder', 'en', 'Tour Reminder',
'Hello {full_name}! 🎊

Your {tour_name} tour is coming up!

📅 Tour Date: {date}
⏰ Meeting Time: {meeting_time}
📍 Meeting Point: {meeting_point}

Please be at the meeting point on time. Contact us in case of delay.

Have a great trip! ✈️', 
'["full_name", "tour_name", "date", "meeting_time", "meeting_point"]'::jsonb),

-- Almanca Şablonlar
('00000000-0000-0000-0000-000000000000', 'reservation_confirmed', 'de', 'Reservierungsbestätigung',
'Hallo {full_name}! 🎉

Ihre Reservierung für {tour_name} wurde bestätigt.

📅 Datum: {date}
👥 Anzahl der Personen: {pax}
💰 Gesamtbetrag: {total_amount} {currency}

Tourdetails und Treffpunktinformationen werden Ihnen vor dem Tourdatum zugeschickt.

Bei Fragen können Sie sich gerne an uns wenden.

Schönen Tag! 🌟', 
'["full_name", "tour_name", "date", "pax", "total_amount", "currency"]'::jsonb),

('00000000-0000-0000-0000-000000000000', 'reservation_cancelled', 'de', 'Reservierungsstornierung',
'Hallo {full_name},

Ihre Reservierung für {tour_name} wurde storniert.

📅 Storniertes Datum: {date}
👥 Anzahl der Personen: {pax}

Gemäß unserer Stornierungsbedingungen wird die Rückerstattung innerhalb von 5-7 Werktagen bearbeitet.

Bitte kontaktieren Sie uns, wenn wir Ihnen anderweitig helfen können.

Mit freundlichen Grüßen.', 
'["full_name", "tour_name", "date", "pax"]'::jsonb),

-- Fransızca Şablonlar
('00000000-0000-0000-0000-000000000000', 'reservation_confirmed', 'fr', 'Confirmation de réservation',
'Bonjour {full_name}! 🎉

Votre réservation pour {tour_name} a été confirmée.

📅 Date: {date}
👥 Nombre de personnes: {pax}
💰 Montant total: {total_amount} {currency}

Les détails de la visite et les informations de rendez-vous vous seront envoyés avant la date de la visite.

N''hésitez pas à nous contacter si vous avez des questions.

Bonne journée! 🌟', 
'["full_name", "tour_name", "date", "pax", "total_amount", "currency"]'::jsonb),

-- İspanyolca Şablonlar
('00000000-0000-0000-0000-000000000000', 'reservation_confirmed', 'es', 'Confirmación de reserva',
'¡Hola {full_name}! 🎉

Su reserva para {tour_name} ha sido confirmada.

📅 Fecha: {date}
👥 Número de personas: {pax}
💰 Monto total: {total_amount} {currency}

Los detalles del tour y la información del punto de encuentro se le enviarán antes de la fecha del tour.

No dude en contactarnos si tiene alguna pregunta.

¡Que tenga un gran día! 🌟', 
'["full_name", "tour_name", "date", "pax", "total_amount", "currency"]'::jsonb),

-- Rusça Şablonlar
('00000000-0000-0000-0000-000000000000', 'reservation_confirmed', 'ru', 'Подтверждение бронирования',
'Здравствуйте, {full_name}! 🎉

Ваше бронирование на {tour_name} подтверждено.

📅 Дата: {date}
👥 Количество человек: {pax}
💰 Общая сумма: {total_amount} {currency}

Детали тура и информация о месте встречи будут отправлены вам перед датой тура.

Если у вас есть вопросы, свяжитесь с нами.

Хорошего дня! 🌟', 
'["full_name", "tour_name", "date", "pax", "total_amount", "currency"]'::jsonb),

-- Arapça Şablonlar
('00000000-0000-0000-0000-000000000000', 'reservation_confirmed', 'ar', 'تأكيد الحجز',
'مرحباً {full_name}! 🎉

تم تأكيد حجزك لـ {tour_name}.

📅 التاريخ: {date}
👥 عدد الأشخاص: {pax}
💰 المبلغ الإجمالي: {total_amount} {currency}

سيتم إرسال تفاصيل الجولة ومعلومات نقطة الالتقاء إليك قبل تاريخ الجولة.

لا تتردد في الاتصال بنا إذا كان لديك أي أسئلة.

يوم سعيد! 🌟', 
'["full_name", "tour_name", "date", "pax", "total_amount", "currency"]'::jsonb);