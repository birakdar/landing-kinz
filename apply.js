/**
 * Teacher-application policy for the Kinz hiring page.
 *
 * Callers pass plain field values plus the time the form was shown.
 * This module does not read the DOM, the clock, storage, or the network.
 * `nowMs` is injected so a slow human and a fast script are judged the same way.
 *
 * A passing review does not deliver the application. `applicationLetter`
 * builds the message; the page sends it. Change the address here if hiring
 * moves to another inbox.
 */

const HIRING_EMAIL = "kinzk476@gmail.com";

export const MIN_DWELL_MS = 6000;
export const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const SUBJECTS = {
  english: "إنجليزي",
  science: "مناهج علمية",
  literary: "مناهج أدبية",
  skills: "مهارات تقنية",
  other: "أخرى",
};

export const MODES = {
  online: "أونلاين",
  home: "زيارة منزلية",
  both: "أونلاين وزيارة منزلية",
};

export const EXPERIENCE = {
  lt1: "أقل من سنة",
  y1_3: "من سنة إلى ٣ سنوات",
  y3_7: "من ٣ إلى ٧ سنوات",
  y7: "أكثر من ٧ سنوات",
};

export const QUALIFICATION = {
  student: "طالب جامعي",
  diploma: "معهد أو دبلوم",
  bachelor: "إجازة جامعية",
  master: "ماجستير أو أعلى",
};

const REFRESH = "تعذّر إرسال الطلب. حدّث الصفحة وحاول مرة أخرى.";

const JUNK_NAME = /^(test|asdf|qwerty|admin|user|name|تجربة|تجريبي)$/i;

/**
 * @param {object} input
 * @param {number} input.openedAt
 * @param {string} input.faxTrap  honeypot text; must be empty
 * @param {boolean} input.botTrap honeypot checkbox; must be false
 * @param {string} input.proof
 * @param {string} input.expectedProof word shown to the person, not stored in the field
 * @param {boolean} input.consent
 * @param {object} input.fields
 * @param {number} nowMs
 * @returns {{ ok: boolean, errors: Record<string, string> }}
 */
