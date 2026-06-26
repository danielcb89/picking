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
let HEAVY  = [];   // Artículos pesados sin suelo (peso > CFG.pesado, vta ≥ CFG.rotacion, sin posición de suelo)
let STATS  = {};   // Resumen de contadores para la cabecera
let LOC_DATA = {}; // Lookup rápido: código_loc -> {cap, lt, arts, almacen}

// ── Top 5 menor rotación por almacén/tipo (para resaltar en el mapa) ──
let LOW_ROT = { csuelo: new Set(), cpick: new Set(), asuelo: new Set(), apick: new Set() };

// ── Layouts de planta (leídos desde pestañas del Excel de ubicaciones) ──
let LAYOUTS       = []; // Array de { nombre, grid } — una entrada por pestaña de layout
let currentLayout = 0;  // Índice del layout activo en el selector de tabs

// ── Configuración global (panel Ajustes) ────────────────────────
const CFG_DEFAULTS = {
  rotacion:    20,   // uds/mes — umbral de alta rotación
  pesado:      20,   // kg — límite para considerar manipulación pesada
  topN:        5,    // N — top menor rotación por almacén
  espLibre:    50,   // % libre mínimo para Picking libre
};
let CFG = { ...CFG_DEFAULTS };

// ── Picking libre / Espacio disponible ──────────────────────────
const PALLETS_POR_SUELO = 3; // capacidad fija de pallets por localización de suelo
let LIBRE_ALL     = []; // Todas las posiciones de picking + suelo, con datos de volumen
let FLOOR_FREE    = new Set(); // Códigos de suelo con al menos 1 pallet libre (para color teal en mapa)
let freeThreshold = 50; // % libre mínimo para considerar "espacio disponible" (25/50/75/100)
let freeAlmacen   = '';  // Filtro de almacén: '' (ambos) | 'CENTRAL' | 'AUXILIAR1'
let libreCardFilter = ''; // Filtro activo por tarjeta en Picking libre: '' | 'picking-c' | 'picking-a' | 'suelo-c' | 'suelo-a' | 'pallet-libre'
let pesadosCardFilter = ''; // Filtro activo por tarjeta en Artículos pesados: '' | 'picking' | 'central' | 'aux'

// ── Bye bye (artículos NS con localización asignada) ─────────────
let BYE = []; // Array de artículos NS con loc — uno por cada localización que ocupan (Central y/o Aux1)
let NS_LOCS = new Set(); // Lookup rápido: códigos de localización con algún artículo NS (color mapa)
let byeSearch = '';
let byeCardFilter = ''; // '' | 'central' | 'aux'

// ── Estado de la vista Artículos ────────────────────────────────
let filteredArts = [];
let curPage      = 1;
let sortK        = 's';   // campo de ordenación activo
let sortD        = 'd';   // dirección: 'a' ascendente / 'd' descendente

// ── Ordenación por clic en encabezados (Artículos, Revisar, Picking libre)
let sortStates = {
  arts:  { k: 's',        d: 'd' },
  pesados: { k: 's',        d: 'd' },
  libre: { k: 'pctLibre', d: 'a' },
  bye:   { k: 'endsale',  d: 'a' },
};

let pesadosSearch = ''; // término de búsqueda activo en Artículos pesados
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
