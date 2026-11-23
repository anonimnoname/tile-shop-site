// =============================================================
//  КАТАЛОГ — крупноформатный керамогранит.
//  На сервере каталог ведётся в админке (/admin); этот файл — стартовый набор
//  и запасной вариант, если сайт открыт без сервера.
//
//  w, h    — размер плитки в см: 60×120, 75×150 или 80×135
//  price   — цена за 1 м²; box — м² в коробке
//  style   — стиль: marble, onyx, stone, concrete, terrazzo, solid
//  use     — wall / floor / plinth / outdoor; cats — разделы каталога
//  isNew   — показать в «Новинках»
//  image   — фото одной плитки сверху (лучше всего), иначе рисуется имитация по material
//
//  ЦЕНЫ И НАЗВАНИЯ — ПРИМЕРЫ. Замените на реальные товары.
// =============================================================
window.SIZES = [
  { w: 60, h: 120, title: '60×120', note: 'Самый ходовой формат: ванные, кухни, полы в квартире' },
  { w: 75, h: 150, title: '75×150', note: 'Меньше швов на стене, эффект цельного камня' },
  { w: 80, h: 135, title: '80×135', note: 'Широкая плита для больших полов и акцентных стен' }
];

window.STYLES = [
  { id: 'marble', title: 'Мрамор', text: 'Калакатта, Статуарио, Неро — классика, которая не надоедает.' },
  { id: 'onyx', title: 'Оникс', text: 'Тёплое свечение и глубокий рисунок для акцентных стен.' },
  { id: 'stone', title: 'Камень и травертин', text: 'Натуральная фактура и спокойные бежевые тона.' },
  { id: 'concrete', title: 'Бетон и микроцемент', text: 'Минимализм, лофт, современная ванная.' },
  { id: 'terrazzo', title: 'Терраццо', text: 'Итальянская крошка: весело, но со вкусом.' },
  { id: 'solid', title: 'Однотонные', text: 'Чистый цвет и бархатная матовая поверхность.' }
];

