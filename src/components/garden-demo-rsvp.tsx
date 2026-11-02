"use client";

import { CheckCircle2, Heart, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

export function GardenDemoRsvp() {
  const [guestName, setGuestName] = useState("");
  const [attendance, setAttendance] = useState<"Hadir" | "Berhalangan">("Hadir");
  const [guestCount, setGuestCount] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="garden-rsvp-demo" data-demo-rsvp="local-only">
      {submitted ? (
        <div className="garden-rsvp-demo-success" role="status" aria-live="polite">
          <CheckCircle2 size={28} aria-hidden="true" />
          <p>Terima kasih, {guestName.trim()}!</p>
          <small>{attendance === "Hadir" ? `Kami menantikan kehadiran${guestCount > 1 ? ` Anda dan ${guestCount - 1} tamu` : " Anda"}.` : "Terima kasih telah memberi kabar."}</small>
          <button type="button" onClick={() => setSubmitted(false)}>Ubah jawaban</button>
        </div>
      ) : (
        <form className="garden-rsvp-demo-form" onSubmit={submit}>
          <label>
            <span>Nama lengkap *</span>
            <input autoComplete="name" maxLength={100} name="name" placeholder="Nama Anda" required value={guestName} onChange={(event) => setGuestName(event.target.value)} />
          </label>
          <fieldset>
            <legend>Apakah Anda akan hadir? *</legend>
            <label><input checked={attendance === "Hadir"} name="attendance" onChange={() => setAttendance("Hadir")} type="radio" value="Hadir" /><span>Ya, saya akan hadir</span></label>
            <label><input checked={attendance === "Berhalangan"} name="attendance" onChange={() => setAttendance("Berhalangan")} type="radio" value="Berhalangan" /><span>Maaf, saya berhalangan</span></label>
          </fieldset>
          {attendance === "Hadir" && <label>
            <span>Jumlah tamu termasuk Anda</span>
            <select value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value))}>
              {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} orang</option>)}
            </select>
          </label>}
          <button type="submit"><Heart size={14} aria-hidden="true" /> Kirim jawaban <Send size={13} aria-hidden="true" /></button>
        </form>
      )}
      <small className="garden-rsvp-demo-note">Demo lokal · jawaban hanya tampil di halaman ini, tidak dikirim atau disimpan.</small>
    </div>
  );
}
