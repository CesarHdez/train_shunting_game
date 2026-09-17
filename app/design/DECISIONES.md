# Decisiones acordadas con el usuario — NO DESHACER

Acta viva de todo lo que el usuario ha pedido y aprobado en este proyecto.
**Todo agente que toque este repositorio debe leer este archivo antes de editar
nada.** Si un cambio nuevo obliga a contradecir algo de aquí, NO lo hagas por tu
cuenta: repórtalo y deja que el usuario decida.

Cada punto está aprobado y verificado en pantalla. Romper uno es una regresión,
aunque el encargo que estés ejecutando no lo mencione.

---

## 1. Animación de maniobra (Patio de Maniobras)

- **Retroceso real (switchback).** El tren completo sale por la vía de origen,
  recorre la curva del peine, pasa el nudo de convergencia ("la punta") y sigue
  por la vía de tiro hasta que el **último vagón** ha rebasado el nudo. Pausa
  breve (se "cambia la aguja"). Luego el tren entero **retrocede** hacia la vía
  de destino. Salirse del cuadro por el lateral es correcto y está aprobado.
- **El convoy es rígido.** Todas las unidades mantienen una separación constante
  medida en longitud de arco sobre el riel. Los vagones nunca se superponen ni
  se estiran. Nada corta camino entre vías: se circula sobre la geometría de la
  vía, no en línea recta.
- **Los vagones que ya estaban en la vía de destino NO se desplazan al empezar
  el movimiento.** Permanecen en su columna original hasta que el corte que
  llega los alcanza; desde el contacto, se empujan de forma rígida, a la misma
  velocidad, y aterrizan en su posición final justo cuando el tren se detiene.
  El instante de contacto se deriva de la geometría, no de una fracción fija.
- Aplica igual a **deshacer** (la animación inversa) y al movimiento de la
  locomotora sola.
- **Entrada inicial de la locomotora:** al elegir la vía por primera vez, la
  locomotora **no aparece de golpe**: entra rodando desde el lateral que le
  corresponde (izquierda para la locomotora izquierda, derecha para la derecha).

## 2. Dibujo de la locomotora

- Silueta de **road switcher** tipo EMD: capó largo y bajo, cabina alta con
  techo plano (es el punto más alto), capó corto con frente recto, pasarela
  corrida, tanque bajo el bastidor, pasamanos.
- **Librea roja dominante con un segundo color (verde oscuro) en diagonal**, más
  la franja clara del bastidor.
- **Prohibido cualquier cartel**: sin letras, logos, números ni placas de
  numeración. De la referencia se toma la forma y la idea de color, nunca la
  marca.
- **Ventanillas**: parabrisas inclinado y ventana lateral, vidrio oscuro con
  reflejo claro.
- **Faro sí, haz de luz no.** Se conserva la luz del frente; se elimina el
  trapecio/halo que proyecta hacia adelante.
- **Tamaño contenido**: `LOCO_WIDTH_FACTOR` máx. ~1.3 respecto al ancho del
  vagón. El límite del usuario es de *huella*, no de altura.
- La locomotora **activa** conserva su brillo y su sombra de contacto.

## 3. Locomotoras inactivas ("plazas fantasma")

- Las vías sin locomotora muestran una **silueta fantasma translúcida con
  contorno discontinuo**, no una locomotora gris sólida. Deben leerse como "aquí
  podría ir", no como un objeto presente.
- Se tiñen con la paleta de la hora activa. Ligeramente más visibles cuando esa
  vía es un destino válido.
- **Sin desenfoque** (`BlurMask`) en las inactivas: hay muchas en pantalla y la
  superficie se repinta en cada fotograma.

## 4. Dibujo de los vagones

- Cinco tipos con **silueta reconocible**, caricatura pero creíble; nada de
  rectángulos apenas redondeados: cubierto, góndola, cisterna, tolva y balasto.
- **Tolva = cementera gris**, paredes casi verticales y **tres compuertas de
  descarga** colgando entre los bogies (por encima del riel). Nada de forma de
  reloj de arena.
- **Cisterna casi negra**, conservando el modelado del cilindro: hay que abrir
  la diferencia entre luz y sombra y mantener el brillo. Los detalles sobre
  cuerpo oscuro van en claro translúcido, no en negro.
- **La selección sigue el contorno real del vagón**, no un rectángulo azul. El
  resplandor usa la misma silueta.
- Los detalles finos se simplifican en tamaños pequeños, pero **las tres
  compuertas de la tolva no desaparecen**: son su rasgo identificador.

## 5. Vías

- **Los rieles llegan y sobrepasan los bordes del cuadro** en todas las filas,
  para que se lea continuidad. Ninguna vía puede terminar flotando dentro del
  encuadre.
- La extensión se **deriva de la proyección de la cámara** (anclada a la fila
  más lejana, que es la que más distancia necesita), nunca con una constante
  fija que funcione solo en un nivel.
- Vale para **ambos modos**.

## 6. Sonido y vibración

- **El enganche suena al TERMINAR el movimiento**, nunca al iniciarlo. Igual el
  de victoria y el de récord.
- **Solo suena si hay un enganche real**: la locomotora engancha vagones, o los
  vagones que llegan se unen a vagones que ya estaban en la vía de destino y que
  antes no estaban conectados. Si el movimiento acaba sin formar una unión nueva
  (por ejemplo, llegar a una vía vacía), **no suena**.
- **Siguen siendo inmediatos** los sonidos que responden al toque: seleccionar,
  colocar la locomotora y movimiento inválido.
