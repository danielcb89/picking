// ════════════════════════════════════════════════════════════════
// state.js — Variables globales compartidas entre todos los módulos
// Cargado primero. El resto de ficheros leen y escriben sobre estas.
// ════════════════════════════════════════════════════════════════

// ── Datos procesados ────────────────────────────────────────────
let ARTS   = [];   // Array de artículos normalizados
let LOCS_C = [];   // Localizaciones del almacén CENTRAL
let LOCS_A = [];   // Localizaciones del almacén AUXILIAR1
let MAP_C  = {};   // Mapa CENTRAL:  pasillo -> estantería -> {s[], pk[]}
let MAP_A  = {};   // Mapa AUXILIAR1: pasillo -> estantería -> {s[], pk[]}
let BAD    = [];   // Localizaciones a revisar (peso > 20kg, ≥5/sem, sin suelo)
let STATS  = {};   // Resumen de contadores para la cabecera
let LOC_DATA = {}; // Lookup rápido: código_loc -> {cap, lt, arts, almacen}

// ── Top 5 menor rotación por almacén/tipo (para resaltar en el mapa) ──
let LOW_ROT = { csuelo: new Set(), cpick: new Set(), asuelo: new Set(), apick: new Set() };

// ── Layouts de planta (leídos desde pestañas del Excel de ubicaciones) ──
let LAYOUTS       = []; // Array de { nombre, grid } — una entrada por pestaña de layout
let currentLayout = 0;  // Índice del layout activo en el selector de tabs

// ── Picking libre / Espacio disponible ──────────────────────────
let LIBRE_ALL     = []; // Todas las posiciones de picking + suelo, con datos de volumen
let freeThreshold = 50; // % libre mínimo para considerar "espacio disponible" (25/50/75/100)
let freeAlmacen   = '';  // Filtro de almacén: '' (ambos) | 'CENTRAL' | 'AUXILIAR1'

// ── Estado de la vista Artículos ────────────────────────────────
let filteredArts = [];
let curPage      = 1;
let sortK        = 's';   // campo de ordenación activo
let sortD        = 'd';   // dirección: 'a' ascendente / 'd' descendente

// ── Ordenación por clic en encabezados (Artículos, Revisar, Picking libre)
let sortStates = {
  arts:  { k: 's',        d: 'd' },
  peso:  { k: 's',        d: 'd' },
  libre: { k: 'pctLibre', d: 'a' },
};

let pesoSearch  = ''; // término de búsqueda activo en Revisar localización
let libreSearch = ''; // término de búsqueda activo en Picking libre

// ── Constantes ──────────────────────────────────────────────────
const PAGE = 100; // artículos por página

// ── Ficheros pendientes de procesar ─────────────────────────────
let rawFile1      = null; // Informe de artículos (subido manualmente)
let selectedStore = null; // Código de tienda elegido: 'PMI' | 'TFE' | 'GCA' | 'LZA'

// ── Mapa de tiendas → fichero de ubicaciones ────────────────────
const STORE_FILES = {
  PMI: { nombre: 'Palma de Mallorca', archivo: 'almacenes/PMI_ubicaciones.xlsx' },
  TFE: { nombre: 'Tenerife',          archivo: 'almacenes/TFE_ubicaciones.xlsx' },
  GCA: { nombre: 'Gran Canaria',      archivo: 'almacenes/GCA_ubicaciones.xlsx' },
  LZA: { nombre: 'Lanzarote',         archivo: 'almacenes/LZA_ubicaciones.xlsx' },
};
