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
        <h2>RSVP</h2>
        {submitted ? (
          <div className="reference-demo-rsvp-success" role="status" aria-live="polite">
            <CheckCircle2 size={34} aria-hidden="true" />
            <p>Thank you, {guestName.trim()}!</p>
            <small>{attendance === "ATTENDING" ? `We’ll be happy to see you${attendeeCount > 1 ? ` and ${attendeeCount - 1} ${attendeeCount === 2 ? "guest" : "guests"}` : ""}.` : "Thank you for letting us know."}</small>
            <button type="button" onClick={() => setSubmitted(false)}>Edit RSVP</button>
          </div>
        ) : (
          <>
            <div className="reference-demo-rsvp-intro"><p>We can’t wait!</p><p>Please reply by {dateString}</p></div>
            <form className="reference-demo-rsvp-form" onSubmit={submit}>
              <label className="reference-demo-rsvp-field">
                <span>Full name *</span>
                <input autoComplete="name" maxLength={100} name="name" placeholder="Your name" required value={guestName} onChange={(event) => setGuestName(event.target.value)} />
              </label>
              <fieldset className="reference-demo-rsvp-choice">
                <legend>Will you attend? *</legend>
                <label>
                  <input checked={attendance === "ATTENDING"} name="attendance" onChange={() => setAttendance("ATTENDING")} type="radio" value="ATTENDING" />
                  <span>Yes, I will attend</span>
                </label>
                <label>
                  <input checked={attendance === "DECLINED"} name="attendance" onChange={() => setAttendance("DECLINED")} type="radio" value="DECLINED" />
                  <span>No, I can’t attend</span>
                </label>
              </fieldset>
              {attendance === "ATTENDING" && (
                <label className="reference-demo-rsvp-field">
                  <span>Number of guests (including yourself)</span>
                  <select value={attendeeCount} onChange={(event) => setAttendeeCount(Number(event.target.value))}>
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
                  </select>
                </label>
              )}
              <label className="reference-demo-rsvp-consent">
                <input checked={includesChildData} onChange={(event) => { setIncludesChildData(event.target.checked); setGuardianConsent(false); }} type="checkbox" />
                <span>This RSVP includes a child’s name or information.</span>
              </label>
              {includesChildData && (
                <label className="reference-demo-rsvp-consent reference-demo-rsvp-consent--nested">
                  <input checked={guardianConsent} name="guardianConsent" onChange={(event) => setGuardianConsent(event.target.checked)} required type="checkbox" />
                  <span>{RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY}</span>
                </label>
              )}
              <button className="reference-demo-rsvp-submit" type="submit"><Heart size={14} aria-hidden="true" /> Send RSVP <Send size={13} aria-hidden="true" /></button>
            </form>
            <small className="reference-demo-rsvp-local-note">Local demo only · your response isn’t saved or sent.</small>
          </>
        )}
        <Image className="reference-demo-rsvp-floral reference-demo-rsvp-floral--top" src="/templates/reference-prototypes/blush-rsvp-floral-corner.png" alt="" aria-hidden="true" width={1024} height={1024} unoptimized />
        <Image className="reference-demo-rsvp-floral reference-demo-rsvp-floral--bottom" src="/templates/reference-prototypes/blush-rsvp-floral-corner.png" alt="" aria-hidden="true" width={1024} height={1024} unoptimized />
      </div>
    </section>
  );
}
