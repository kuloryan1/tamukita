"use client";

import { useId } from "react";

type OrnamentProps = { className?: string };
type BotanicalVariant = "leaf" | "flower" | "wisteria" | "palm";
type LeafPosition = readonly [x: number, y: number, rotation: number, scale?: number];

/** A tapered ink leaf with a small, deliberately imperfect central vein. */
function Leaf({ x, y, rotation, scale = 1 }: {
  x: number;
  y: number;
  rotation: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
      <path d="M0 0C-8-6-10-18 0-32C9-23 11-10 0 0Z" fill="currentColor" fillOpacity=".055" strokeWidth=".72" />
      <path d="M0-1C1-12-1-22 0-30M0-10-4-15M.2-17 4-21" strokeWidth=".5" opacity=".72" />
    </g>
  );
}

function Leaves({ positions }: { positions: readonly LeafPosition[] }) {
  return <>{positions.map(([x, y, rotation, scale]) => (
    <Leaf key={`${x}:${y}:${rotation}:${scale ?? 1}`} x={x} y={y} rotation={rotation} scale={scale} />
  ))}</>;
}

function Blossom({ x, y, scale = 1, rotation = 0 }: {
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`} strokeWidth=".65">
      {[0, 72, 144, 216, 288].map((angle) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path d="M-1-2C-8-5-9-12-4-15C1-20 8-13 6-7C5-4 2-2 1-1" fill="currentColor" fillOpacity=".025" />
          <path d="M0-4 0-10M2-5 3-9" opacity=".4" strokeWidth=".45" />
        </g>
      ))}
      <circle r="2.7" strokeWidth=".6" />
      <circle r=".8" fill="currentColor" stroke="none" />
      <path d="m-3-2-2-1m7 1 2-1m-1 6 1 2m-5-2-1 2" strokeWidth=".5" />
    </g>
  );
}

function Rose({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} strokeWidth=".65">
      <path d="M-18-3C-24-15-14-24-3-21C5-28 19-20 18-10C30-2 23 15 12 16C6 27-8 24-12 17C-24 15-26 3-18-3Z" fill="currentColor" fillOpacity=".035" />
      <path d="M-18-3C-13-13-5-16 3-13C14-17 22-8 17 2M-12 17C-18 8-17-2-10-7C-11-16-3-22 4-20M12 16C2 18-7 13-9 5C-17 2-19-6-17-12M17 2C14 10 6 13-1 9C-3 17-9 19-13 16M-9 5C-10-5-2-10 5-7C13-6 15 3 8 7C2 12-6 7-5 1C-4-5 4-5 6-1C8 5 0 6-1 2C-2-1 3-1 3 1" />
      <path d="M-16-14C-12-15-9-16-6-14M15-9C16-6 17-4 15-1M-15 10C-13 11-12 12-11 14M6 17 10 16" opacity=".5" strokeWidth=".45" />
    </g>
  );
}

function LeafCorner() {
  return (
    <>
      <g strokeWidth=".9">
        <path d="M10 10C42 36 65 86 70 144C73 173 84 199 98 222" />
        <path d="M13 13C57 18 89 42 124 54C157 66 195 68 236 82" />
        <path d="M38 43C63 49 91 70 111 94M49 66C39 96 35 118 42 145M62 106C83 119 99 139 105 161M76 168C61 178 57 193 59 212" />
        <path d="M72 29C86 17 102 10 125 12M113 50C128 31 143 24 163 22M161 64C177 52 195 46 211 48M194 70C206 88 218 98 239 103" />
      </g>
      <Leaves positions={[
        [25, 27, -36, .62], [37, 41, 37, .72], [44, 56, -61, .72],
        [53, 77, 39, .8], [60, 98, -59, .83], [67, 122, 39, .85],
        [70, 147, -46, .8], [77, 172, 47, .74], [86, 197, -43, .65],
        [95, 217, 143, .54], [66, 63, 72, .59], [88, 77, 42, .61],
        [105, 88, 105, .55], [41, 106, -56, .6], [39, 128, -142, .54],
        [84, 128, 68, .58], [99, 148, 131, .54], [62, 190, -141, .47],
        [48, 21, 38, .62], [66, 28, 138, .69], [89, 39, 38, .75],
        [111, 49, 142, .72], [138, 59, 39, .76], [165, 65, 144, .65],
        [190, 70, 45, .61], [216, 77, 143, .56], [232, 80, 78, .55],
        [94, 17, -12, .53], [116, 12, 71, .48], [139, 29, 27, .55],
        [158, 23, 72, .5], [186, 51, 27, .52], [205, 48, 81, .46],
        [215, 95, 144, .48],
      ]} />
      <g fill="currentColor" stroke="none" opacity=".65">
        <circle cx="126" cy="11" r="1.35" /><circle cx="163" cy="21" r="1.2" />
        <circle cx="44" cy="149" r="1.25" /><circle cx="106" cy="165" r="1.15" />
        <circle cx="58" cy="216" r="1" /><circle cx="241" cy="104" r="1.1" />
        <circle cx="240" cy="83" r="1.2" />
      </g>
    </>
  );
}

function FlowerCorner() {
  return (
    <>
      <g strokeWidth=".85">
        <path d="M11 12C45 35 61 77 60 121C59 163 77 200 98 222M12 12C60 14 111 34 147 49C177 62 206 64 244 67" />
        <path d="M46 62C33 89 24 114 28 147M60 110C86 127 101 143 109 167M66 162C50 178 44 195 45 216M96 31C100 13 119 9 134 12M148 49C160 28 174 20 193 22M195 61C215 83 229 91 246 93" />
        <path d="M30 32 51 51M109 37 128 43M74 184 91 179M203 65 219 54" />
      </g>
      <Leaves positions={[
        [29, 31, -32, .65], [43, 57, -49, .7], [53, 79, 48, .71],
        [59, 103, -47, .65], [61, 133, 46, .7], [65, 158, -53, .68],
        [76, 190, -39, .65], [94, 215, 141, .47], [31, 114, -48, .57],
        [28, 139, -153, .49], [83, 130, 80, .59], [105, 157, 131, .51],
        [48, 196, -137, .5], [63, 21, 35, .6], [83, 27, 139, .62],
        [105, 35, 27, .58], [141, 47, 143, .59], [164, 55, 45, .65],
        [184, 59, 148, .58], [213, 65, 41, .53], [236, 67, 88, .5],
        [111, 13, 3, .47], [174, 25, 20, .52], [190, 22, 83, .43],
        [220, 85, 138, .5],
      ]} />
      <Rose x={49} y={49} scale={.86} />
      <Rose x={129} y={43} scale={.63} />
      <Blossom x={91} y={179} scale={.57} rotation={14} />
      <Blossom x={219} y={53} scale={.48} rotation={-9} />
      <Blossom x={33} y={158} scale={.43} />
      <g strokeWidth=".6">
        <path d="m134 12 7-2m-7 2 5 5m-5-5 1-7M44 216l-2 8m2-8 6 4M109 167l3 8m-3-8 7 3M245 92l5 4m-5-4 8-1" />
      </g>
      <g fill="currentColor" stroke="none" opacity=".65">
        {[[142, 9], [140, 18], [135, 4], [42, 225], [51, 221], [112, 176], [117, 170], [250, 97], [254, 91]].map(([x, y]) => <circle key={`${x}:${y}`} cx={x} cy={y} r="1.15" />)}
      </g>
    </>
  );
}

function WisteriaSpray({ x, y, length, bend }: {
  x: number;
  y: number;
  length: number;
  bend: number;
}) {
  const positions = [0.13, 0.27, 0.41, 0.55, 0.68, 0.8, 0.91];
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0C${bend} ${length * .32} ${-bend * .4} ${length * .62} ${bend * .45} ${length}`} strokeWidth=".65" />
      {positions.map((t) => {
        const px = Math.sin(t * Math.PI * 1.7) * bend * .45;
        const py = length * t;
        const size = 1.12 - t * .63;
        return (
          <g key={`cluster-${t}`} transform={`translate(${px} ${py}) scale(${size})`} strokeWidth=".7">
            <path d="M0 0C-4-6-11-8-13-2C-14 3-7 8-3 8C-1 7 0 3 0 0Z" fill="currentColor" fillOpacity=".08" />
            <path d="M1 1C5-5 11-5 13 0C14 6 7 10 4 8C2 7 1 4 1 1Z" fill="currentColor" fillOpacity=".055" />
            <path d="M-3 0C-5 2-5 4-4 6M4 1 5 6" opacity=".55" strokeWidth=".45" />
          </g>
        );
      })}
      <path d={`M${bend * .45} ${length - 3}q-5 5 0 12q5-7 0-12Z`} fill="currentColor" fillOpacity=".07" strokeWidth=".6" />
    </g>
  );
}