window.CATALOG = [
  { id: 'calacatta-gold-60x120', name: 'Калакатта Голд', collection: 'Marmo Lux', country: 'Индия', style: 'marble',
    w: 60, h: 120, price: 245000, box: 1.44, finish: 'Полированный', inStock: true, isNew: true,
    use: ['wall', 'floor'], cats: ['bath', 'kitchen', 'floor', 'universal'],
    material: { type: 'marble', base: '#f3f0ea', vein: '#8f7c62', veinAlpha: 0.6, gloss: 1, clouds: '#e2d8c8' } },
  { id: 'statuario-75x150', name: 'Статуарио', collection: 'Marmo Lux', country: 'Индия', style: 'marble',
    w: 75, h: 150, price: 320000, box: 2.25, finish: 'Полированный', inStock: true, isNew: true,
    use: ['wall', 'floor'], cats: ['bath', 'kitchen', 'floor', 'universal'],
    material: { type: 'marble', base: '#f4f4f2', vein: '#6f7276', veinAlpha: 0.65, gloss: 1 } },
  { id: 'carrara-60x120', name: 'Каррара', collection: 'Marmo', country: 'Узбекистан', style: 'marble',
    w: 60, h: 120, price: 185000, box: 1.44, finish: 'Сатинированный', inStock: true,
    use: ['wall', 'floor'], cats: ['bath', 'kitchen', 'floor', 'universal'],
    material: { type: 'marble', base: '#ecebe8', vein: '#8b8e93', veinAlpha: 0.45, gloss: 0.55 } },
  { id: 'nero-marquina-80x135', name: 'Неро Маркина', collection: 'Marmo Lux', country: 'Индия', style: 'marble',
    w: 80, h: 135, price: 340000, box: 2.16, finish: 'Полированный', inStock: true,
    use: ['wall', 'floor'], cats: ['bath', 'universal', 'floor'],
    material: { type: 'marble', base: '#232427', vein: '#e9e6df', veinAlpha: 0.7, gloss: 1 } },
  { id: 'emperador-60x120', name: 'Эмперадор', collection: 'Marmo', country: 'Китай', style: 'marble',
    w: 60, h: 120, price: 215000, box: 1.44, finish: 'Полированный', inStock: true,
    use: ['wall', 'floor'], cats: ['bath', 'kitchen', 'universal'],
    material: { type: 'marble', base: '#5c4434', vein: '#d8c3a6', veinAlpha: 0.55, gloss: 0.95, clouds: '#3f2e23' } },
  { id: 'onyx-honey-75x150', name: 'Оникс медовый', collection: 'Onice', country: 'Индия', style: 'onyx',
    w: 75, h: 150, price: 360000, box: 2.25, finish: 'Полированный', inStock: true, isNew: true,
    use: ['wall', 'floor'], cats: ['bath', 'universal'],
    material: { type: 'marble', base: '#e6cfa6', vein: '#a9773d', veinAlpha: 0.5, gloss: 1, clouds: '#d2a96b' } },
  { id: 'onyx-pearl-60x120', name: 'Оникс жемчужный', collection: 'Onice', country: 'Китай', style: 'onyx',
    w: 60, h: 120, price: 265000, box: 1.44, finish: 'Полированный', inStock: true,
    use: ['wall', 'floor'], cats: ['bath', 'kitchen', 'universal'],
    material: { type: 'marble', base: '#efe9e0', vein: '#b9a58b', veinAlpha: 0.4, gloss: 1, clouds: '#ddd1c0' } },
  { id: 'travertine-classic-60x120', name: 'Травертин классик', collection: 'Pietra', country: 'Индия', style: 'stone',
    w: 60, h: 120, price: 198000, box: 1.44, finish: 'Матовый', inStock: true,
    use: ['wall', 'floor', 'plinth', 'outdoor'], cats: ['floor', 'universal', 'bath', 'outdoor'],
    material: { type: 'travertine', base: '#ddcfb8', line: '#b9a588', gloss: 0.15 } },
  { id: 'limestone-80x135', name: 'Известняк крема', collection: 'Pietra', country: 'Испания', style: 'stone',
    w: 80, h: 135, price: 295000, box: 2.16, finish: 'Матовый, структурный', inStock: true, isNew: true,
    use: ['wall', 'floor', 'plinth', 'outdoor'], cats: ['floor', 'universal', 'outdoor'],
    material: { type: 'stone', base: '#d9ccb4', speck: 0.6, gloss: 0.1 } },
  { id: 'slate-graphite-60x120', name: 'Сланец графит', collection: 'Pietra', country: 'Китай', style: 'stone',
    w: 60, h: 120, price: 175000, box: 1.44, finish: 'Рельеф «камень», R11', inStock: true,
    use: ['plinth', 'outdoor', 'wall', 'floor'], cats: ['outdoor', 'universal'],
    material: { type: 'slate', base: '#4f5154', gloss: 0 } },
  { id: 'concrete-grey-60x120', name: 'Бетон серый', collection: 'Urban', country: 'Узбекистан', style: 'concrete',
    w: 60, h: 120, price: 150000, box: 1.44, finish: 'Матовый', inStock: true,
    use: ['wall', 'floor', 'plinth', 'outdoor'], cats: ['floor', 'universal', 'bath', 'kitchen', 'outdoor'],
    material: { type: 'stone', base: '#9c9b97', speck: 0.4, gloss: 0.05 } },
  { id: 'microcement-sand-75x150', name: 'Микроцемент песок', collection: 'Urban', country: 'Испания', style: 'concrete',
    w: 75, h: 150, price: 255000, box: 2.25, finish: 'Матовый, бархат', inStock: true, isNew: true,
    use: ['wall', 'floor'], cats: ['bath', 'kitchen', 'floor', 'universal'],
    material: { type: 'stone', base: '#cbbfae', speck: 0.25, gloss: 0.1 } },
  { id: 'microcement-anthracite-80x135', name: 'Микроцемент антрацит', collection: 'Urban', country: 'Испания', style: 'concrete',
    w: 80, h: 135, price: 270000, box: 2.16, finish: 'Матовый, бархат', inStock: false,
    use: ['wall', 'floor'], cats: ['bath', 'floor', 'universal'],
    material: { type: 'stone', base: '#4a4b4d', speck: 0.3, gloss: 0.1 } },
  { id: 'terrazzo-venice-60x120', name: 'Терраццо Венеция', collection: 'Venezia', country: 'Китай', style: 'terrazzo',
    w: 60, h: 120, price: 190000, box: 1.44, finish: 'Матовый', inStock: true,
    use: ['wall', 'floor'], cats: ['floor', 'universal', 'kitchen'],
    material: { type: 'terrazzo', base: '#eeebe5', chips: ['#c9b9a6', '#8a8d91', '#d98f6f', '#4f5559', '#e3d3bf'], gloss: 0.25 } },
  { id: 'terrazzo-rosa-75x150', name: 'Терраццо роза', collection: 'Venezia', country: 'Испания', style: 'terrazzo',
    w: 75, h: 150, price: 240000, box: 2.25, finish: 'Матовый', inStock: true,
    use: ['wall', 'floor'], cats: ['bath', 'universal'],
    material: { type: 'terrazzo', base: '#ecdcd3', chips: ['#c98d7c', '#a9a29a', '#efe7e1', '#8c5d4f'], gloss: 0.25 } },
  { id: 'solid-ivory-60x120', name: 'Слоновая кость', collection: 'Colori', country: 'Узбекистан', style: 'solid',
    w: 60, h: 120, price: 140000, box: 1.44, finish: 'Матовый', inStock: true,
    use: ['wall', 'floor'], cats: ['bath', 'kitchen', 'floor', 'universal'],
    material: { type: 'solid', color: '#ece6da', gloss: 0.15 } },
  { id: 'solid-sage-75x150', name: 'Шалфей', collection: 'Colori', country: 'Испания', style: 'solid',
    w: 75, h: 150, price: 230000, box: 2.25, finish: 'Матовый, бархат', inStock: true, isNew: true,
    use: ['wall'], cats: ['bath', 'kitchen'],
    material: { type: 'solid', color: '#a7b29c', gloss: 0.15 } },
  { id: 'solid-graphite-80x135', name: 'Графит', collection: 'Colori', country: 'Испания', style: 'solid',
    w: 80, h: 135, price: 250000, box: 2.16, finish: 'Матовый', inStock: true,
    use: ['wall', 'floor'], cats: ['bath', 'universal', 'floor'],
    material: { type: 'solid', color: '#3c3e42', gloss: 0.2 } }
];
