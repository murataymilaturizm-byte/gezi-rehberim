// Stage-aware AI fallback mesajları — AI 529/timeout/network fail durumunda kullanılır.
// Demo-chat/chat-handler.ts buildFallbackResponse() ile eşdeğer.

import type { ConversationStage, ConversationContext } from "../fsm/types.ts";

export function buildAIFallbackResponse(context: ConversationContext, agencyPhone?: string): string {
  const lang = context.language || "tr";
  const phone = agencyPhone ? ` 📞 ${agencyPhone}` : "";

  const msgs: Record<string, Record<ConversationStage | "default", string>> = {
    tr: {
      GREETING:         `Merhaba! 😊 Sistemimizde anlık bir yoğunluk var. Lütfen bir dakika sonra tekrar yazın${phone ? " veya bizi arayın:" + phone : ""}.`,
      BROWSING:         `Şu an cevap vermekte güçlük çekiyorum. 🙏 Birkaç dakika sonra tekrar yazabilirsiniz${phone ? " ya da bizi arayabilirsiniz:" + phone : ""}.`,
      TOUR_SELECTED:    `Tur bilginizi aldım ancak şu an işlem yapamıyorum. 🙏 Lütfen birkaç dakika sonra tekrar yazın${phone ? " veya arayın:" + phone : ""}.`,
      COLLECTING_INFO:  `Bilgilerinizi alıyorum ama geçici bir sorun var. 🙏 Lütfen mesajınızı tekrar gönderin${phone ? " veya bizi arayın:" + phone : ""}.`,
      CONFIRMING:       `Onayınızı işlemek için bir dakikamız gerekiyor. 🙏 Lütfen tekrar \"evet\" yazın${phone ? " veya bizi arayın:" + phone : ""}.`,
      COMPLETED:        `Teşekkürler! 😊 Başka bir sorunuz varsa lütfen yazın.`,
      DATE_SELECTION:   `Tarih seçiminizi alamadım. 🙏 Lütfen tekrar yazın.`,
      ASKING_NEW_RESERVATION: `Anlık bir yoğunluk var. 🙏 Birkaç dakika sonra tekrar yazabilirsiniz.`,
      default:          `Şu an cevap veremiyorum. 🙏 Lütfen birkaç dakika sonra tekrar deneyin${phone ? " veya bizi arayın:" + phone : ""}.`,
    },
    en: {
      GREETING:         `Hello! 😊 We're experiencing temporary high load. Please try again in a minute${phone ? " or call us:" + phone : ""}.`,
      BROWSING:         `I'm having trouble responding right now. 🙏 Please try again in a few minutes${phone ? " or call:" + phone : ""}.`,
      TOUR_SELECTED:    `I received your tour selection but can't process it right now. 🙏 Please try again in a few minutes.`,
      COLLECTING_INFO:  `I'm collecting your info but there's a temporary issue. 🙏 Please send your message again.`,
      CONFIRMING:       `We need a moment to process your confirmation. 🙏 Please type "yes" again${phone ? " or call:" + phone : ""}.`,
      COMPLETED:        `Thank you! 😊 Feel free to ask if you have more questions.`,
      DATE_SELECTION:   `Couldn't receive your date selection. 🙏 Please try again.`,
      ASKING_NEW_RESERVATION: `Temporary load. 🙏 Please try again in a few minutes.`,
      default:          `I can't respond right now. 🙏 Please try again in a few minutes${phone ? " or call:" + phone : ""}.`,
    },
    de: {
      GREETING:         `Hallo! 😊 Unser System ist vorübergehend ausgelastet. Bitte versuchen Sie es in einer Minute${phone ? " oder rufen Sie uns an:" + phone : ""}.`,
      BROWSING:         `Ich kann gerade nicht antworten. 🙏 Bitte in ein paar Minuten erneut versuchen.`,
      TOUR_SELECTED:    `Ich habe Ihre Tour erhalten, kann sie aber gerade nicht verarbeiten. 🙏 Bitte erneut versuchen.`,
      COLLECTING_INFO:  `Ich erfasse Ihre Daten, aber es gibt ein vorübergehendes Problem. 🙏 Bitte Nachricht erneut senden.`,
      CONFIRMING:       `Wir brauchen einen Moment. 🙏 Bitte tippen Sie "ja" erneut.`,
      COMPLETED:        `Vielen Dank! 😊 Schreiben Sie uns bei weiteren Fragen.`,
      DATE_SELECTION:   `Datumsauswahl nicht erhalten. 🙏 Bitte erneut versuchen.`,
      ASKING_NEW_RESERVATION: `Vorübergehende Auslastung. 🙏 Bitte in ein paar Minuten erneut versuchen.`,
      default:          `Ich kann gerade nicht antworten. 🙏 Bitte in ein paar Minuten erneut versuchen.`,
    },
    ru: {
      GREETING:         `Здравствуйте! 😊 У нас временная нагрузка. Попробуйте через минуту${phone ? " или позвоните нам:" + phone : ""}.`,
      BROWSING:         `Не могу ответить прямо сейчас. 🙏 Попробуйте через несколько минут.`,
      TOUR_SELECTED:    `Получил информацию о туре, но не могу обработать сейчас. 🙏 Попробуйте через минуты.`,
      COLLECTING_INFO:  `Собираю ваши данные, но есть временная проблема. 🙏 Отправьте сообщение ещё раз.`,
      CONFIRMING:       `Нам нужна минута. 🙏 Напишите "да" ещё раз.`,
      COMPLETED:        `Спасибо! 😊 Пишите, если будут вопросы.`,
      DATE_SELECTION:   `Не получил выбор даты. 🙏 Попробуйте ещё раз.`,
      ASKING_NEW_RESERVATION: `Временная нагрузка. 🙏 Попробуйте через несколько минут.`,
      default:          `Не могу ответить сейчас. 🙏 Попробуйте через несколько минут.`,
    },
    ar: {
      GREETING:         `مرحباً! 😊 نظامنا مشغول مؤقتاً. يرجى المحاولة بعد دقيقة${phone ? " أو اتصل بنا:" + phone : ""}.`,
      BROWSING:         `لا أستطيع الرد الآن. 🙏 يرجى المحاولة بعد دقائق.`,
      TOUR_SELECTED:    `استلمت معلومات الجولة لكن لا أستطيع معالجتها الآن. 🙏 يرجى المحاولة لاحقاً.`,
      COLLECTING_INFO:  `أجمع بياناتك لكن هناك مشكلة مؤقتة. 🙏 يرجى إرسال رسالتك مرة أخرى.`,
      CONFIRMING:       `نحتاج لحظة. 🙏 يرجى كتابة "نعم" مرة أخرى.`,
      COMPLETED:        `شكراً! 😊 اكتب إذا كان لديك أسئلة أخرى.`,
      DATE_SELECTION:   `لم أستلم اختيار التاريخ. 🙏 يرجى المحاولة مرة أخرى.`,
      ASKING_NEW_RESERVATION: `حمل مؤقت. 🙏 يرجى المحاولة بعد دقائق.`,
      default:          `لا أستطيع الرد الآن. 🙏 يرجى المحاولة بعد دقائق.`,
    },
    fr: {
      GREETING:         `Bonjour! 😊 Notre système est temporairement surchargé. Réessayez dans une minute${phone ? " ou appelez:" + phone : ""}.`,
      BROWSING:         `Je ne peux pas répondre maintenant. 🙏 Réessayez dans quelques minutes.`,
      TOUR_SELECTED:    `J'ai reçu votre sélection mais ne peux pas la traiter maintenant. 🙏 Réessayez dans quelques minutes.`,
      COLLECTING_INFO:  `Je recueille vos données mais il y a un problème temporaire. 🙏 Renvoyez votre message.`,
      CONFIRMING:       `Nous avons besoin d'un moment. 🙏 Tapez "oui" à nouveau.`,
      COMPLETED:        `Merci! 😊 Écrivez si vous avez d'autres questions.`,
      DATE_SELECTION:   `Sélection de date non reçue. 🙏 Réessayez.`,
      ASKING_NEW_RESERVATION: `Surcharge temporaire. 🙏 Réessayez dans quelques minutes.`,
      default:          `Je ne peux pas répondre maintenant. 🙏 Réessayez dans quelques minutes.`,
    },
    es: {
      GREETING:         `¡Hola! 😊 Nuestro sistema tiene carga temporal. Intente en un minuto${phone ? " o llámenos:" + phone : ""}.`,
      BROWSING:         `No puedo responder ahora. 🙏 Intente en unos minutos.`,
      TOUR_SELECTED:    `Recibí su selección pero no puedo procesarla ahora. 🙏 Intente en unos minutos.`,
      COLLECTING_INFO:  `Recojo sus datos pero hay un problema temporal. 🙏 Envíe su mensaje de nuevo.`,
      CONFIRMING:       `Necesitamos un momento. 🙏 Escriba "sí" de nuevo.`,
      COMPLETED:        `¡Gracias! 😊 Escriba si tiene más preguntas.`,
      DATE_SELECTION:   `No recibí la selección de fecha. 🙏 Intente de nuevo.`,
      ASKING_NEW_RESERVATION: `Carga temporal. 🙏 Intente en unos minutos.`,
      default:          `No puedo responder ahora. 🙏 Intente en unos minutos.`,
    },
  };

  const langMsgs = msgs[lang as keyof typeof msgs] ?? msgs.tr;
  return (langMsgs[context.stage as keyof typeof langMsgs] ?? langMsgs.default) as string;
}