function WisteriaCorner() {
  return (
    <>
      <g strokeWidth=".9">
        <path d="M10 9C48 14 76 34 119 44C162 55 198 41 245 51M10 9C34 44 35 86 32 127C30 153 37 179 50 196" />
        <path d="M40 23C57 13 76 9 93 12M92 37C106 19 123 13 140 16M149 48C168 27 181 23 199 26M36 58C56 57 73 68 84 79" />
      </g>
      <Leaves positions={[
        [24, 24, -33, .6], [33, 46, -49, .69], [36, 70, -51, .68],
        [35, 96, -49, .69], [32, 122, -53, .65], [33, 149, -43, .63],
        [40, 177, 137, .57], [56, 17, 7, .56], [79, 12, 69, .48],
        [73, 30, 140, .61], [110, 22, 6, .59], [134, 16, 80, .48],
        [131, 46, 134, .65], [169, 30, 4, .57], [192, 26, 75, .47],
        [213, 46, 38, .63], [237, 49, 92, .48], [56, 61, 52, .52],
      ]} />
      <WisteriaSpray x={70} y={38} length={114} bend={11} />
      <WisteriaSpray x={112} y={47} length={150} bend={-9} />
      <WisteriaSpray x={158} y={51} length={106} bend={8} />
      <WisteriaSpray x={205} y={47} length={74} bend={-7} />
      <g strokeWidth=".6" opacity=".7">
        <path d="M49 196c10 10 15 6 14 1s-6-3-6-1M243 51c9 0 11 6 7 9s-6 0-4-2" />
      </g>
    </>
  );
}

