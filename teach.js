/**
 * Adapter between the hiring form and apply.js.
 * The proof word stays in this closure. It is drawn on a canvas and spoken on
 * request; it is not written into the page text, a hidden input, or window.
 */

import { reviewApplication, applicationLetter } from "./apply.js";

const WORDS = ["كينز", "درس", "كتاب", "قلم", "شرح"];
const FOCUS_ORDER = [
  "name",
  "phone",
  "city",
  "subjects",
  "subjectOther",
  "mode",
  "experience",
  "qualification",
  "about",
  "cv",
  "proof",
  "consent",
];

const form = document.querySelector("#teach-apply");
const ready = document.querySelector("#teach-ready");
const status = document.querySelector("#teach-status");
const preview = document.querySelector("#teach-preview");
const submitButton = form.querySelector(".teach-submit");
const otherWrap = document.querySelector("#subject-other-wrap");
const canvas = document.querySelector("#proof-canvas");

let openedAt = Date.now();
let expected = pickWord();
let sending = false;

drawProof();
document.fonts.ready.then(drawProof);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (sending) return;
  const input = readForm();
  const result = reviewApplication(input, Date.now());
  clearErrors();
  if (!result.ok) {
    showErrors(result.errors);
    return;
  }
  const letter = applicationLetter(input.fields);
  if (!letter) {
    showErrors({ form: "تعذّر تجهيز الرسالة. حدّث الصفحة وحاول مرة أخرى." });
    return;
  }
  sendLetter(letter);
});

form.querySelector("#subject-other-toggle").addEventListener("change", syncOther);
form.querySelector("#proof-hear").addEventListener("click", speakProof);
form.querySelector("#proof-refresh").addEventListener("click", () => {
  expected = pickWord();
  drawProof();
  form.elements.proof.value = "";
  form.elements.proof.focus();
});
document.querySelector("#teach-edit").addEventListener("click", () => {
  ready.hidden = true;
  form.hidden = false;
  form.elements.name.focus();
});

window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  openedAt = Date.now();
  expected = pickWord();
  drawProof();
});

function readForm() {
  const data = new FormData(form);
  return {
    openedAt,
    faxTrap: String(data.get("fax_number") ?? ""),
    botTrap: data.get("botcheck") != null,
    proof: String(data.get("proof") ?? ""),
    expectedProof: expected,
    consent: data.get("consent") != null,
    fields: {
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      city: String(data.get("city") ?? ""),
      subjects: [...form.querySelectorAll('input[name="subjects"]:checked')].map((el) => el.value),
      subjectOther: String(data.get("subject_other") ?? ""),
      mode: String(data.get("mode") ?? ""),
      experience: String(data.get("experience") ?? ""),
      qualification: String(data.get("qualification") ?? ""),
      about: String(data.get("about") ?? ""),
      cv: String(data.get("cv") ?? ""),
    },
  };
}

function showErrors(errors) {
  const fieldCount = Object.keys(errors).filter((key) => key !== "form").length;
  status.classList.remove("teach-status--busy");
  status.textContent = [errors.form, fieldCount ? "راجع الحقول الموضّحة أدناه." : ""].filter(Boolean).join(" ");
  for (const [key, message] of Object.entries(errors)) {
    const slot = form.querySelector('[data-error-for="' + key + '"]');
    if (slot) {
      slot.id = "err-" + key;
      slot.textContent = message;
    }
    const field = fieldFor(key);
    if (!field) continue;
    field.setAttribute("aria-invalid", "true");
    if (slot) field.setAttribute("aria-describedby", slot.id);
  }
  const first = FOCUS_ORDER.map(fieldFor).find((field) => field && field.getAttribute("aria-invalid") === "true");
  (first || status).focus();
}

function showReady(letter) {
  form.hidden = true;
  ready.hidden = false;
  status.textContent = "";
  status.classList.remove("teach-status--busy");
  preview.textContent = letter.text;
  ready.querySelector("h2").focus();
}

async function sendLetter(letter) {
  sending = true;
  submitButton.disabled = true;
  submitButton.textContent = "جاري الإرسال…";
  status.classList.add("teach-status--busy");
  status.textContent = "جاري إرسال الطلب إلى كينز…";
  try {
    const payload = new FormData();
    payload.set("subject", letter.subject);
    payload.set("name", letter.fields.name);
    payload.set("phone", letter.fields.phone);
    payload.set("city", letter.fields.city);
    payload.set("subjects", letter.fields.subjects);
    payload.set("teaching", letter.fields.teaching);
    payload.set("experience", letter.fields.experience);
    payload.set("qualification", letter.fields.qualification);
    payload.set("about", letter.fields.about);
    payload.set("cv", letter.fields.cv);
    payload.set("message", letter.text);
    // The marketing site has no mail server. This endpoint delivers the
    // letter to the address in the path and answers JSON when asked.
    const response = await fetch("https://forms.noundry.com/f/" + letter.to, {
      method: "POST",
      body: payload,
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const body = await response.json().catch(() => ({}));
    const accepted = response.ok && body.success !== false && body.success !== "false";
    if (!accepted) {
      showErrors({ form: "تعذّر إرسال البريد. أعد المحاولة بعد قليل." });
      return;
    }
    showReady(letter);
  } catch {
    showErrors({ form: "تعذّر إرسال البريد. تحقق من الاتصال ثم أعد المحاولة." });
  } finally {
    sending = false;
    submitButton.disabled = false;
    submitButton.textContent = "إرسال الطلب";
  }
}

function clearErrors() {
  status.textContent = "";
  status.classList.remove("teach-status--busy");
  form.querySelectorAll("[data-error-for]").forEach((slot) => {
    slot.textContent = "";
  });
  form.querySelectorAll("[aria-invalid]").forEach((field) => {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  });
}

function fieldFor(key) {
  if (key === "subjects") return form.querySelector('input[name="subjects"]');
  if (key === "mode") return form.querySelector('input[name="mode"]');
  if (key === "subjectOther") return form.elements.subject_other;
  if (key === "form") return null;
  const field = form.elements.namedItem(key);
  if (!field || typeof field.setAttribute !== "function") return null;
  return field;
}

function syncOther() {
  const on = form.querySelector("#subject-other-toggle").checked;
  otherWrap.hidden = !on;
  if (!on) form.elements.subject_other.value = "";
  if (on) form.elements.subject_other.focus();
}

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function drawProof() {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff8eb";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(251, 176, 59, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, 46);
  ctx.bezierCurveTo(70, 18, 140, 62, 250, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, 22);
  ctx.bezierCurveTo(90, 58, 160, 12, 240, 48);
  ctx.stroke();
  ctx.direction = "rtl";
  ctx.fillStyle = "#1A2656";
  ctx.font = "700 36px Cairo, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(expected, width / 2, height / 2 + 2);
}

function speakProof() {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(expected);
  utterance.lang = "ar";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
