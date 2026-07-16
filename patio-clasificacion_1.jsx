import React, { useState, useMemo } from "react";

// ============================================================
// PATIO DE CLASIFICACIÓN — juego de clasificar trenes
// ------------------------------------------------------------
// DISEÑO DE NIVELES (muy fácil de editar):
// Cada carro es un string "TIPO-color".
//   Tipos:  F furgón · T tanque · V tolva · J jaula · C contenedor
//   Colores (destinos): rojo, azul, verde, ambar, violeta
// Cada nivel define: vías de llegada (arrays de carros, el
// PRIMERO de la lista es la cabeza que se empuja al lomo) y
// las capacidades de las vías de clasificación.
// ============================================================

const NIVELES = [
  {
    // 1 vía de llegada · 2 destinos · capacidad sobrada
    nombre: "Turno 1 · Primeros destinos",
    llegada: [
      ["F-rojo", "T-azul", "F-rojo", "J-azul", "V-rojo", "C-azul"],
    ],
    capacidades: [4, 4],
  },
  {
    // 1 vía de llegada · 2 destinos · capacidad exacta (sin margen)
    nombre: "Turno 2 · Sin margen",
    llegada: [
      ["T-rojo", "F-azul", "V-rojo", "C-azul", "J-rojo", "T-azul", "F-rojo", "V-azul"],
    ],
    capacidades: [4, 4],
  },
  {
    // 2 vías de llegada · 3 destinos · capacidad sobrada
    nombre: "Turno 3 · Tráfico cruzado",
    llegada: [
      ["F-rojo", "T-azul", "C-verde", "F-rojo", "J-azul"],
      ["V-verde", "T-rojo", "C-azul", "F-verde", "J-rojo"],
    ],
    capacidades: [4, 4, 4],
  },
  {
    // 2 vías de llegada · 3 destinos · capacidad exacta
    nombre: "Turno 4 · Encaje perfecto",
    llegada: [
      ["T-verde", "F-rojo", "C-azul", "F-verde", "J-rojo", "V-azul"],
      ["C-rojo", "T-azul", "F-verde", "V-rojo", "J-azul"],
    ],
    capacidades: [4, 3, 4],
  },
  {
    // 2 vías de llegada · 4 destinos, solo 3 vías de clasificación → 1 salto inevitable
    nombre: "Turno 5 · Un destino de más",
    llegada: [
      ["F-rojo", "T-azul", "C-verde", "F-ambar", "J-rojo", "V-azul"],
      ["C-ambar", "T-verde", "F-rojo", "V-ambar", "J-azul", "C-verde"],
    ],
    capacidades: [3, 3, 6],
  },
  {
    // 3 vías de llegada · 4 destinos · 4 vías de clasificación, capacidad exacta
    nombre: "Turno 6 · Patio grande",
    llegada: [
      ["F-rojo", "T-azul", "V-verde", "C-ambar", "J-rojo", "T-verde"],
      ["C-rojo", "F-azul", "V-ambar", "J-verde", "T-rojo"],
      ["C-azul", "F-verde", "V-rojo", "J-ambar", "T-azul"],
    ],
    capacidades: [5, 4, 4, 3],
  },
  {
    // 3 vías de llegada · 4 destinos, solo 3 vías de clasificación → 1 salto inevitable, capacidad exacta
    nombre: "Turno 7 · Yarda reducida",
    llegada: [
      ["T-rojo", "F-verde", "C-azul", "J-ambar", "V-rojo", "T-verde"],
      ["C-verde", "F-rojo", "V-azul", "J-rojo", "T-ambar"],
      ["C-rojo", "F-azul", "V-verde", "J-azul", "T-ambar"],
    ],
    capacidades: [5, 4, 7],
  },
  {
    // 3 vías de llegada · 5 destinos, 4 vías de clasificación → 1 salto inevitable
    nombre: "Turno 8 · Cinco destinos",
    llegada: [
      ["F-rojo", "T-azul", "V-verde", "C-ambar", "J-violeta", "T-rojo"],
      ["C-azul", "F-verde", "V-ambar", "J-rojo", "T-violeta", "C-azul"],
      ["F-violeta", "T-rojo", "V-azul", "J-verde", "C-ambar"],
    ],
    capacidades: [4, 4, 3, 6],
  },
  {
    // 4 vías de llegada · 5 destinos, solo 3 vías de clasificación → 2 saltos inevitables
    nombre: "Turno 9 · Consolidación mayor",
    llegada: [
      ["F-rojo", "T-azul", "V-verde", "C-ambar", "J-violeta"],
      ["C-rojo", "F-azul", "V-verde", "J-ambar", "T-violeta"],
      ["T-rojo", "C-azul", "F-verde", "V-ambar", "J-violeta"],
      ["J-rojo", "T-azul", "C-verde", "F-ambar", "V-violeta"],
    ],
    capacidades: [4, 4, 12],
  },
  {
    // 4 vías de llegada · 5 destinos · 4 vías de clasificación, capacidad exacta → 1 salto inevitable
    nombre: "Turno 10 · Hora pico final",
    llegada: [
      ["F-rojo", "T-azul", "V-verde", "C-ambar", "J-violeta", "T-rojo"],
      ["C-azul", "F-verde", "V-ambar", "J-violeta", "T-rojo", "C-azul"],
      ["F-violeta", "T-ambar", "V-rojo", "J-azul", "C-verde"],
      ["T-verde", "C-rojo", "F-azul", "V-violeta", "J-ambar"],
    ],
    capacidades: [5, 5, 4, 8],
  },
];