function PalmFrond({ x, y, rotation, scale }: {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
      <path d="M0 0C5-37 15-78 23-125" strokeWidth=".9" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const sy = -15 - i * 13;
        const sx = 2 + i * 2.7;
        const extent = 27 - i * 2.4;
        return (
          <g key={`${sx}:${sy}`} strokeWidth=".6">
            <path d={`M${sx} ${sy}Q${sx - extent} ${sy - 5} ${sx - extent - 5} ${sy - 36}Q${sx - extent * .35} ${sy - 14} ${sx} ${sy}Z`} fill="currentColor" fillOpacity=".035" />
            <path d={`M${sx} ${sy - 4}Q${sx + extent} ${sy - 13} ${sx + extent + 12} ${sy - 39}Q${sx + extent * .45} ${sy - 19} ${sx} ${sy - 4}Z`} fill="currentColor" fillOpacity=".035" />
          </g>
        );
      })}
      <path d="M20-106Q17-120 25-143Q29-123 20-106Z" fill="currentColor" fillOpacity=".035" strokeWidth=".65" />
    </g>
  );
}

function PalmCorner() {
  return (
    <>
      <PalmFrond x={17} y={20} rotation={145} scale={1.38} />
      <PalmFrond x={21} y={19} rotation={104} scale={1.45} />
      <PalmFrond x={16} y={26} rotation={173} scale={1.25} />
      <path d="M10 10C49 47 92 69 129 85M13 14C22 61 40 102 63 136" strokeWidth=".7" />
      <Leaves positions={[
        [51, 49, 15, .54], [72, 61, 134, .56], [93, 71, 42, .52],
        [117, 81, 127, .46], [30, 71, -52, .5], [39, 94, 116, .55],
        [51, 115, -52, .45],
      ]} />
    </>
  );
}

/** Upper-left botanical corner; rotate 180 degrees for a lower-right corner. */
export function BotanicalCorner({ className, variant = "leaf" }: OrnamentProps & {
  variant?: BotanicalVariant;
}) {
  return (
    <svg className={className} viewBox="0 0 260 240" width="260" height="240" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {variant === "flower" ? <FlowerCorner /> : variant === "wisteria" ? <WisteriaCorner /> : variant === "palm" ? <PalmCorner /> : <LeafCorner />}
    </svg>
  );
}

