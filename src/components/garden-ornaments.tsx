export function GardenFlourish({ className = "" }: { className?: string }) {
  return <svg className={`garden-flourish ${className}`} viewBox="0 0 220 50" fill="none" aria-hidden="true">
    <path d="M14 31c30 9 52-16 76-8m116 8c-30 9-52-16-76-8M30 31c-12-13-22-11-21-2 1 7 11 7 14 1m167 1c12-13 22-11 21-2-1 7-11 7-14 1M43 29c-2-11 3-16 10-17-1 8-4 12-10 17m24-5c0-9 5-13 12-13-2 8-6 11-12 13m110 5c2-11-3-16-10-17 1 8 4 12 10 17m-24-5c0-9-5-13-12-13 2 8 6 11 12 13" />
    <path d="M110 34c-13-9-17-17-10-20 6-3 10 5 10 5s4-8 10-5c7 3 3 11-10 20Z" />
    <path d="M110 13V6m-9 27-6 7m24-7 6 7" />
    <circle cx="110" cy="3" r="1.5" />
  </svg>;
}

export function GardenRose() {
  return <svg className="garden-rose" viewBox="0 0 80 80" aria-hidden="true">
    <path fill="#9ba18a" d="M39 60c-20 11-30 5-34-1 15-5 24-4 34 1m4 0c20 11 30 5 34-1-15-5-24-4-34 1" />
    <g stroke="#bb8d7e" strokeWidth=".8" strokeLinejoin="round">
      <path fill="#e6c5b5" d="M40 10c8-7 18 4 19 11 15-1 22 13 15 23 7 12-8 24-21 22-9 12-26 10-32-1-13 0-21-14-15-23-5-13 6-25 17-23 4-10 13-15 17-9Z" />
      <path fill="#d7a89a" d="M40 18c12-6 21 3 21 11 14 7 10 25-1 29-6 10-27 14-35 2-14-7-15-23-3-30 1-11 10-17 18-12Z" />
      <path fill="#edcbbb" d="M27 30c5-13 25-13 31 1 9 6 7 21-4 25-10 11-27 2-29-8-10-7-5-16 2-18Z" />
      <path fill="#cd9b8e" d="M33 29c11-5 23 6 20 16-4 11-15 15-24 4-3-8-1-16 4-20Z" />
      <path fill="#f0d0bc" d="M33 34c3-9 18-4 16 5-1 7-10 11-15 5 5 0 9-4 9-7-3-3-6-3-10-3Z" />
    </g>
  </svg>;
}

export function GardenPavilion() {
  return <svg className="garden-pavilion" viewBox="0 0 420 210" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path fill="#eee7d4" d="m103 89 107-63 107 63-107-12-107 12Z" />
      <path d="M117 89h186v9H117zm13 9h17v82h-17zm56 0h17v82h-17zm31 0h17v82h-17zm56 0h17v82h-17zM115 180h190v9H115zm-14 9h218v8H101zm-13 8h244v8H88z" />
      <path d="M150 180v-52c0-28 33-28 33 0v52m54 0v-52c0-28 33-28 33 0v52M155 99h110M210 40l-68 40m68-40 68 40m-112 9h88" opacity=".6" />
      <path d="M43 196c15-24 4-40 17-61 11-21 30-33 29-57M68 167c-21-7-26-21-24-35 18 6 27 18 24 35Zm7-25c20-11 29-22 28-38-15 7-25 18-28 38Zm-2-29C58 99 58 87 61 76c14 11 17 23 12 37Zm304 83c-15-24-4-40-17-61-11-21-30-33-29-57m21 89c21-7 26-21 24-35-18 6-27 18-24 35Zm-7-25c-20-11-29-22-28-38 15 7 25 18 28 38Zm2-29c15-14 15-26 12-37-14 11-17 23-12 37Z" opacity=".7" />
      <path d="M22 205h376M81 199l-14-7m273 7 14-7" />
    </g>
  </svg>;
}
