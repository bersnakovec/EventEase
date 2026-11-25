import { useEffect, useRef, useState } from "react";
import CalendarPicker from "../components/CalendarPicker";
import { buildSharePath } from "../utils/eventHelpers.js";

export default function CreateEventWizard({ onCancel }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    organizer_email: "",
    tasks: "",
  });
  const [pollDates, setPollDates] = useState([]);
  const [notice, setNotice] = useState(null);
  const noticeRef = useRef(null);

  const [adminLink, setAdminLink] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const [emailInput, setEmailInput] = useState("");
  const [recipientEmails, setRecipientEmails] = useState([]);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddEmail = (e) => {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) return;
    if (!emailRegex.test(email)) {
      alert("Prosimo, vnesite veljaven e-poštni naslov.");
      return;
    }
    if (recipientEmails.includes(email)) {
      alert("Ta e-poštni naslov je že dodan.");
      return;
    }

    setRecipientEmails([...recipientEmails, email]);
    setEmailInput("");
  };

  const handleRemoveEmail = (indexToRemove) => {
    setRecipientEmails(recipientEmails.filter((_, index) => index !== indexToRemove));
  };

  const handleSendEmails = async () => {
    if (recipientEmails.length === 0) return;
    setSendingEmails(true);
    setEmailSuccess(false);

    try {
      const response = await fetch("/api/polls/share-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_link: shareLink,
          title: formData.title,
          recipients: recipientEmails,
        }),
      });

      if (!response.ok) throw new Error("Napaka na strežniku.");

      setEmailSuccess(true);
      setRecipientEmails([]);
    } catch (error) {
      console.error("Napaka pri pošiljanju e-pošte:", error);
      alert("Prišlo je do napake pri pošiljanju vabil.");
    } finally {
      setSendingEmails(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: formData.title || "Vabilo na dogodek",
          text: `Živijo! Glasuj za termin za dogodek: ${formData.title}`,
          url: shareLink,
        });
      } catch (err) {
        console.log("Uporabnik je preklical deljenje ali pa je prišlo do napake", err);
      }
    } else {
      navigator.clipboard.writeText(shareLink);
      alert("Povezava kopirana v odložišče! (Vaš brskalnik ne podpira sistemskega deljenja)");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setNotice({ type: "error", message: "Prosimo, vnesite naslov dogodka." });
      return;
    }
    if (!formData.organizer_email) {
      setNotice({
        type: "error",
        message: "Prosimo, vnesite e-poštni naslov organizatorja.",
      });
      return;
    }
    setNotice(null);

    if (!pollDates || pollDates.length === 0) {
      setNotice({ type: 'error', message: 'Prosimo, izberite vsaj en termin na koledarju.' });
      return;
    }

    const timeSlots = pollDates.map(item => {
      if (!item.start_time) {
        return {
          start_time: `${item.date}T12:00:00`,
          end_time: `${item.date}T13:00:00`
        };
      }
      return {
        start_time: item.start_time,
        end_time: item.end_time
      };
    });

    try {
      const response = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          organizer_email: formData.organizer_email,
          time_slots: timeSlots,
          tasks: formData.tasks.split("\n").filter((t) => t.trim() !== ""),
        }),
      });

      if (!response.ok) throw new Error("Napaka na strežniku.");

      const data = await response.json();

      if (data.admin_token && data.share_token) {
        setAdminLink(
          `${window.location.origin}/admin/${data.admin_token}?invite=${data.share_token}`,
        );
        setShareLink(`${window.location.origin}${buildSharePath(data.share_token)}`);
      } else {
        setNotice({
          type: "error",
          message: "Strežnik ni vrnil vseh potrebnih žetonov za povezave.",
        });
      }
    } catch (error) {
      console.error("Napaka pri ustvarjanju dogodka:", error);
      setNotice({
        type: "error",
        message: "Napaka pri komuniciranju s strežnikom.",
      });
    }
  };

  useEffect(() => {
    if (notice && noticeRef.current) {
      noticeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [notice]);

  const encodedUrl = encodeURIComponent(shareLink);
  const encodedText = encodeURIComponent(`Glasuj za termin za dogodek: ${formData.title}`);

if (adminLink && shareLink) {
  return (
    <div className="py-12 md:py-16 px-4 max-w-3xl mx-auto">
      {/* Simple centered header with subtle accent */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-accent-1)]/20 text-[var(--color-accent-2)] mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
          Dogodek je ustvarjen
        </h1>
        <p className="text-[var(--color-text)]/70 text-sm mt-2">
          Shrani povezavi in povabi udeležence
        </p>
      </div>

      {/* Two main cards: Admin link (accent-2) & Share link (accent-1) */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Admin card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-[var(--color-accent-2)]/30 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-[var(--color-accent-2)]/20 flex items-center gap-2">
            <span className="text-lg">🔑</span>
            <h2 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide">Povezava za organizatorja</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-[var(--color-text)]/70">
              Urejanje, dodajanje terminov, zaključek glasovanja. Ne deli z udeleženci.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={adminLink}
                className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-[var(--color-text)] outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(adminLink);
                  setCopiedAdmin(true);
                  setTimeout(() => setCopiedAdmin(false), 2000);
                }}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  copiedAdmin
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "bg-[var(--color-accent-2)] text-[var(--color-on-primary)] hover:opacity-90"
                }`}
              >
                {copiedAdmin ? "Kopirano" : "Kopiraj"}
              </button>
            </div>
          </div>
        </div>

        {/* Share card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-[var(--color-accent-1)]/40 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-[var(--color-accent-1)]/30 flex items-center gap-2">
            <span className="text-lg">📢</span>
            <h2 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide">Povezava za udeležence</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-[var(--color-text)]/70">
              Pošlji prijateljem – glasovanje brez prijave.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-[var(--color-text)] outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 2000);
                }}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  copiedShare
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "bg-[var(--color-accent-1)] text-[var(--color-primary)] hover:opacity-90"
                }`}
              >
                {copiedShare ? "Kopirano" : "Kopiraj"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Social share row – clean icons only with text */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-8">
        <h3 className="text-xs font-semibold text-[var(--color-text)]/70 uppercase tracking-wide mb-4 flex items-center gap-2">
          <span>🔗</span> Hitro deljenje
        </h3>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent-1)]/20 hover:border-[var(--color-accent-1)] transition"
          >
            WhatsApp
          </a>
          <a
            href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent-2)]/20 hover:border-[var(--color-accent-2)] transition"
          >
            Telegram
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent-3)]/20 hover:border-[var(--color-accent-3)] transition"
          >
            Messenger
          </a>
          <button
            onClick={handleNativeShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] text-sm font-medium hover:bg-[var(--color-accent-3)] transition"
          >
            📱 Drugo
          </button>
        </div>
      </div>

      {/* Email invitations – compact but clear */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-[var(--color-accent-3)]/30 p-5 mb-8">
        <h3 className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-4 flex items-center gap-2">
          <span>✉️</span> Pošlji vabila po e‑pošti
        </h3>

        {emailSuccess && (
          <div className="mb-4 text-xs bg-[var(--color-accent-1)]/20 text-[var(--color-primary)] p-2 rounded border border-[var(--color-accent-1)]">
            ✓ Vabila so oddana v pošiljanje.
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <input
            type="email"
            placeholder="prijatelj@primer.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEmail(e)}
            className="flex-1 text-sm p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-3)]"
          />
          <button
            onClick={handleAddEmail}
            className="px-4 py-2 bg-[var(--color-accent-3)] text-[var(--color-on-primary)] rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            Dodaj
          </button>
        </div>

        {recipientEmails.length > 0 && (
          <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-28 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {recipientEmails.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-xs bg-[var(--color-accent-3)]/10 text-[var(--color-primary)] px-2 py-1 rounded-md border border-[var(--color-accent-3)]/40"
                >
                  {email}
                  <button
                    onClick={() => handleRemoveEmail(idx)}
                    className="text-[var(--color-accent-3)] hover:text-[var(--color-accent-2)] font-bold ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          disabled={recipientEmails.length === 0 || sendingEmails}
          onClick={handleSendEmails}
          className={`w-full py-2 rounded-lg text-sm font-medium transition ${
            recipientEmails.length === 0
              ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
              : "bg-[var(--color-accent-3)] text-[var(--color-on-primary)] hover:bg-[var(--color-accent-2)]"
          }`}
        >
          {sendingEmails ? "Pošiljanje..." : `Pošlji vabilo (${recipientEmails.length})`}
        </button>
      </div>

      {/* Return home link */}
      <div className="text-center">
        <button
          onClick={onCancel}
          className="text-sm text-[var(--color-text)]/60 hover:text-[var(--color-primary)] underline transition"
        >
          ← Nazaj na začetno stran
        </button>
      </div>
    </div>
  );
}
  return (
    <div className="py-12 md:py-16 px-4 max-w-xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-normal text-[var(--color-text)] mb-2">
          Ustvari nov dogodek
        </h1>
        <p className="text-sm text-[var(--color-text)]/70 font-light">
          Brez registracije. Izpolnite osnovne podatke in prejmite povezavo do vabila.
        </p>
      </div>

      {notice && (
        <div
          ref={noticeRef}
          className={`mb-6 rounded-xl border px-4 py-3 text-xs font-light ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 text-red-700 dark:text-red-300"
              : "border-[var(--color-accent-1)] bg-[var(--color-accent-1)]/10 text-[var(--color-primary)]"
          }`}
        >
          {notice.message}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--color-text)]/80 uppercase tracking-wider" htmlFor="title">
            Naslov dogodka *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            className="text-base p-3 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:border-[var(--color-accent-2)] focus:ring-1 focus:ring-[var(--color-accent-2)] bg-white dark:bg-gray-900 text-[var(--color-text)] transition w-full shadow-sm"
            placeholder="npr. Sestanek študentskega društva..."
            value={formData.title}
            onChange={handleChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--color-text)]/80 uppercase tracking-wider" htmlFor="organizer_email">
            E-pošta organizatorja *
          </label>
          <input
            type="email"
            id="organizer_email"
            name="organizer_email"
            className="text-base p-3 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:border-[var(--color-accent-2)] focus:ring-1 focus:ring-[var(--color-accent-2)] bg-white dark:bg-gray-900 text-[var(--color-text)] transition w-full shadow-sm"
            placeholder="npr. tvoj.email@primer.com"
            value={formData.organizer_email}
            onChange={handleChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--color-text)]/80 uppercase tracking-wider" htmlFor="description">
            Opis dogodka
          </label>
          <textarea
            id="description"
            name="description"
            rows="3"
            className="text-base p-3 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:border-[var(--color-accent-1)] focus:ring-1 focus:ring-[var(--color-accent-1)] bg-white dark:bg-gray-900 text-[var(--color-text)] transition w-full shadow-sm"
            placeholder="Kratek opis, lokacija ali namen srečanja..."
            value={formData.description}
            onChange={handleChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--color-text)]/80 uppercase tracking-wider">
            Predlagaj datume za glasovanje
          </label>
          <CalendarPicker selectedDates={pollDates} onChange={setPollDates} isPollMode={true} />
        </div>

       
        <div className="flex flex-wrap-reverse gap-3 pt-4">
          <button
            type="button"
            className="flex-1 min-w-[140px] text-sm text-[var(--color-text)]/80 font-medium bg-transparent border border-gray-300 dark:border-gray-700 py-3 px-5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-[var(--color-text)] transition"
            onClick={onCancel}
          >
            Prekliči
          </button>
          <button
            type="submit"
            className="flex-1 min-w-[140px] text-sm text-[var(--color-on-primary)] font-medium bg-[var(--color-primary)] py-3 px-5 rounded-md hover:bg-[var(--color-accent-3)] hover:shadow-md active:scale-95 transition"
          >
            Ustvari in deli
          </button>
        </div>
      </form>
    </div>
  );
}