/** An open oval wreath. Place the invitation's monogram over its clear center. */
export function BotanicalWreath({ className }: OrnamentProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" width="200" height="200" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <g strokeWidth=".8">
        <path d="M106 186C62 172 31 140 31 99C31 65 48 36 76 19M93 186C137 175 165 143 168 104C171 68 155 39 130 21" />
        <path d="M44 146C29 137 21 123 20 109M33 91C25 76 29 58 37 47M58 32C56 22 63 12 72 8M159 143C174 135 181 120 180 106M164 79C177 67 174 52 169 42M145 34C147 22 142 13 136 8" />
      </g>
      <Leaves positions={[
        [91, 180, -52, .49], [76, 173, 153, .51], [61, 162, -48, .54],
        [49, 149, 159, .57], [39, 132, -49, .56], [33, 113, 150, .55],
        [32, 94, -34, .53], [35, 76, 141, .53], [43, 56, -20, .49],
        [53, 39, 131, .47], [67, 25, 16, .39], [28, 130, -41, .4],
        [21, 112, -7, .36], [29, 67, -6, .37], [37, 49, 14, .32],
        [62, 18, -1, .31], [109, 181, 50, .49], [126, 174, -151, .53],
        [141, 162, 45, .56], [154, 148, -159, .56], [162, 130, 42, .57],
        [167, 110, -148, .55], [168, 90, 34, .52], [164, 71, -135, .52],
        [155, 52, 17, .49], [143, 36, -134, .46], [132, 24, -17, .36],
        [176, 125, 28, .38], [180, 108, -6, .33], [174, 64, 5, .35],
        [170, 45, -24, .31], [144, 19, -16, .29],
      ]} />
      <g strokeWidth=".55">
        <path d="M44 146 26 147m0 0-3-5m3 5-5 2M166 128l18 7m0 0 4-3m-4 3 2 5M42 59l-5-18m0 0-4-3m4 3 3-5M155 47l9-15m0 0 5-2" />
      </g>
      <g fill="currentColor" stroke="none" opacity=".72">
        {[[23, 141], [20, 150], [188, 131], [186, 141], [32, 37], [40, 35], [170, 29], [72, 8], [135, 7]].map(([x, y]) => <circle key={`${x}:${y}`} cx={x} cy={y} r="1.15" />)}
      </g>
    </svg>
  );
}

