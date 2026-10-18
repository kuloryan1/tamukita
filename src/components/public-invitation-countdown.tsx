"use client";

import { useEffect, useState } from "react";

const emptyCountdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };

export function PublicInvitationCountdown({ eventDate, eventTime }: { eventDate: string; eventTime: string }) {
  const [countdown, setCountdown] = useState(emptyCountdown);

  useEffect(() => {
    if (!eventDate) return;
    const target = new Date(`${eventDate}T${eventTime || "00:00"}:00+07:00`).getTime();
    const tick = () => {
      const distance = Math.max(0, target - Date.now());
      setCountdown({
        days: Math.floor(distance / 86_400_000),
        hours: Math.floor((distance / 3_600_000) % 24),
        minutes: Math.floor((distance / 60_000) % 60),
        seconds: Math.floor((distance / 1_000) % 60),
      });
    };
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [eventDate, eventTime]);

  return (
    <section className="public-countdown-section">
      <div className="public-countdown">
        <span>HARI YANG KAMI NANTIKAN</span>
        <div>
          <b>{countdown.days}<small>hari</small></b><i>:</i>
          <b>{String(countdown.hours).padStart(2, "0")}<small>jam</small></b><i>:</i>
          <b>{String(countdown.minutes).padStart(2, "0")}<small>menit</small></b><i>:</i>
          <b>{String(countdown.seconds).padStart(2, "0")}<small>detik</small></b>
        </div>
      </div>
    </section>
  );
}