// ---------------- constantes visuales ----------------
const COLORES = {
  rojo:    { fill: "#E14B4B", dark: "#A83232", nombre: "Rojo" },
  azul:    { fill: "#3E8EDE", dark: "#2A66A6", nombre: "Azul" },
  verde:   { fill: "#47B26B", dark: "#2F8A4E", nombre: "Verde" },
  ambar:   { fill: "#E9C63F", dark: "#B3952B", nombre: "Ámbar" },
  violeta: { fill: "#9B6BD6", dark: "#7248A8", nombre: "Violeta" },
};

const TIPOS = { F: "Furgón", T: "Tanque", V: "Tolva", J: "Jaula", C: "Contenedor" };

const parse = (s) => {
  const [t, c] = s.split("-");
  return { tipo: t, color: c };
};

// ---------------- SVG de carros ----------------
function Carro({ code, ancho = 58, resaltado = false }) {
  const { tipo, color } = parse(code);
  const col = COLORES[color];
  const h = 42;
  const cuerpo = () => {
    switch (tipo) {
      case "F": // furgón: caja con puerta corrediza
        return (
          <>
            <rect x="4" y="6" width="50" height="22" rx="2" fill={col.fill} stroke={col.dark} strokeWidth="1.5" />
            <rect x="23" y="9" width="12" height="16" fill={col.dark} opacity="0.55" rx="1" />
            <line x1="29" y1="9" x2="29" y2="25" stroke={col.fill} strokeWidth="1.5" />
          </>
        );
      case "T": // tanque: cilindro sobre bastidor
        return (
          <>
            <rect x="4" y="24" width="50" height="4" fill="#5A6472" rx="1" />
            <rect x="6" y="8" width="46" height="17" rx="8.5" fill={col.fill} stroke={col.dark} strokeWidth="1.5" />
            <rect x="25" y="4" width="8" height="6" rx="2" fill={col.dark} />
          </>
        );
      case "V": // tolva: trapecio
        return (
          <>
            <path d="M4 8 h50 v12 l-10 8 h-30 l-10 -8 z" fill={col.fill} stroke={col.dark} strokeWidth="1.5" />
            <line x1="19" y1="8" x2="19" y2="24" stroke={col.dark} strokeWidth="1.5" opacity="0.6" />
            <line x1="39" y1="8" x2="39" y2="24" stroke={col.dark} strokeWidth="1.5" opacity="0.6" />
          </>
        );
      case "J": // jaula: listones verticales
        return (
          <>
            <rect x="4" y="6" width="50" height="22" rx="2" fill={col.dark} />
            {[9, 16, 23, 30, 37, 44].map((x) => (
              <rect key={x} x={x} y="8" width="4" height="18" fill={col.fill} rx="1" />
            ))}
            <rect x="4" y="6" width="50" height="4" fill={col.fill} rx="2" />
          </>
        );
      case "C": // contenedor sobre plataforma
        return (
          <>
            <rect x="4" y="24" width="50" height="4" fill="#5A6472" rx="1" />
            <rect x="8" y="8" width="42" height="16" fill={col.fill} stroke={col.dark} strokeWidth="1.5" rx="1" />
            {[15, 22, 29, 36, 43].map((x) => (
              <line key={x} x1={x} y1="9" x2={x} y2="23" stroke={col.dark} strokeWidth="1" opacity="0.5" />
            ))}
          </>
        );
      default:
        return null;
    }
  };
  return (
    <svg
      width={ancho}
      height={h}
      viewBox="0 0 58 42"
      style={{
        flexShrink: 0,
        filter: resaltado ? "drop-shadow(0 0 6px #F5A623)" : "none",
        transition: "filter .2s",
      }}
    >
      {cuerpo()}
      <circle cx="14" cy="33" r="5" fill="#252B35" stroke="#6B7585" strokeWidth="1.5" />
      <circle cx="44" cy="33" r="5" fill="#252B35" stroke="#6B7585" strokeWidth="1.5" />
      <circle cx="14" cy="33" r="1.6" fill="#6B7585" />
      <circle cx="44" cy="33" r="1.6" fill="#6B7585" />
    </svg>
  );
}