/** Ivory-silver satin, with folded loops and gently turned fishtail ribbons. */
export function SatinBow({ className }: OrnamentProps) {
  const instance = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `satin-${instance}-${name}`;
  return (
    <svg className={className} viewBox="0 0 360 190" width="360" height="190" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id("left-tail")} x1="157" y1="88" x2="84" y2="170" gradientUnits="userSpaceOnUse">
          <stop stopColor="#AEB5B5" /><stop offset=".19" stopColor="#E3E5E1" /><stop offset=".4" stopColor="#FCFCF6" /><stop offset=".7" stopColor="#E5E6E1" /><stop offset=".91" stopColor="#C4CBC9" /><stop offset="1" stopColor="#F4F5EE" />
        </linearGradient>
        <linearGradient id={id("right-tail")} x1="202" y1="90" x2="284" y2="166" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ADB5B4" /><stop offset=".2" stopColor="#EAEBE5" /><stop offset=".49" stopColor="#FCFCF7" /><stop offset=".7" stopColor="#E7E9E2" /><stop offset=".88" stopColor="#C6CDCB" /><stop offset="1" stopColor="#F5F6F0" />
        </linearGradient>
        <linearGradient id={id("left-loop")} x1="95" y1="43" x2="117" y2="103" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBFCF7" /><stop offset=".17" stopColor="#F3F5EF" /><stop offset=".43" stopColor="#DCE1DE" /><stop offset=".62" stopColor="#FDFDF9" /><stop offset=".83" stopColor="#E2E6E0" /><stop offset="1" stopColor="#BDC6C3" />
        </linearGradient>
        <linearGradient id={id("right-loop")} x1="267" y1="48" x2="247" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAF4" /><stop offset=".24" stopColor="#FCFCF7" /><stop offset=".47" stopColor="#D6DDD9" /><stop offset=".69" stopColor="#F6F8F1" /><stop offset=".9" stopColor="#E1E6DE" /><stop offset="1" stopColor="#BBC5C0" />
        </linearGradient>
        <linearGradient id={id("fold")} x1="96" y1="66" x2="95" y2="101" gradientUnits="userSpaceOnUse">
          <stop stopColor="#96A4A0" /><stop offset=".28" stopColor="#C7D1CA" /><stop offset=".68" stopColor="#E5EAE1" /><stop offset="1" stopColor="#F7F8F2" />
        </linearGradient>
        <linearGradient id={id("knot")} x1="164" y1="83" x2="199" y2="98" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B9C3BE" /><stop offset=".2" stopColor="#E6EBE1" /><stop offset=".44" stopColor="#FEFEF7" /><stop offset=".65" stopColor="#EFF2E9" /><stop offset=".86" stopColor="#CCD6CC" /><stop offset="1" stopColor="#B1BDB5" />
        </linearGradient>
      </defs>

      <path d="M174 88C149 98 119 124 98 174L84 151L62 158C86 112 119 91 161 77Z" fill={`url(#${id("left-tail")})`} stroke="#B8C1BA" strokeWidth=".6" />
      <path d="M188 87C214 96 246 122 269 174L282 152L304 157C279 112 246 90 201 76Z" fill={`url(#${id("right-tail")})`} stroke="#BAC3BB" strokeWidth=".6" />
      <path d="M160 91C125 112 111 138 97 167M197 90C236 111 252 140 269 167" stroke="#FFFFF9" strokeWidth="1.5" opacity=".83" />
      <path d="M153 95C117 119 102 139 88 153M208 96C244 117 260 138 279 153" stroke="#BEC9C1" strokeWidth=".6" opacity=".7" />
      <path d="M146 99C113 119 94 138 72 153M218 99C250 116 270 138 295 153" stroke="#F8FBF3" strokeWidth=".7" opacity=".85" />

      <path d="M174 88C145 68 103 29 65 45C43 54 41 78 56 91C81 113 131 103 174 96Z" fill={`url(#${id("left-loop")})`} stroke="#B9C3BC" strokeWidth=".6" />
      <path d="M188 88C216 67 258 31 295 48C318 58 320 79 304 93C280 113 232 103 188 97Z" fill={`url(#${id("right-loop")})`} stroke="#BBC5BD" strokeWidth=".6" />

      <path d="M166 90C139 80 107 62 78 62C62 62 53 67 53 75C54 90 79 94 108 94C129 94 148 93 166 90Z" fill={`url(#${id("fold")})`} opacity=".72" />
      <path d="M197 91C225 80 254 65 281 65C296 65 307 70 307 77C307 90 283 96 255 95C233 95 213 93 197 91Z" fill={`url(#${id("fold")})`} opacity=".66" />
      <path d="M54 74C56 88 79 92 109 92C134 92 152 91 169 92M307 77C306 90 282 94 254 93C233 93 213 92 193 93" stroke="#FDFEF7" strokeWidth="1.25" opacity=".9" />
      <path d="M52 62C59 45 80 41 100 48C126 56 147 75 166 84M310 65C302 49 283 45 263 51C239 58 216 75 196 85" stroke="#FFFFFA" strokeWidth="1.15" opacity=".86" />
      <path d="M65 48C101 38 138 75 164 86M294 51C264 40 224 77 199 86" stroke="#D2DBD2" strokeWidth=".5" opacity=".7" />
      <path d="M67 97C96 104 138 95 168 94M295 100C270 105 228 96 196 95" stroke="#F8FAF1" strokeWidth=".8" opacity=".7" />

      <path d="M166 79C174 76 188 76 197 81C195 88 196 98 199 105C187 110 175 110 164 104C168 96 168 87 166 79Z" fill={`url(#${id("knot")})`} stroke="#BDC8BC" strokeWidth=".55" />
      <path d="M173 80C176 90 176 98 173 105M190 81C187 91 189 99 191 106" stroke="#FEFFF7" strokeWidth=".75" opacity=".8" />
      <path d="M169 80C172 92 170 98 168 103M194 83C192 92 194 99 195 103" stroke="#AAB9AB" strokeWidth=".6" opacity=".38" />
      <path d="M178 80C181 89 182 97 179 107" stroke="#FFFFFA" strokeWidth="1.1" opacity=".58" />
    </svg>
  );
}

export function TinyFlourish({ className }: OrnamentProps) {
  return (
    <svg className={className} viewBox="0 0 140 36" width="140" height="36" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M13 20C31 16 49 16 65 18M75 18C91 16 109 16 127 20" strokeWidth=".65" />
      <path d="M28 18C23 17 21 11 21 9C27 10 29 14 28 18ZM41 17C36 21 31 21 29 20C33 16 37 15 41 17ZM53 17C47 15 45 10 45 8C51 9 54 12 53 17ZM112 18C117 17 119 11 119 9C113 10 111 14 112 18ZM99 17C104 21 109 21 111 20C107 16 103 15 99 17ZM87 17C93 15 95 10 95 8C89 9 86 12 87 17Z" fill="currentColor" fillOpacity=".055" strokeWidth=".6" />
      <path d="m70 12 4 6-4 6-4-6Z" strokeWidth=".65" />
      <circle cx="8" cy="21" r="1" fill="currentColor" stroke="none" />
      <circle cx="132" cy="21" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