- Exactamente **un sonido por movimiento**, aunque se encadenen toques rápidos.
  Reiniciar el nivel descarta lo pendiente.

## 7. Cartel de victoria / puntuación

- **Se puede cerrar**: botón ✕, toque fuera del cuadro y botón atrás de Android.
  Al cerrarlo el HUD de atrás queda utilizable y el nivel sigue ganado.
- Un **chip de resultados** permite volver a abrirlo. No reaparece solo.
- **Sigue la paleta de la hora**, igual que el resto. La capa de fondo también
  se tiñe y baja de opacidad en las paletas claras: no puede ser un telón negro.
- Los colores de identidad (oro/plata/bronce) se **oscurecen lo justo** en
  paletas claras para superar el contraste mínimo; en las oscuras no se tocan.
- **Contenido centrado y coordinado**, sin filas de botones que se parten de
  forma irregular.

## 8. Tema por hora del día

- **Toda la app** sigue la paleta correspondiente a la hora real del
  dispositivo: menús, HUD del juego, tablero, avisos, tutorial y cartel.
- Franjas: 05–08 amanecer, 08–17 mediodía, 17–20 atardecer, 20–05 noche.
- Modo **automático por defecto**, con anulación manual en Ajustes ("Automático"
  como fila principal y las cuatro franjas debajo).
- Se reevalúa al montar, al volver del segundo plano y cada ~60 s.

## 9. Tipografía

- **Raleway en todo el texto renderizado por React Native**: menús, HUD del
  juego y cartel de puntuación.
- Única excepción: el texto dibujado **dentro del lienzo Skia** (letras de los
  vagones, contadores de capacidad), que usa su propia fuente incrustada.
- Ningún texto puede quedarse **sin familia definida**: cae en la fuente del
  sistema y desentona. Fue el fallo real de `Button`.

## 10. Iconografía y botones

- **Cero emojis** en toda la interfaz.
- Iconos de **Material Symbols (Apache 2.0)**. No usar The Noun Project:
  exige atribución o licencia de pago.
- Todos los iconos viven en `src/components/icons/index.tsx` y comparten API:
  `{ size?, color?, strokeWidth? }`. Se tiñen con la paleta.
- **Prohibido usar caracteres de texto como icono** (`←`, `↺`, `↩`, `✕`, `≡`,
  `→`, `↗`). Fue la causa de que nada se viera estandarizado.
- Botones por **variantes** (principal, secundario, peligro, deshacer) que
  toman el color de la paleta. Ningún sitio pasa colores a mano.
- **Una sola regla**: tamaño de icono relativo al texto, separación fija, y lado
  constante — delante para acciones, detrás para avanzar.
- Los botones **solo-icono** conservan su etiqueta de accesibilidad.

## 11. Invariantes técnicos

- **Las zonas táctiles no cambian.** Extender dibujos o mover arte no debe
  alterar ningún destino de toque ni hacer clicable el vacío.
- **Sin trabajo por fotograma en el hilo JS.** El movimiento vive en worklets de
  Reanimated alimentando props de Skia.
- **`BlurMask` solo en lo seleccionado/activo.**
- Los sprites se dibujan en **unidades locales**, esquina superior izquierda en
  (0,0) y el riel en `y = h`. El tablero los posiciona y escala.
- La app está **bloqueada en horizontal**: cualquier maqueta vertical hay que
  traducirla, no copiarla.
- **Puertas de calidad**: `npm test` y `npx tsc --noEmit` deben pasar. Quien
  entrega, las corre de verdad y reporta la salida real. El coordinador las
  verifica por su cuenta.
- La fidelidad a las reglas del juego original (`ref/`) manda sobre cualquier
  mejora visual.

---

## 12. Ajustes posteriores ya aprobados

Añadidos tras las primeras rondas. Valen igual que el resto: no deshacer.

- **Cabina de la locomotora, recortada.** Un poco más ancha y con la parte que
  sobresale por encima del capó un poco más baja. El usuario dijo "solo un
  poco" dos veces: es un recorte, no un rediseño. La rebaja sale del **dibujo**
  (caja de cabina más baja dentro del mismo sprite), nunca de encoger la
  locomotora entera, que debe seguir siendo la máquina más imponente del patio.
  Referencia medida: techo de cabina ≈ 1.13× la altura de techo de un vagón.
- **Entrada de la locomotora, breve.** Arranca **justo fuera del borde visible**
  del lienzo, no en el extremo donde sangran los rieles (§5), que está mucho más
  lejos y dejaba casi un segundo de pantalla sin nada tras el toque. La duración
  es aproximadamente la mitad de la de una maniobra normal. Debe seguir
  leyéndose como que llega desde fuera y engancha en ese primer movimiento.
- **Tarjetas de nivel compactas.** Fichas horizontales: número a la izquierda,
  estrellas a la derecha, franja de color del nivel y barra de progreso. Los
  bloqueados muestran un único candado, sin número. La altura está **acotada**
  (no es una proporción pura del ancho), porque una proporción hacía que la
  tarjeta creciera en pantallas anchas y el modo horizontal quedara con una fila
  y media. Referencia: en 844×390 entran tres filas completas.
- **Cartel de puntuación: una sola fila de acciones centrada.** Los cuatro
  botones son hermanos en una fila con envoltura centrada; nada de contenedores
  anidados sin dirección de flujo. Ancho del cartel hasta 640 pt con márgenes, y
  columnas del ranking de ancho fijo para que no se parta el texto.