// ---------------- cálculo de puntaje ----------------
function saltosDeVia(via) {
  let s = 0;
  for (let i = 1; i < via.length; i++) {
    if (parse(via[i]).color !== parse(via[i - 1]).color) s++;
  }
  return s;
}

function calcularPuntaje(vias) {
  let puntos = 0, saltos = 0, purasBonus = 0, carros = 0;
  vias.forEach((v) => {
    carros += v.length;
    const s = saltosDeVia(v);
    saltos += s;
    if (v.length > 0 && s === 0) purasBonus += 30;
  });
  puntos = carros * 10 - saltos * 15 + purasBonus;
  return { puntos: Math.max(0, puntos), saltos, purasBonus, carros };
}

function puntajeMaximo(nivel) {
  const total = nivel.llegada.flat().length;
  // ideal: 0 saltos y todas las vías usadas puras
  const coloresUsados = new Set(nivel.llegada.flat().map((c) => parse(c).color)).size;
  const viasPuras = Math.min(nivel.capacidades.length, coloresUsados);
  // si hay más colores que vías, habrá al menos (colores - vías) saltos
  const saltosMin = Math.max(0, coloresUsados - nivel.capacidades.length);
  const puras = saltosMin > 0 ? nivel.capacidades.length - 1 : viasPuras;
  return total * 10 - saltosMin * 15 + puras * 30;
}

