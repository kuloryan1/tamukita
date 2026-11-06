"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { InvitationEventScheduleItem } from "@/lib/invitations";

function createEmptyScheduleItem(): InvitationEventScheduleItem {
  return { id: crypto.randomUUID(), time: "", title: "", description: "" };
}

export function EditorEventSchedule({ value, onChange }: {
  value: InvitationEventScheduleItem[];
  onChange: (value: InvitationEventScheduleItem[]) => void;
}) {
  const items = value ?? [];

  function updateItem(index: number, key: keyof InvitationEventScheduleItem, nextValue: string) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: nextValue } : item));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    onChange(reordered);
  }

  return (
    <section className="editor-event-schedule" aria-labelledby="editor-event-schedule-title">
      <div className="editor-event-schedule-heading">
        <div>
          <h3 id="editor-event-schedule-title">Rundown acara <span>Opsional</span></h3>
          <p>Susun waktu dan kegiatan agar tamu tahu urutan acaranya.</p>
        </div>
        <button type="button" className="button button--outline button--small" onClick={() => onChange([...items, createEmptyScheduleItem()])} disabled={items.length >= 12}>
          <Plus size={14} /> Tambah kegiatan
        </button>
      </div>
      {items.length === 0
        ? <p className="editor-event-schedule-empty">Belum ada kegiatan. Tambahkan hingga 12 bagian acara.</p>
        : <ol className="editor-event-schedule-list">
            {items.map((item, index) => (
              <li className="editor-event-schedule-item" key={item.id}>
                <div className="editor-event-schedule-item-heading">
                  <span>Kegiatan {String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <button type="button" className="editor-icon-button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Pindahkan kegiatan ${index + 1} ke atas`}><ArrowUp size={14} /></button>
                    <button type="button" className="editor-icon-button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} aria-label={`Pindahkan kegiatan ${index + 1} ke bawah`}><ArrowDown size={14} /></button>
                    <button type="button" className="editor-icon-button is-danger" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Hapus kegiatan ${index + 1}`}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="editor-event-schedule-fields">
                  <label className="editor-event-schedule-field"><span>Waktu</span><input className="text-input" type="time" value={item.time} onChange={(event) => updateItem(index, "time", event.target.value)} /></label>
                  <label className="editor-event-schedule-field"><span>Nama kegiatan</span><input className="text-input" maxLength={100} value={item.title} onChange={(event) => updateItem(index, "title", event.target.value)} placeholder="Contoh: Akad nikah" /></label>
                  <label className="editor-event-schedule-field editor-event-schedule-field--wide"><span>Keterangan <small>Opsional</small></span><textarea className="text-input text-area" maxLength={280} rows={2} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Contoh: Prosesi dimulai tepat waktu." /></label>
                </div>
              </li>
            ))}
          </ol>}
      <p className="editor-event-schedule-hint">Waktu dan nama kegiatan harus diisi agar rundown tampil di undangan.</p>
    </section>
  );
}
