"use client";

import Image from "next/image";
import { CheckCircle2, Heart, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY } from "@/lib/consent-copy";

export function ReferenceDemoRsvp({ dateString }: { dateString: string }) {
  const [guestName, setGuestName] = useState("");
  const [attendance, setAttendance] = useState<"ATTENDING" | "DECLINED">("ATTENDING");
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [includesChildData, setIncludesChildData] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="reference-rsvp-section reference-demo-rsvp-section" id="rsvp" data-demo-rsvp="local-only">
      <div className="reference-section-inner">
        <span className="reference-kicker">KABAR KEHADIRAN</span>
        <h2>Konfirmasi Kehadiran</h2>
        {submitted ? (
          <div className="reference-demo-rsvp-success" role="status" aria-live="polite">
            <CheckCircle2 size={34} aria-hidden="true" />
            <p>Terima kasih, {guestName.trim()}!</p>
            <small>{attendance === "ATTENDING" ? `Kami menantikan kehadiran Anda${attendeeCount > 1 ? ` dan ${attendeeCount - 1} tamu lainnya` : ""}.` : "Terima kasih telah memberi kabar."}</small>
            <button type="button" onClick={() => setSubmitted(false)}>Ubah jawaban</button>
          </div>
        ) : (
          <>
            <div className="reference-demo-rsvp-intro"><p>Kami menantikan kehadiran Anda!</p><p>Mohon konfirmasi sebelum {dateString}</p></div>
            <form className="reference-demo-rsvp-form" onSubmit={submit}>
              <label className="reference-demo-rsvp-field">
                <span>Nama lengkap *</span>
                <input autoComplete="name" maxLength={100} name="name" placeholder="Nama Anda" required value={guestName} onChange={(event) => setGuestName(event.target.value)} />
              </label>
              <fieldset className="reference-demo-rsvp-choice">
                <legend>Apakah Anda akan hadir? *</legend>
                <label>
                  <input checked={attendance === "ATTENDING"} name="attendance" onChange={() => setAttendance("ATTENDING")} type="radio" value="ATTENDING" />
                  <span>Ya, saya akan hadir</span>
                </label>
                <label>
                  <input checked={attendance === "DECLINED"} name="attendance" onChange={() => setAttendance("DECLINED")} type="radio" value="DECLINED" />
                  <span>Maaf, saya tidak dapat hadir</span>
                </label>
              </fieldset>
              {attendance === "ATTENDING" && (
                <label className="reference-demo-rsvp-field">
                  <span>Jumlah tamu (termasuk Anda)</span>
                  <select value={attendeeCount} onChange={(event) => setAttendeeCount(Number(event.target.value))}>
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
                  </select>
                </label>
              )}
              <label className="reference-demo-rsvp-consent">
                <input checked={includesChildData} onChange={(event) => { setIncludesChildData(event.target.checked); setGuardianConsent(false); }} type="checkbox" />
                <span>Konfirmasi kehadiran ini mencantumkan nama atau informasi anak.</span>
              </label>
              {includesChildData && (
                <label className="reference-demo-rsvp-consent reference-demo-rsvp-consent--nested">
                  <input checked={guardianConsent} name="guardianConsent" onChange={(event) => setGuardianConsent(event.target.checked)} required type="checkbox" />
                  <span>{RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY}</span>
                </label>
              )}
              <button className="reference-demo-rsvp-submit" type="submit"><Heart size={14} aria-hidden="true" /> Kirim konfirmasi <Send size={13} aria-hidden="true" /></button>
            </form>
            <small className="reference-demo-rsvp-local-note">Contoh saja · jawaban Anda tidak disimpan atau dikirim.</small>
          </>
        )}
        <Image className="reference-demo-rsvp-floral reference-demo-rsvp-floral--top" src="/templates/reference-prototypes/blush-rsvp-floral-corner.png" alt="" aria-hidden="true" width={1024} height={1024} unoptimized />
        <Image className="reference-demo-rsvp-floral reference-demo-rsvp-floral--bottom" src="/templates/reference-prototypes/blush-rsvp-floral-corner.png" alt="" aria-hidden="true" width={1024} height={1024} unoptimized />
      </div>
    </section>
  );
}