// ---------------- componente principal ----------------
export default function PatioClasificacion() {
  const [nivelIdx, setNivelIdx] = useState(0);
  const [llegada, setLlegada] = useState(NIVELES[0].llegada.map((v) => [...v]));
  const [clasif, setClasif] = useState(NIVELES[0].capacidades.map(() => []));
  const [viaSel, setViaSel] = useState(0);
  const [historial, setHistorial] = useState([]);
  const [totalAcum, setTotalAcum] = useState(0);
  const [pantalla, setPantalla] = useState("juego"); // juego | resumen | fin

  const nivel = NIVELES[nivelIdx];
  const restantes = llegada.reduce((a, v) => a + v.length, 0);
  const terminado = restantes === 0;
  const parcial = useMemo(() => calcularPuntaje(clasif), [clasif]);
  const maxNivel = useMemo(() => puntajeMaximo(nivel), [nivel]);

  const cargarNivel = (idx) => {
    setNivelIdx(idx);
    setLlegada(NIVELES[idx].llegada.map((v) => [...v]));
    setClasif(NIVELES[idx].capacidades.map(() => []));
    setViaSel(0);
    setHistorial([]);
    setPantalla("juego");
  };

  const empujar = (destino) => {
    if (terminado) return;
    const via = llegada[viaSel];
    if (!via || via.length === 0) return;
    if (clasif[destino].length >= nivel.capacidades[destino]) return;
    const carro = via[0];
    const nuevaLlegada = llegada.map((v, i) => (i === viaSel ? v.slice(1) : v));
    const nuevaClasif = clasif.map((v, i) => (i === destino ? [...v, carro] : v));
    setHistorial([...historial, { llegada, clasif, viaSel }]);
    setLlegada(nuevaLlegada);
    setClasif(nuevaClasif);
    // si la vía seleccionada quedó vacía, saltar a otra con carros
    if (nuevaLlegada[viaSel].length === 0) {
      const otra = nuevaLlegada.findIndex((v) => v.length > 0);
      if (otra >= 0) setViaSel(otra);
    }
    if (nuevaLlegada.every((v) => v.length === 0)) {
      setTimeout(() => setPantalla("resumen"), 400);
    }
  };

  const deshacer = () => {
    if (historial.length === 0) return;
    const prev = historial[historial.length - 1];
    setLlegada(prev.llegada);
    setClasif(prev.clasif);
    setViaSel(prev.viaSel);
    setHistorial(historial.slice(0, -1));
  };

  const estrellas = (pts) => {
    const r = pts / maxNivel;
    return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1;
  };

  const S = {
    fondo: { background: "#14181F", minHeight: "100vh", color: "#E8EAED", fontFamily: "system-ui, sans-serif" },
    panel: { background: "#1E242E", border: "1px solid #2C3441", borderRadius: 10 },
    etiqueta: {
      fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.12em",
      textTransform: "uppercase", color: "#8A94A6",
    },
    ambar: "#F5A623",
  };

  // ---------- pantalla resumen ----------
  if (pantalla === "resumen" || pantalla === "fin") {
    const res = calcularPuntaje(clasif);
    const est = estrellas(res.puntos);
    const esUltimo = nivelIdx === NIVELES.length - 1;
    return (
      <div style={S.fondo} className="flex items-center justify-center p-4">
        <div style={S.panel} className="w-full max-w-sm p-6 text-center">
          <div style={S.etiqueta}>Reporte del despachador</div>
          <h2 className="text-xl font-bold mt-1 mb-3">{nivel.nombre}</h2>
          <div className="text-4xl mb-2" style={{ color: S.ambar }}>
            {"★".repeat(est)}<span style={{ color: "#3A4353" }}>{"★".repeat(3 - est)}</span>
          </div>
          <div className="text-5xl font-bold mb-1" style={{ fontFamily: "ui-monospace, monospace" }}>
            {res.puntos}
          </div>
          <div style={S.etiqueta} className="mb-4">de {maxNivel} posibles</div>
          <div className="text-sm text-left mx-auto mb-5 space-y-1" style={{ maxWidth: 240 }}>
            <div className="flex justify-between"><span>Carros clasificados</span><span style={{ fontFamily: "monospace" }}>+{res.carros * 10}</span></div>
            <div className="flex justify-between" style={{ color: res.saltos ? "#E14B4B" : "#8A94A6" }}>
              <span>Saltos de color ({res.saltos})</span><span style={{ fontFamily: "monospace" }}>−{res.saltos * 15}</span>
            </div>
            <div className="flex justify-between" style={{ color: "#47B26B" }}>
              <span>Vías de un solo destino</span><span style={{ fontFamily: "monospace" }}>+{res.purasBonus}</span>
            </div>
            <div className="flex justify-between pt-1 mt-1" style={{ borderTop: "1px solid #2C3441" }}>
              <span>Total acumulado</span><span style={{ fontFamily: "monospace" }}>{totalAcum + res.puntos}</span>
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => cargarNivel(nivelIdx)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "#2C3441", color: "#E8EAED" }}>
              Reintentar
            </button>
            {!esUltimo ? (
              <button onClick={() => { setTotalAcum(totalAcum + res.puntos); cargarNivel(nivelIdx + 1); }}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: S.ambar, color: "#14181F" }}>
                Siguiente turno →
              </button>
            ) : (
              <button onClick={() => { setTotalAcum(0); cargarNivel(0); }}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: S.ambar, color: "#14181F" }}>
                Jugar de nuevo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- pantalla de juego ----------
  const cabeza = llegada[viaSel] && llegada[viaSel][0];

  return (
    <div style={S.fondo} className="p-3 pb-8">
      {/* encabezado */}
      <div className="flex items-center justify-between mb-2 max-w-2xl mx-auto">
        <div>
          <div style={S.etiqueta}>Nivel {nivelIdx + 1} / {NIVELES.length}</div>
          <div className="font-bold text-lg leading-tight">{nivel.nombre}</div>
        </div>
        <div className="text-right">
          <div style={S.etiqueta}>Puntaje</div>
          <div className="text-xl font-bold" style={{ fontFamily: "monospace", color: S.ambar }}>
            {parcial.puntos}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-3 max-w-2xl mx-auto overflow-x-auto pb-1">
        {NIVELES.map((n, i) => (
          <button key={i} onClick={() => cargarNivel(i)}
            title={n.nombre}
            className="flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: i === nivelIdx ? S.ambar : "#1E242E",
              color: i === nivelIdx ? "#14181F" : "#8A94A6",
              border: "1px solid " + (i === nivelIdx ? S.ambar : "#2C3441"),
            }}>
            {i + 1}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4 max-w-2xl mx-auto">
        <button onClick={deshacer} disabled={historial.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "#2C3441", opacity: historial.length ? 1 : 0.4 }}>
          ↩ Deshacer
        </button>
        <button onClick={() => cargarNivel(nivelIdx)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "#2C3441" }}>
          ⟲ Reiniciar turno
        </button>
        <div className="ml-auto self-center text-xs" style={{ color: "#8A94A6" }}>
          {restantes} carro{restantes !== 1 ? "s" : ""} por clasificar
        </div>
      </div>

      {/* vías de llegada */}
      <div className="max-w-2xl mx-auto mb-5">
        <div style={S.etiqueta} className="mb-2">Vías de llegada — toca una para trabajarla</div>
        <div className="space-y-2">
          {llegada.map((via, i) => {
            const activa = i === viaSel;
            return (
              <button key={i} onClick={() => setViaSel(i)}
                className="w-full text-left p-2 flex items-center gap-1 overflow-x-auto"
                style={{
                  ...S.panel,
                  borderColor: activa ? S.ambar : "#2C3441",
                  background: activa ? "#232B38" : "#1E242E",
                  opacity: via.length === 0 ? 0.35 : 1,
                }}>
                <span className="mr-1 text-lg" style={{ color: activa ? S.ambar : "#4A5361" }}>
                  {activa ? "▶" : "○"}
                </span>
                {via.length === 0 ? (
                  <span className="text-xs" style={{ color: "#8A94A6" }}>Vía vacía</span>
                ) : (
                  via.map((c, j) => (
                    <Carro key={j} code={c} resaltado={activa && j === 0} />
                  ))
                )}
              </button>
            );
          })}
        </div>
        {cabeza && (
          <div className="mt-1 text-xs" style={{ color: "#8A94A6" }}>
            Próximo a empujar: <b style={{ color: COLORES[parse(cabeza).color].fill }}>
              {TIPOS[parse(cabeza).tipo]} · destino {COLORES[parse(cabeza).color].nombre}
            </b>
          </div>
        )}
      </div>

      {/* vías de clasificación */}
      <div className="max-w-2xl mx-auto">
        <div style={S.etiqueta} className="mb-2">Vías de clasificación — toca una para enviar el carro</div>
        <div className="space-y-2">
          {clasif.map((via, i) => {
            const cap = nivel.capacidades[i];
            const llena = via.length >= cap;
            const s = saltosDeVia(via);
            return (
              <button key={i} onClick={() => empujar(i)} disabled={llena || !cabeza}
                className="w-full text-left p-2"
                style={{ ...S.panel, borderColor: llena ? "#E14B4B44" : "#2C3441", opacity: llena && !via.length ? 0.5 : 1 }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={S.etiqueta}>Vía {String.fromCharCode(65 + i)}</span>
                  <span className="text-xs" style={{ fontFamily: "monospace", color: llena ? "#E14B4B" : "#8A94A6" }}>
                    {via.length}/{cap} {llena ? "· LLENA" : ""}
                    {s > 0 && <span style={{ color: "#E14B4B" }}> · {s} salto{s > 1 ? "s" : ""}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {via.map((c, j) => <Carro key={j} code={c} />)}
                  {Array.from({ length: cap - via.length }).map((_, j) => (
                    <div key={"e" + j}
                      style={{
                        width: 58, height: 42, flexShrink: 0, borderRadius: 6,
                        border: "1.5px dashed #3A4353",
                      }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-xs leading-relaxed" style={{ color: "#8A94A6" }}>
          Regla del lomo: solo puedes empujar el <b>primer carro</b> de la vía de llegada
          seleccionada. Cada cambio de color dentro de una vía de clasificación resta 15 puntos;
          una vía con un solo destino suma 30 de bono.
        </div>
      </div>
    </div>
  );
}
