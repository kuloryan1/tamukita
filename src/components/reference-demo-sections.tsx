import Image from "next/image";
import type { CSSProperties } from "react";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { InvitationFamilyDetails } from "@/templates/shared";
import { ReferenceRevealObserver } from "@/components/reference-reveal-observer";
import type { InvitationDraft } from "@/lib/invitations";
import { referenceDemoContent } from "@/lib/reference-demo-content";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";

type ReferenceDemoSectionsProps = {
  draft: InvitationDraft;
  dateString: string;
  mapsUrl?: string;
  preset: ReferenceTemplatePreset;
};

const blushAssets = "/templates/reference-prototypes/";

export function ReferenceDemoSections({ draft, dateString, mapsUrl, preset }: ReferenceDemoSectionsProps) {
  const isBlush = preset.slug === "blush-serenade";
  const isIvory = preset.slug === "ivory-heritage";
  const isRoyal = preset.slug === "royal-gold";
  const isWisteria = preset.slug === "wisteria-senja";
  const isCream = preset.slug === "elegant-cream";
  const isSage = preset.slug === "modern-sage";
  const isIvoryLike = isIvory || isRoyal;
  const demoPhotos = draft.galleryPhotos;
  const scheduleItems = isIvoryLike ? [
    { time: "17.30", title: isRoyal ? "Jamuan sore" : "Penyambutan", label: "Penyambutan", description: "", image: "ivory-timeline-lunch.png" },
    { time: draft.eventTime || "18.00", title: "Prosesi pernikahan", label: "Prosesi pernikahan", description: "", image: "ivory-timeline-ceremony.png" },
    { time: "20.00", title: "Perayaan", label: "Perayaan", description: "", image: "ivory-timeline-party.png" },
    { time: "21.30", title: isRoyal ? "Penutupan" : "Salam perpisahan", label: "Penutup", description: "", image: "ivory-timeline-party.png" },
  ] : referenceDemoContent.schedule;
  const accommodationSection = !isCream && <section className="reference-demo-section reference-demo-accommodation" id="akomodasi" data-reference-reveal aria-labelledby="reference-demo-accommodation-title">
    <div className="reference-demo-section-inner">
      {isIvoryLike && <Image className="reference-demo-icon" src={`${blushAssets}ivory-icon-accommodation.png`} alt="" aria-hidden="true" width={1024} height={1024} unoptimized />}
      <span className="reference-kicker">INFORMASI PERJALANAN</span>
      <h2 id="reference-demo-accommodation-title">Penginapan</h2>
      <p className="reference-demo-accommodation-lead">Rekomendasi tempat menginap</p>
      <div className="reference-demo-accommodation-list">
        {referenceDemoContent.accommodation.map((item) => <article className="reference-demo-accommodation-card" key={item.title}>
          {isBlush && <Image src={`${blushAssets}${item.image}`} alt="" aria-hidden="true" width={736} height={736} unoptimized />}
          <h3>{item.title}</h3><p>{item.description}</p>
        </article>)}
      </div>
      <small className="reference-demo-note">Informasi contoh · tidak ada tautan pemesanan.</small>
    </div>
  </section>;

  return (
    <div className={`reference-demo-flow${isBlush ? " reference-demo-flow--blush" : ""}${isIvory ? " reference-demo-flow--ivory" : ""}${isRoyal ? " reference-demo-flow--royal" : ""}${isWisteria ? " reference-demo-flow--wisteria" : ""}${isCream ? " reference-demo-flow--cream" : ""}${isSage ? " reference-demo-flow--sage" : ""}`} data-demo-fixture="static-visual-only">
      <ReferenceRevealObserver />
      <section className="reference-demo-section reference-demo-venue" id="detail-acara" data-reference-reveal aria-labelledby="reference-demo-venue-title">
        <div className="reference-demo-section-inner">
          {!isBlush && <span className="reference-kicker">HARI ISTIMEWA KAMI</span>}
          <h2 id="reference-demo-venue-title">Lokasi Acara</h2>
          {isBlush && <Image className="reference-demo-venue-art" src={`${blushAssets}blush-venue.png`} alt="" aria-hidden="true" width={736} height={1104} unoptimized />}
          <article className="reference-demo-venue-card">
            <CalendarDays size={18} aria-hidden="true" />
            <span>HARI &amp; TANGGAL</span>
            <b>{dateString}</b>
            <small>{draft.eventTime || "Waktu menyusul"} WIB</small>
            <MapPin size={18} aria-hidden="true" />
            <span>LOKASI ACARA</span>
            <b>{draft.venue || "Lokasi acara"}</b>
            <small>{draft.address || "Alamat akan diumumkan"}</small>
            {mapsUrl && <a className="reference-demo-map-link" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={14} aria-hidden="true" /> Petunjuk arah <ArrowUpRight size={13} aria-hidden="true" /></a>}
          </article>
        </div>
      </section>

      <section className="reference-demo-section reference-demo-schedule" id="susunan-acara" data-reference-reveal aria-labelledby="reference-demo-schedule-title">
        <div className="reference-demo-section-inner">
          {isBlush && <Image className="reference-demo-icon" src={`${blushAssets}blush-icon-schedule.png`} alt="" aria-hidden="true" width={96} height={96} unoptimized />}
          {isIvory && <CalendarDays className="reference-demo-icon reference-demo-icon--ivory" aria-hidden="true" size={38} />}
          {isRoyal && <Image className="reference-demo-icon" src={`${blushAssets}blush-icon-schedule.png`} alt="" aria-hidden="true" width={96} height={96} unoptimized />}
          <span className="reference-kicker">WAKTU KEBERSAMAAN</span>
          <h2 id="reference-demo-schedule-title">Susunan Acara</h2>
          <p className="reference-demo-lead">Rangkaian momen yang kami siapkan untuk hari istimewa ini.</p>
          <ol className={`reference-demo-timeline${isIvory ? " reference-demo-timeline--ivory" : ""}${isRoyal ? " reference-demo-timeline--royal" : ""}${isWisteria ? " reference-demo-timeline--wisteria" : ""}${isCream ? " reference-demo-timeline--cream" : ""}${isSage ? " reference-demo-timeline--sage" : ""}`}>
            {scheduleItems.map((item, index) => {
              const alternatingSide = isBlush || isIvoryLike || isWisteria || isCream || isSage ? (index % 2 === 0 ? "is-left" : "is-right") : undefined;
              return (
                <li className={alternatingSide} key={item.title}>
                  {(isBlush || isIvoryLike || isWisteria || isCream || isSage) && <Image className={isIvoryLike ? "reference-demo-timeline-asset--ivory" : undefined} src={`${blushAssets}${item.image}`} alt="" aria-hidden="true" width={52} height={52} unoptimized />}
                  {!isIvoryLike && <time>{item.time === "event-time" ? draft.eventTime || "18.00" : item.time}</time>}
                  <div>
                    <h3>{isBlush || isWisteria || isCream || isSage ? item.label : item.title}</h3>
                    {isIvoryLike ? <time className="reference-demo-timeline-time--ivory">{item.time}</time> : <p>{isBlush || isWisteria || isCream || isSage ? item.title : item.description}</p>}
                  </div>
                  {!isBlush && !isIvoryLike && !isWisteria && !isCream && !isSage && <span className="reference-demo-timeline-index">0{index + 1}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="reference-demo-section reference-demo-attire" id="busana" data-reference-reveal aria-labelledby="reference-demo-attire-title">
        <div className="reference-demo-section-inner">
          {isBlush && <Image className="reference-demo-icon" src={`${blushAssets}blush-icon-dresscode.png`} alt="" aria-hidden="true" width={110} height={110} unoptimized />}
          <span className="reference-kicker">PANDUAN TAMU</span>
          {isRoyal && <Image className="reference-demo-icon reference-demo-icon--royal-dress" src={`${blushAssets}ivory-icon-dresscode.png`} alt="" aria-hidden="true" width={1024} height={1024} unoptimized />}
          <h2 id="reference-demo-attire-title">{isIvoryLike ? "Panduan Busana" : referenceDemoContent.attire}</h2>
          <div className={`reference-demo-attire-panel${isBlush ? " reference-demo-attire-panel--blush" : ""}`}>
            {isIvoryLike && <Image className="reference-demo-attire-image--ivory" src={`${blushAssets}ivory-dresscode.png`} alt="" aria-hidden="true" width={1024} height={1024} unoptimized />}
            {isBlush && <Image className="reference-demo-floral-border" src={`${blushAssets}blush-dresscode-border.png`} alt="" aria-hidden="true" width={1920} height={1080} unoptimized />}
            {isBlush && <Image className="reference-demo-attire-art" src={`${blushAssets}blush-dresscode-illustration.png`} alt="" aria-hidden="true" width={1264} height={848} unoptimized />}
            <h3 className="reference-demo-attire-subtitle">{isIvoryLike ? "Busana semi-formal" : isSage ? "Busana kasual" : referenceDemoContent.attireSubtitle}</h3>
            {isIvoryLike && <div className="reference-demo-attire-details--ivory">
              <article><span>Perempuan</span><b>Gaun semi-formal</b></article>
              <article><span>Laki-laki</span><b>Jas dan dasi</b></article>
            </div>}
            {(isSage || isCream) && <div className={`reference-demo-attire-details--sage${isCream ? " reference-demo-attire-details--cream" : ""}`}>
              <article><span>Perempuan</span><b>Gaun semi-formal</b></article>
              <article><span>Laki-laki</span><b>Tuksedo</b></article>
            </div>}
            <p className="reference-demo-palette-caption">{referenceDemoContent.paletteCaption}</p>
            <ul className="reference-demo-palette" aria-label="Palet warna contoh">
              {referenceDemoContent.palette.map((color) => <li key={color.name} title={color.name} style={{ "--swatch": color.color } as CSSProperties}><i aria-hidden="true" />{color.name}</li>)}
            </ul>
            {!isBlush && <small className="reference-demo-note">Warna merupakan inspirasi visual untuk contoh undangan.</small>}
          </div>
        </div>
      </section>

      {isIvoryLike && <section className={`reference-demo-section reference-demo-cake--ivory${isRoyal ? " reference-demo-cake--royal" : ""}`} aria-labelledby="reference-demo-cake-title">
        <div className="reference-demo-section-inner">
          <h2 id="reference-demo-cake-title">Kue Pernikahan</h2>
          <Image src={`${blushAssets}ivory-cake.png`} alt="Ilustrasi garis kue pernikahan" width={800} height={512} unoptimized />
        </div>
      </section>}

      <section className="reference-demo-section reference-demo-gift" id="hadiah" data-reference-reveal aria-labelledby="reference-demo-gift-title">
        <div className="reference-demo-section-inner">
          {isBlush && <Image className="reference-demo-icon" src={`${blushAssets}blush-icon-gift.png`} alt="" aria-hidden="true" width={96} height={96} unoptimized />}
          <span className="reference-kicker">TANDA KASIH</span>
          <h2 id="reference-demo-gift-title">{isRoyal ? "Daftar Hadiah" : "Hadiah"}</h2>
          <div className="reference-demo-gift-card">
            <span aria-hidden="true">❧</span>
              <p>{referenceDemoContent.giftNote}</p>
              <button type="button" disabled>Detail hadiah · contoh</button>
              <small>Contoh visual · detail rekening tidak tersedia</small>
          </div>
        </div>
      </section>

      {!isCream && <section className="reference-demo-section reference-demo-menu" id="hidangan" data-reference-reveal aria-labelledby="reference-demo-menu-title">
        <div className="reference-demo-section-inner">
          <span className="reference-kicker">JAMUAN KEBERSAMAAN</span>
          <h2 id="reference-demo-menu-title">Menu</h2>
          <div className={`reference-demo-menu-card${isBlush ? " reference-demo-menu-card--blush" : ""}`}>
            {referenceDemoContent.menu.map((item) => <article key={item.label}><span>— {item.label} —</span><h3>{item.title}</h3><p>{item.description}</p></article>)}
            {isBlush && <Image className="reference-demo-menu-art" src={`${blushAssets}blush-menu-frame.png`} alt="" aria-hidden="true" width={768} height={571} unoptimized />}
            <small>Ilustrasi menu · informasi contoh</small>
          </div>
        </div>
      </section>}

      {!isCream && !isSage && <section className="reference-demo-section reference-demo-story" id="cerita" data-reference-reveal aria-labelledby="reference-demo-story-title">
        <div className="reference-demo-section-inner">
          {isIvoryLike && <Image className="reference-demo-icon" src={`${blushAssets}ivory-icon-story.png`} alt="" aria-hidden="true" width={1024} height={1024} unoptimized />}
          <span className="reference-kicker">SEPENGGAL CERITA</span>
          <h2 id="reference-demo-story-title">{isRoyal ? "Kisah Kami" : "Kisah Istimewa Kami"}</h2>
          {!isBlush && <span className="reference-flourish" aria-hidden="true">✦　❧　✦</span>}
          <p className="reference-demo-story-copy">{isBlush ? referenceDemoContent.story : draft.story || "Dengan penuh syukur, kami mengundang Anda untuk merayakan hari istimewa ini bersama."}</p>
          <InvitationFamilyDetails draft={draft} />
        </div>
      </section>}

      <section className="reference-demo-section reference-demo-gallery" id="galeri" data-reference-reveal aria-labelledby="reference-demo-gallery-title">
        <div className="reference-demo-section-inner">
          <span className="reference-kicker">POTONGAN CERITA</span>
          <h2 id="reference-demo-gallery-title">Galeri Foto</h2>
          <p className="reference-demo-lead">Momen yang kami kenang</p>
          <div className={`reference-demo-photo-wall${demoPhotos.length ? " has-photos" : ""}`}>
            {demoPhotos.length
              ? demoPhotos.slice(0, 4).map((photo, index) => <figure key={photo}><Image src={photo} alt={`Foto ${index + 1} ${draft.eventKind.toLowerCase()}`} width={440} height={560} unoptimized /></figure>)
              : <figure className="reference-demo-photo-placeholder"><Image src={isBlush ? `${blushAssets}blush-gallery-couple-demo.png` : preset.heroPoster} alt="Foto ilustrasi pasangan untuk pratinjau galeri" width={440} height={560} unoptimized /></figure>}
            {isBlush && <Image className="reference-demo-gallery-frame" src={`${blushAssets}blush-gallery-frame.png`} alt="" aria-hidden="true" width={1024} height={1024} unoptimized />}
          </div>
          <small className="reference-demo-note">Foto ilustrasi fiktif untuk pratinjau demo, bukan foto Ryan dan Dwi.</small>
        </div>
      </section>

      {isSage && accommodationSection}
      <section className="reference-demo-section reference-demo-faq" id="faq" data-reference-reveal aria-labelledby="reference-demo-faq-title">
        <div className="reference-demo-section-inner">
          <span className="reference-kicker">INFORMASI TAMU</span>
          <h2 id="reference-demo-faq-title">Tanya Jawab</h2>
          <div className="reference-demo-faq-list">
            {referenceDemoContent.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
          </div>
          {isBlush && <div className="reference-demo-faq-lights" aria-hidden="true" />}
          {isBlush && <Image className="reference-demo-faq-concierge" src={`${blushAssets}blush-icon-accommodation.png`} alt="" aria-hidden="true" width={896} height={1200} unoptimized />}
        </div>
      </section>
      {!isSage && accommodationSection}
    </div>
  );
}
