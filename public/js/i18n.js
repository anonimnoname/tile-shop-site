// Перевод сайта на узбекский (латиница). Кнопка «UZ / RU» в шапке.
// Работает поверх готовой страницы: заменяет русский текст на узбекский,
// в том числе в том, что появляется позже (панель конструктора, корзина, сообщения).
(function () {
  'use strict';
  let lang = 'ru';
  try { lang = localStorage.getItem('lang') || ((navigator.language || '').startsWith('uz') ? 'uz' : 'ru'); } catch (e) { /* нет хранилища */ }
  try { const q = new URLSearchParams(location.search).get('lang'); if (q === 'uz' || q === 'ru') lang = q; } catch (e) { /* ignore */ }

  // Полные фразы
  const D = {
    'К содержимому': 'Asosiy qismga',
    'На главную': 'Bosh sahifaga',
    'Главная': 'Bosh sahifa',
    'Конструктор': 'Konstruktor',
    '3D-конструктор': '3D-konstruktor',
    'Новинки': 'Yangiliklar',
    'Размеры': "O'lchamlar",
    'Каталог': 'Katalog',
    'Контакты': 'Aloqa',
    'Корзина': 'Savat',
    'Меню': 'Menyu',
    'Открыть меню': 'Menyuni ochish',
    'Закрыть меню': 'Menyuni yopish',
    'Закрыть': 'Yopish',
    'Магазин': "Do'kon",
    'Крупноформатный керамогранит': 'Katta formatli keramogranit',
    'Крупноформатный керамогранит — 3D-конструктор': 'Katta formatli keramogranit — 3D-konstruktor',
    'Большая плитка.': 'Katta plitka.',
    'Меньше швов.': 'Kamroq choklar.',
    'Больше простора.': "Ko'proq kenglik.",
    'Более 20 лет и 100 000 довольных клиентов. Самая стильная и новая плитка 60×120, 75×150 и 80×135 см по приемлемым ценам. Соберите свою комнату в 3D до покупки.':
      "20 yildan ortiq tajriba va 100 000 dan ortiq mamnun mijozlar. Eng zamonaviy va yangi 60×120, 75×150 va 80×135 sm plitkalar hamyonbop narxlarda. Xarid qilishdan oldin xonangizni 3D'da yig'ib ko'ring.",
    'Собрать комнату в 3D': "Xonani 3D'da yig'ish",
    'Смотреть коллекции': "Kolleksiyalarni ko'rish",
    'Листать вниз': 'Pastga',
    'лет': 'yil',
    'продаём кафельную плитку': 'kafel plitka sotamiz',
    'Более 20 лет мы занимаемся продажей кафельной плитки': '20 yildan ortiq vaqtdan beri kafel plitka sotish bilan shug‘ullanamiz',
    'Более 100 тысяч довольных клиентов. У нас вы найдёте всё самое стильное и новое по приемлемым ценам. Каждый месяц привозим новые коллекции крупного формата, поможем выбрать, посчитаем всё до коробки и привезём домой.':
      "100 mingdan ortiq mamnun mijozlar. Bizda eng zamonaviy va yangi plitkalarni hamyonbop narxlarda topasiz. Har oy katta formatdagi yangi kolleksiyalar keltiramiz, tanlashga yordam beramiz, qutigacha hisoblab, uyingizga yetkazib beramiz.",
    'лет на рынке': 'yil bozorda',
    'довольных клиентов': 'mamnun mijozlar',
    'крупных формата': 'ta katta format',
    'стилей': 'ta uslub',
    'Форматы': 'Formatlar',
    'Только крупный формат': 'Faqat katta format',
    'Меньше швов, проще уборка, комната визуально больше. Пропорции показаны в масштабе рядом с человеком ростом 175 см.':
      "Kamroq choklar, oson tozalash, xona kattaroq ko'rinadi. Nisbatlar bo'yi 175 sm bo'lgan odam yonida masshtabda ko'rsatilgan.",
    'Самый ходовой формат: ванные, кухни, полы в квартире': "Eng ommabop format: hammom, oshxona, kvartira pollari",
    'Меньше швов на стене, эффект цельного камня': "Devorda kamroq chok, yaxlit tosh effekti",
    'Широкая плита для больших полов и акцентных стен': "Katta pollar va urg'u devorlari uchun keng plita",
    'Стили': 'Uslublar',
    'Какой характер у вашего дома?': 'Uyingiz qanday xarakterga ega?',
    'Мрамор': 'Marmar',
    'Оникс': 'Oniks',
    'Камень и травертин': 'Tosh va travertin',
    'Бетон и микроцемент': 'Beton va mikrotsement',
    'Терраццо': 'Terratstso',
    'Однотонные': 'Bir rangli',
    'Калакатта, Статуарио, Неро — классика, которая не надоедает.': "Kalakatta, Statuario, Nero — hech qachon zeriktirmaydigan klassika.",
    'Тёплое свечение и глубокий рисунок для акцентных стен.': "Urg'u devorlari uchun iliq jilo va chuqur naqsh.",
    'Натуральная фактура и спокойные бежевые тона.': "Tabiiy faktura va sokin bej ranglar.",
    'Минимализм, лофт, современная ванная.': "Minimalizm, loft, zamonaviy hammom.",
    'Итальянская крошка: весело, но со вкусом.': "Italyan uvoqlari: quvnoq, lekin did bilan.",
    'Чистый цвет и бархатная матовая поверхность.': "Toza rang va baxmal mat yuza.",
    'Новинки ': 'Yangiliklar ',
    'Только что привезли': 'Yangi keltirildi',
    'Все новинки': 'Barcha yangiliklar',
    'Почти без швов': 'Deyarli chokssiz',
    'Плита 75×150 закрывает больше 1 м² за раз. Стена выглядит цельным камнем.': "75×150 plita bir yo'la 1 m² dan ko'proq joyni yopadi. Devor yaxlit toshdek ko'rinadi.",
    'Видно до покупки': "Xariddan oldin ko'rinadi",
    '3D-конструктор показывает вашу комнату с вашими размерами, откосами и коридором, а не чужой интерьер из каталога.':
      "3D-konstruktor katalogdagi begona interyerni emas, aynan sizning o'lchamlaringiz, qiyaliklari va yo'lagi bilan xonangizni ko'rsatadi.",
    'Точный расчёт': 'Aniq hisob',
    'Считаем каждую плитку по раскладке: сколько целых, сколько подрезать и сколько коробок брать.':
      "Har bir plitkani terilishi bo'yicha hisoblaymiz: nechtasi butun, nechtasini kesish kerak va necha quti olish kerak.",
    'Для тех, кто за границей': 'Chet eldagilar uchun',
    'Делаете ремонт родителям из США или Европы?': "AQSh yoki Yevropadan turib ota-onangiz uyini ta'mirlayapsizmi?",
    'Выберите плитку онлайн, оставьте свой номер и адрес в Узбекистане. Мы напишем вам в WhatsApp или Telegram для подтверждения. Оплата при получении или переводом на карту, после этого привезём домой.':
      "Plitkani onlayn tanlang, raqamingiz va O'zbekistondagi manzilni qoldiring. Tasdiqlash uchun WhatsApp yoki Telegram orqali yozamiz. To'lov qabul qilganda yoki kartaga o'tkazma orqali, so'ng uyga yetkazamiz.",
    'Подобрать плитку': 'Plitka tanlash',
    'Соберите комнату': "Xonani yig'ing",
    'Форма, размеры, плитка, затирка.': "Shakl, o'lchamlar, plitka, zatirka.",
    'Оформите заказ': 'Buyurtma bering',
    'Ваш номер (+1, +44, +49…) и получатель.': 'Raqamingiz (+1, +44, +49…) va qabul qiluvchi.',
    'Подтверждение': 'Tasdiqlash',
    'Позвоним или напишем, проверим расчёт.': "Qo'ng'iroq qilamiz yoki yozamiz, hisobni tekshiramiz.",
    'Оплата и доставка': "To'lov va yetkazish",
    'При получении или переводом, затем привезём.': "Qabul qilganda yoki o'tkazma orqali, keyin yetkazamiz.",
    'Посмотрите плитку у себя дома, а не в шоуруме': "Plitkani shourumda emas, o'z uyingizda ko'ring",
    'Открыть 3D-конструктор': '3D-konstruktorni ochish',
    'Соберите свою комнату': "O'z xonangizni yig'ing",
    'Задайте форму пола с коробами, нишами и коридором, выберите плитку и посмотрите комнату со всех сторон и изнутри.':
      "Pol shaklini qutilar, tokchalar va yo'lak bilan bering, plitka tanlang va xonani har tomondan va ichkaridan ko'ring.",
    '3D-вид помещения': "Xonaning 3D ko'rinishi",
    'Ракурс': 'Burchak',
    'Обзор': "Umumiy ko'rinish",
    'Сверху': 'Yuqoridan',
    'Изнутри': 'Ichkaridan',
    'Отдалить': 'Uzoqlashtirish',
    'Приблизить': 'Yaqinlashtirish',
    'Сбросить вид': "Ko'rinishni tiklash",
    'Сохранить картинку': 'Rasmni saqlash',
    'Во весь экран': "To'liq ekran",
    'Свернуть': "Kichraytirish",
    'Презентация на ТВ': 'TV taqdimot',
    'Презентация на ТВ: весь экран и вращение. ← → переключают вид, Esc — выход': "TV taqdimot: to'liq ekran va aylanish. ← → ko'rinishni almashtiradi, Esc — chiqish",
    'Крутите пальцем или мышкой. «Изнутри» — вид с уровня глаз, нажмите ещё раз, чтобы встать в другую точку.':
      "Barmoq yoki sichqoncha bilan aylantiring. «Ichkaridan» — ko'z balandligidan ko'rinish, boshqa nuqtaga o'tish uchun yana bosing.",
    'Настройки': 'Sozlamalar',
    'Заказать с доставкой домой': 'Uyga yetkazib berish bilan buyurtma',
    'Оформите заказ здесь. Мы напишем вам в WhatsApp или Telegram, чтобы подтвердить его. Оплатить можно при получении или переводом на карту или счёт, реквизиты пришлём после подтверждения.':
      "Buyurtmani shu yerda bering. Tasdiqlash uchun WhatsApp yoki Telegram orqali yozamiz. To'lov qabul qilganda yoki karta/hisob raqamiga o'tkazma orqali, rekvizitlarni tasdiqlagandan keyin yuboramiz.",
    'Для клиента': 'Mijoz uchun',
    'Распечатайте расчёт с картинкой комнаты или покажите комнату на ТВ.': "Xona rasmi bilan hisobni chop eting yoki xonani TV'da ko'rsating.",
    'Добавить подборку в корзину': "Tanlovni savatga qo'shish",
    '🖨 Печать расчёта': '🖨 Hisobni chop etish',
    '▶ Презентация на ТВ': '▶ TV taqdimot',
    'Копировать': 'Nusxalash',
    'Новые поставки': 'Yangi kelgan mahsulotlar',
    'Каждый месяц привозим свежие коллекции. Примерьте любую плитку в 3D одной кнопкой.': "Har oy yangi kolleksiyalar keltiramiz. Istalgan plitkani bir tugma bilan 3D'da sinab ko'ring.",
    'Выберите формат': 'Formatni tanlang',
    'Все коллекции': 'Barcha kolleksiyalar',
    'Сортировка': 'Saralash',
    'Сначала популярные': 'Avval ommaboplari',
    'Сначала дешевле': 'Avval arzonlari',
    'Сначала дороже': 'Avval qimmatlari',
    'Все стили': 'Barcha uslublar',
    'Все размеры': "Barcha o'lchamlar",
    'Цвет на экране может немного отличаться от настоящей плитки. Образцы можно посмотреть в магазине.': "Ekrandagi rang haqiqiy plitkadan biroz farq qilishi mumkin. Namunalarni do'konda ko'rishingiz mumkin.",
    'Приходите посмотреть плитку вживую': "Plitkani jonli ko'rishga keling",
    'Адрес': 'Manzil',
    'Время работы': 'Ish vaqti',
    'Телефон': 'Telefon',
    'Написать в Telegram': 'Telegramda yozish',
    'Открыть на карте': "Xaritada ochish",
    'Цены на сайте справочные, точную стоимость подтвердит продавец.': "Saytdagi narxlar ma'lumot uchun, aniq narxni sotuvchi tasdiqlaydi.",
    // корзина и заказ
    'Ваши данные': "Ma'lumotlaringiz",
    'Ваше имя': 'Ismingiz',
    'Ваш телефон с кодом страны': 'Mamlakat kodi bilan telefoningiz',
    'Как с вами связаться для подтверждения': "Tasdiqlash uchun siz bilan qanday bog'lanaylik",
    'Звонок': "Qo'ng'iroq",
    'Кто примет и оплатит': "Kim qabul qiladi va to'laydi",
    'Имя получателя': 'Qabul qiluvchining ismi',
    'Телефон получателя': 'Qabul qiluvchining telefoni',
    'Город / район': 'Shahar / tuman',
    'Адрес (улица, дом, ориентир)': "Manzil (ko'cha, uy, mo'ljal)",
    'Комментарий': 'Izoh',
    'Удобное время доставки, этаж, подъезд…': "Qulay yetkazish vaqti, qavat, yo'lak…",
    'Оформить заказ': 'Buyurtma berish',
    'Отправляем…': 'Yuborilmoqda…',
    'После заказа мы напишем вам для подтверждения. Оплата при получении или переводом на карту или счёт, реквизиты пришлём в сообщении. Отправляем после подтверждения.':
      "Buyurtmadan keyin tasdiqlash uchun yozamiz. To'lov qabul qilganda yoki karta/hisob raqamiga o'tkazma orqali, rekvizitlarni xabarda yuboramiz. Tasdiqlangandan keyin jo'natamiz.",
    'Заказ принят': 'Buyurtma qabul qilindi',
    'Мы напишем вам по номеру': 'Sizga quyidagi raqam orqali yozamiz:',
    'в WhatsApp или Telegram, чтобы подтвердить заказ, сумму и способ оплаты. Отправим после подтверждения.': "WhatsApp yoki Telegramda buyurtma, summa va to'lov usulini tasdiqlash uchun. Tasdiqlangandan keyin jo'natamiz.",
    'Корзина пуста. Подберите плитку в конструкторе и нажмите «Добавить в корзину» или добавьте товар из каталога.': "Savat bo'sh. Konstruktorda plitka tanlang va «Savatga qo'shish»ni bosing yoki katalogdan mahsulot qo'shing.",
    'Укажите ваше имя': 'Ismingizni kiriting',
    'Телефон нужен с кодом страны: +1…, +7…, +44…, +49…, +998…': 'Telefon mamlakat kodi bilan kerak: +1…, +7…, +44…, +49…, +998…',
    'Укажите, кто примет заказ': 'Buyurtmani kim qabul qilishini kiriting',
    'Телефон получателя с кодом страны, например +998 90 123 45 67': 'Qabul qiluvchi telefoni mamlakat kodi bilan, masalan +998 90 123 45 67',
    'Укажите адрес доставки': 'Yetkazish manzilini kiriting',
    'Не получилось отправить заказ. Попробуйте ещё раз или напишите нам.': "Buyurtmani yuborib bo'lmadi. Qayta urinib ko'ring yoki bizga yozing.",
    'Подборка скопирована. Отправьте её нам в любом мессенджере': "Tanlov nusxalandi. Uni bizga istalgan messenjerda yuboring",
    'Удалить': "O'chirish",
    'Меньше': 'Kamroq',
    'Больше': "Ko'proq",
    'Коробок': 'Quti',
    'Итого:': 'Jami:',
    // конструктор
    'Ванная': 'Hammom',
    'Туалет': 'Hojatxona',
    'Кухня': 'Oshxona',
    'Комната / прихожая': 'Xona / dahliz',
    'Цоколь и двор': 'Sokol va hovli',
    'Форма пола': 'Pol shakli',
    'Прямоугольник': "To'rtburchak",
    'Короб в углу': 'Burchakdagi quti',
    'Скошенный угол': 'Qiya burchak',
    'С нишей': 'Tokchali',
    'Г-образная': 'G shaklida',
    'Комната + коридор': "Xona + yo'lak",
    'Ширина, м': 'Eni, m',
    'Длина, м': "Bo'yi, m",
    'Высота, м': 'Balandligi, m',
    'Длина дома, м': "Uy bo'yi, m",
    'Ширина дома, м': 'Uy eni, m',
    'Двор, м²': 'Hovli, m²',
    'Удалить точку': "Nuqtani o'chirish",
    'Эта стена:': 'Bu devor:',
    'Стена': 'Devor',
    'Проём': 'Ochiq joy',
    'Дверь': 'Eshik',
    'Тяните углы · «+» добавит излом · нажмите на размер стены, чтобы задать длину и тип: стена, проём без двери, дверь':
      "Burchaklarni torting · «+» bukilish qo'shadi · uzunlik va turini berish uchun devor o'lchamini bosing: devor, eshiksiz ochiq joy, eshik",
    'Поиск плитки: название или размер, например 75x150': "Plitka qidirish: nomi yoki o'lchami, masalan 75x150",
    'Поиск плитки': 'Plitka qidirish',
    'Стены': 'Devorlar',
    'Низ стен (другая плитка)': 'Devor pasti (boshqa plitka)',
    'Акцентная стена': "Urg'u devori",
    'Акцентная стена (за тумбой)': "Urg'u devori (tumba ortida)",
    'Пол': 'Pol',
    'Фартук': 'Fartuk',
    'Стены целиком плиткой': "Devorlar to'liq plitka bilan",
    'Цоколь': 'Sokol',
    'Двор / дорожка': "Hovli / yo'lak",
    'Раскладка': 'Terilishi',
    'Прямая': "To'g'ri",
    'Вразбежку ½': 'Siljitib ½',
    'Вразбежку ⅓': 'Siljitib ⅓',
    'По диагонали': "Diagonal bo'yicha",
    'Ёлочка': 'Archa',
    '⟲ Повернуть 90°': '⟲ 90° burish',
    '⇄ На всё': '⇄ Hammasiga',
    'Поставить эту плитку на стены, пол и фартук': "Bu plitkani devorlar, pol va fartukka qo'yish",
    '✂ Меньше подрезки': '✂ Kamroq kesish',
    'Сдвинуть раскладку так, чтобы было меньше подрезки': "Kamroq kesish uchun terilishni siljitish",
    'Показать раскладку на плане': "Terilishni rejada ko'rsatish",
    'Какая стена': 'Qaysi devor',
    'Высота:': 'Balandligi:',
    'Каждая стена отдельно': 'Har bir devor alohida',
    'Как основные стены': 'Asosiy devorlar kabi',
    'Номера стен видны на плане: стена 1 начинается с левого верхнего угла и идёт по часовой стрелке.':
      "Devor raqamlari rejada ko'rinadi: 1-devor chap yuqori burchakdan boshlanib, soat yo'nalishida davom etadi.",
    'Затирка (швы)': 'Zatirka (choklar)',
    'Ширина шва:': 'Chok kengligi:',
    'Цвет стен': 'Devor rangi',
    'Цвет фасада': 'Fasad rangi',
    'Белая': 'Oq', 'Светло-серая': 'Och kulrang', 'Серая': 'Kulrang', 'Графит': 'Grafit', 'Бежевая': 'Bej', 'Чёрная': 'Qora',
    'Молочный': 'Sutrang', 'Светло-серый': 'Och kulrang', 'Бежевый': 'Bej', 'Шалфей': 'Shalfey', 'Серо-голубой': 'Kulrang-moviy',
    'Слоновая кость': 'Fil suyagi', 'Песочный': 'Qum rang', 'Капучино': 'Kapuchino', 'Белый': 'Oq', 'Терракота': 'Terrakota',
    'Поверхность': 'Yuza',
    'Площадь': 'Maydon',
    'Сумма': 'Summa',
    'Итого примерно': 'Taxminan jami',
    'Раскладка уже близка к лучшей': "Terilish allaqachon eng yaxshisiga yaqin",
    'Открыто окно печати накладной': "Nakladnoyni chop etish oynasi ochildi",
    'Ваш браузер не поддерживает 3D (WebGL). Каталог и расчёт работают, а 3D-вид откройте на другом устройстве.':
      "Brauzeringiz 3D (WebGL) ni qo'llamaydi. Katalog va hisob ishlaydi, 3D ko'rinishni boshqa qurilmada oching.",
    'Скоро здесь появятся новые поставки.': "Tez orada bu yerda yangi mahsulotlar paydo bo'ladi.",
    'Новинка': 'Yangi',
    'Под заказ': 'Buyurtma asosida',
    'под заказ': 'buyurtma asosida',
    'Примерить в 3D': "3D'da sinash",
    'В корзину': 'Savatga',
    'Полированный': 'Sayqallangan',
    'Сатинированный': 'Satin',
    'Матовый': 'Mat',
    'Матовый, бархат': 'Mat, baxmal',
    'Матовый, структурный': 'Mat, strukturali',
    'Рельеф «камень», R11': "«Tosh» relyefi, R11",
    'Индия': 'Hindiston', 'Испания': 'Ispaniya', 'Китай': 'Xitoy', 'Узбекистан': "O'zbekiston"
  };

  // Куски динамических строк (числа, единицы) — по длине, чтобы длинные шли первыми
  const P = [
    ['Здравствуйте! Хочу отложить плитку — подборка с сайта.', "Assalomu alaykum! Plitkani band qilmoqchiman — saytdan tanlov."],
    ['Плитка на пол:', 'Pol uchun plitka:'],
    ['кусков подрезки из', "kesilgan bo'lak, plitalar soni:"],
    ['на подрезку, +3% на бой', "kesish uchun, +3% sinishga"],
    ['Сдвинули раскладку:', 'Terilish siljitildi:'],
    ['Добавлено в корзину:', "Savatga qo'shildi:"],
    ['— на всех поверхностях', "— barcha yuzalarda"],
    ['Смотреть', "Ko'rish:"],
    ['Заказ №', 'Buyurtma №'],
    [' принят', ' qabul qilindi'],
    ['запас', 'zaxira'],
    ['целых +', 'ta butun +'],
    ['плит =', 'plita ='],
    ['периметр', 'perimetr'],
    ['углов', 'burchak'],
    ['проёмов', 'ochiq joy'],
    ['моделей', 'ta model'], ['модели', 'ta model'], ['модель', 'ta model'],
    ['позиций', 'ta pozitsiya'], ['позиции', 'ta pozitsiya'], ['позиция', 'ta pozitsiya'],
    ['коробка', 'quti'],
    ['в корзине', 'savatda'],
    ['(с дверью)', '(eshikli)'],
    ['(самая длинная)', "(eng uzun)"],
    ['Как пол', 'Pol kabi'],
    ['Стены', 'Devorlar'],
    ['Стена', 'Devor'],
    ['стены · пол:', 'devorlar · pol:'],
    ['стены', 'devorlar'],
    ['Низ стен', 'Devor pasti'],
    ['Пол ', 'Pol '],
    ['за м²', 'm² uchun'],
    ['в коробке', 'qutida'],
    ['/м²', '/m²'],
    ['м²', 'm²'],
    ['сум', "so'm"],
    ['кор.', 'quti'],
    ['шт', 'dona'],
    ['мм', 'mm'],
    ['см', 'sm'],
    [' м', ' m'],
    ['улица', "ko'cha"], ['цоколь', 'sokol'], ['пол', 'pol'],
    ['Затирка:', 'Zatirka:'],
    ['шов', 'chok'],
    ['Затирка', 'Zatirka'],
    ['из каталога', 'katalogdan'],
    ['Итого ≈', 'Jami ≈'],
    ['по диагонали', "diagonal bo'yicha"], ['вразбежку', 'siljitib'], ['прямая', "to'g'ri"], ['ёлочка', 'archa'],
    ['Подборка:', 'Tanlov:'], ['дом', 'uy'], ['двор', 'hovli'], ['высота', 'balandligi']
  ].sort((a, b) => b[0].length - a[0].length);

  // Остатки кириллицы (названия плитки) — транслитом латиницей
  const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: "o'", қ: 'q', ғ: "g'", ҳ: 'h' };
  const translit = s => s.replace(/[А-Яа-яЁёЎўҚқҒғҲҳ]/g, c => { const l = c.toLowerCase(), t = TR[l] != null ? TR[l] : c; return c === l ? t : t.charAt(0).toUpperCase() + t.slice(1); });
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const PR = P.map(([ru, uz]) => [new RegExp(esc(ru), 'g'), uz]);

  function tr(text) {
    if (lang !== 'uz' || !text || !/[А-Яа-яЁё]/.test(text)) return text;
    const t = text.trim();
    if (D[t] != null) return text.replace(t, D[t]);
    let out = text;
    for (const [re, uz] of PR) out = out.replace(re, uz);
    return /[А-Яа-яЁё]/.test(out) ? translit(out) : out;
  }

  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  function walk(root) {
    if (lang !== 'uz' || !root) return;
    if (root.nodeType === 3) { const v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
    if (root.nodeType !== 1 || SKIP[root.tagName] || root.id === 'invoice') return;
    for (const a of ATTRS) if (root.hasAttribute && root.hasAttribute(a)) { const v = tr(root.getAttribute(a)); if (v !== root.getAttribute(a)) root.setAttribute(a, v); }
    for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }

  window.I18N = { lang, tr };
  document.documentElement.lang = lang === 'uz' ? 'uz' : 'ru';

  function setup() {
    const btn = document.getElementById('langBtn');
    if (btn) {
      btn.textContent = lang === 'uz' ? 'RU' : 'UZ';
      btn.title = lang === 'uz' ? 'Русский язык' : "O'zbek tili";
      btn.addEventListener('click', () => {
        try { localStorage.setItem('lang', lang === 'uz' ? 'ru' : 'uz'); } catch (e) { /* ignore */ }
        location.reload();
      });
    }
    if (lang !== 'uz') return;
    walk(document.body);
    document.title = tr(document.title);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes') walk(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    new MutationObserver(() => { const t = tr(document.title); if (t !== document.title) document.title = t; })
      .observe(document.querySelector('title'), { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