export function reviewApplication(input, nowMs) {
  if (trapTripped(input)) {
    return { ok: false, errors: { form: REFRESH } };
  }

  const errors = {};
  const fields = input.fields || {};

  if (!validClock(input.openedAt, nowMs)) {
    errors.form = REFRESH;
  } else if (nowMs - input.openedAt < MIN_DWELL_MS) {
    errors.form = "تمهل لحظة واقرأ الحقول، ثم أعد الإرسال.";
  } else if (nowMs - input.openedAt > MAX_AGE_MS) {
    errors.form = "انتهت صلاحية الصفحة. حدّثها ثم أعد المحاولة.";
  }

  if (!validName(asText(fields.name))) {
    errors.name = "اكتب الاسم الأول واسم العائلة.";
  }
  if (!canonicalMobile(asText(fields.phone))) {
    errors.phone = "اكتب رقم موبايل سوري، مثل 0991234567.";
  }
  if (!validCity(asText(fields.city))) {
    errors.city = "اكتب المدينة التي تستطيع التدريس فيها.";
  }

  const subjects = Array.isArray(fields.subjects) ? fields.subjects : [];
  const knownSubjects = subjects.filter((key) => Object.prototype.hasOwnProperty.call(SUBJECTS, key));
  if (knownSubjects.length === 0) {
    errors.subjects = "اختر مادة واحدة على الأقل.";
  }
  if (knownSubjects.includes("other") && !validShortLabel(asText(fields.subjectOther))) {
    errors.subjectOther = "اكتب المادة الأخرى.";
  }
  if (!Object.prototype.hasOwnProperty.call(MODES, fields.mode)) {
    errors.mode = "اختر طريقة التدريس.";
  }
  if (!Object.prototype.hasOwnProperty.call(EXPERIENCE, fields.experience)) {
    errors.experience = "اختر سنوات الخبرة.";
  }
  if (!Object.prototype.hasOwnProperty.call(QUALIFICATION, fields.qualification)) {
    errors.qualification = "اختر المؤهل.";
  }
  if (!validAbout(asText(fields.about))) {
    errors.about = "اكتب نبذة أوضح في سطرين: ماذا تدرّس، ولماذا مع كينز.";
  }
  if (!validCv(asText(fields.cv))) {
    errors.cv = "رابط السيرة يجب أن يبدأ بـ https:// أو اتركه فارغاً.";
  }
  if (normalizeProof(input.proof) !== normalizeProof(input.expectedProof) || normalizeProof(input.expectedProof) === "") {
    errors.proof = "الكلمة غير مطابقة. انسخها كما تظهر في المربع.";
  }
  if (input.consent !== true) {
    errors.consent = "يلزم تأكيد أنك تتقدم للعمل مع كينز.";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/** Arabic text of the application, one fact per line. */
export function applicationText(fields) {
  const phone = canonicalMobile(asText(fields.phone)) || asText(fields.phone).trim();
  const subjects = subjectLine(fields);
  const lines = [
    "طلب انضمام كمدرس — كينز",
    "الاسم: " + asText(fields.name).trim().replace(/\s+/g, " "),
    "واتساب: " + phone,
    "المدينة: " + asText(fields.city).trim().replace(/\s+/g, " "),
    "المواد: " + subjects,
    "طريقة التدريس: " + (MODES[fields.mode] || ""),
    "الخبرة: " + (EXPERIENCE[fields.experience] || ""),
    "المؤهل: " + (QUALIFICATION[fields.qualification] || ""),
    "نبذة: " + asText(fields.about).trim().replace(/\s+/g, " "),
  ];
  const cv = asText(fields.cv).trim();
  if (cv) lines.push("سيرة: " + cv);
  return lines.join("\n");
}

/**
 * Mail Kinz should receive. Returns null when the phone is not a usable
 * Syrian mobile, so a caller cannot send a half-built letter.
 */
export function applicationLetter(fields) {
  const text = applicationText(fields);
  const phone = canonicalMobile(asText(fields.phone));
  if (!text || !phone) return null;
  const name = asText(fields.name).trim().replace(/\s+/g, " ");
  return {
    to: HIRING_EMAIL,
    subject: "طلب انضمام كمدرس — " + name,
    text,
    fields: {
      name,
      phone,
      city: asText(fields.city).trim().replace(/\s+/g, " "),
      subjects: subjectLine(fields),
      teaching: MODES[fields.mode] || "",
      experience: EXPERIENCE[fields.experience] || "",
      qualification: QUALIFICATION[fields.qualification] || "",
      about: asText(fields.about).trim().replace(/\s+/g, " "),
      cv: asText(fields.cv).trim() || "—",
    },
  };
}

function trapTripped(input) {
  if (!input || typeof input !== "object") return true;
  if (typeof input.faxTrap !== "string" || input.faxTrap.trim() !== "") return true;
  if (input.botTrap !== false) return true;
  return false;
}

function validClock(openedAt, nowMs) {
  return Number.isFinite(openedAt) && Number.isFinite(nowMs) && nowMs >= openedAt;
}

function asText(value) {
  return typeof value === "string" ? value : "";
}

function westernDigits(value) {
  const indic = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
  return String(value).replace(/[٠-٩۰-۹]/g, (digit) => String(indic.indexOf(digit) % 10));
}

function canonicalMobile(value) {
  let digits = westernDigits(value).replace(/\D/g, "");
  if (digits.startsWith("00963")) digits = digits.slice(5);
  else if (digits.startsWith("963")) digits = digits.slice(3);
  if (digits.length === 9 && digits.startsWith("9")) digits = "0" + digits;
  if (!/^09\d{8}$/.test(digits)) return "";
  if (/^(\d)\1+$/.test(digits.slice(2))) return "";
  return digits;
}

function validName(value) {
  const parts = value.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length < 2) return false;
  return parts.every((part) => /^[\u0600-\u06FFa-zA-Z][\u0600-\u06FFa-zA-Z'-]{1,}$/.test(part) && !JUNK_NAME.test(part));
}

function validCity(value) {
  const city = value.trim().replace(/\s+/g, " ");
  return /^[\u0600-\u06FFa-zA-Z][\u0600-\u06FFa-zA-Z\s-]{1,39}$/.test(city);
}

function validShortLabel(value) {
  const label = value.trim().replace(/\s+/g, " ");
  return /^[\u0600-\u06FFa-zA-Z][\u0600-\u06FFa-zA-Z\s-]{1,39}$/.test(label);
}

function validAbout(value) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 40 || text.length > 180) return false;
  if (text.split(" ").length < 5) return false;
  if (/https?:|www\.|wa\.me|t\.me/i.test(text)) return false;
  const compact = text.replace(/\s/g, "");
  const counts = new Map();
  for (const ch of compact) counts.set(ch, (counts.get(ch) || 0) + 1);
  const max = Math.max(...counts.values());
  return max / compact.length <= 0.45;
}

function validCv(value) {
  const url = value.trim();
  if (url === "") return true;
  return /^https:\/\/\S{4,280}$/.test(url);
}

function normalizeProof(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, "");
}

function subjectLine(fields) {
  const selected = Array.isArray(fields.subjects) ? fields.subjects : [];
  return Object.keys(SUBJECTS)
    .filter((key) => selected.includes(key))
    .map((key) => (key === "other" ? "أخرى (" + asText(fields.subjectOther).trim() + ")" : SUBJECTS[key]))
    .join("، ");
}
