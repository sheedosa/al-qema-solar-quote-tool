import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'ar' | 'en'

/* ------------------------------------------------------------------ *
 * Canonical option values (language-neutral). These are the values
 * stored in form state and compared against in logic — never shown
 * to the user directly. Labels come from the `opt` maps below.
 * ------------------------------------------------------------------ */
export const PROPERTY_VALS = ['Home', 'Office / Company', 'Shop', 'Clinic', 'Workshop', 'Other']
export const SUPPLY_VALS = ['Public grid', 'Generator', 'Both', 'None']
export const OUTAGE_VALS = ['0–4 hrs', '4–8 hrs', '8–12 hrs', 'More than 12 hrs']
export const PEAK_VALS = ['Daytime (8am–5pm)', 'Night (6pm–7am)', 'All day (~24h)']
export const OPERATION_VALS = [
  'Continuous (fridge, router, cameras)',
  'On and off as needed',
  'Heavy use at specific hours',
]
export const ROOF_VALS = ['Small', 'Medium', 'Large', 'Not sure']
export const SHADE_VALS = ['Yes', 'No']
export const SYSTEM_VALS = ['hybrid', 'offgrid', 'ongrid', 'recommend']
export const PRIORITY_VALS = ['essentials', 'essentials_ac', 'full']
export const BULB_VALS = ['led', 'regular', 'mixed']
export const INVERTER_VALS = ['yes', 'no', 'unsure']
export const HEAVY_DUTY_VALS = ['electric_oven', 'instant_heater', 'multi_ac_battery', 'industrial']

/* ------------------------------------------------------------------ *
 * English strings — the source of truth for the Strings shape.
 * ------------------------------------------------------------------ */
const EN = {
  header: {
    brand: 'Al Qema',
    stepWord: 'Step',
    ofWord: 'of',
    titles: {
      aboutYou: 'About you',
      powerUse: 'Power use',
      cooling: 'Cooling',
      appliances: 'Appliances',
      preferences: 'Preferences',
      review: 'Review',
    },
    enTitle: 'English',
    arTitle: 'العربية',
  },
  nav: { back: 'Back', continue: 'Continue', getEstimate: 'Get my estimate' },
  welcome: {
    title: 'Get your solar system estimate',
    subtitle:
      "Answer a few quick questions about what you'd like to power. You'll get an instant estimate, and our team will follow up on WhatsApp with a tailored quote.",
    minutes: '~3–4 minutes',
    noTech: 'No technical knowledge needed',
    free: 'Free, no obligation',
    start: 'Start',
    trust: 'Trusted by 4,000+ customers · 350+ projects across Libya',
  },
  details: {
    kicker: 'About you',
    title: "Let's start with your details",
    subtitle:
      "Takes about 3–4 minutes. You don't need to know technical details — we'll help.",
    fullName: 'Full name',
    yourName: 'Your name',
    whatsapp: 'WhatsApp number',
    waPlaceholder: '91 123 4567',
    waHelp: "We'll send your detailed quote here.",
    propertyType: 'Property type',
    otherPlaceholder: 'Tell us what kind of place it is',
    city: 'City / area',
    cityPlaceholder: 'e.g. Tripoli, Hay Al-Andalus',
  },
  power: {
    kicker: 'Your power use',
    title: 'Your power situation',
    supplyTitle: 'Current power supply',
    outageTitle: 'Average daily power cuts',
    peakTitle: 'When do you use the most power?',
    nightTitle: 'At night, can you run only the essentials to save battery?',
    operationTitle: 'How do you mostly run things?',
    footer: 'This helps us size your battery correctly.',
  },
  cooling: {
    kicker: 'Cooling',
    title: 'Air conditioning & refrigeration',
    intro:
      'Air conditioners and fridges affect your system size the most — this is the important part.',
    acCount: 'How many AC units do you want to run on solar?',
    acLabel: 'AC',
    removeAc: 'Remove this AC',
    location: 'Location',
    locationPlaceholder: 'e.g. Living room',
    type: 'Type',
    capacity: 'Capacity',
    capBtuPlaceholder: 'e.g. 18000',
    capTonPlaceholder: 'e.g. 1.5',
    dontKnow: "I don't know",
    noProblem: "No problem — we'll figure it out for you.",
    modelPlaceholder: 'Model (if you can see it, e.g. LG Dual Inverter)',
    addPhoto: 'Add photo of the sticker',
    addPhotoHint: "Snap the label on the indoor or outdoor unit — we'll read it.",
    photoAdded: 'Photo added ✓',
    inverterQ: 'Inverter type AC?',
    hoursPerDay: 'Hours per day',
    runNight: 'Run at night?',
    fridgesTitle: 'Fridges & freezers',
    fridge: 'Fridge',
    freezer: 'Freezer',
    howMany: 'How many?',
    capacityL: 'Capacity in liters',
    capacityLOptional: '(optional — leave blank if unsure)',
    capacityLPlaceholder: 'e.g. 400',
    condition: 'Condition',
    alwaysRunning: 'Always running?',
  },
  appliances: {
    kicker: 'What else to power',
    title: 'Lighting & appliances',
    lighting: 'Lighting',
    bulbType: 'Bulb type',
    numberBulbs: 'Number of bulbs',
    wattsPerBulb: 'Watts per bulb',
    optional: '(optional)',
    notSure: 'Not sure',
    bulbHint: 'Leave blank if unsure — LED is usually 5–15W.',
    hoursNight: 'Hours lit at night',
    appliancesTitle: 'Appliances',
    appliancesHint: "Tap to add what you'd like to run. Don't worry about watts — we'll estimate.",
    deviceName: 'Device name',
    pumpSize: 'Pump size',
    hpSuffix: ' hp',
    quantity: 'Quantity',
    hoursPerDay: 'Hours per day',
    runNight: 'Run at night?',
    watts: 'Watts',
    wattsPlaceholder: "We'll estimate",
    addOther: 'Add other',
    heavyIntro:
      "These draw a lot of power and need a special setup. Tick any you'd still like to run:",
    remove: 'Remove',
  },
  preferences: {
    kicker: 'Your preferences',
    title: 'System preferences',
    systemType: 'System type',
    priority: 'Priority during a power cut',
    priorityAcCount: 'How many ACs during a cut?',
    roofSpace: 'Roof space for panels',
    shadeQ: 'Any shade on the roof (buildings/trees)?',
    photos: 'Photos',
    photosOptional: '(optional, speeds up your quote)',
    photosHint: 'Optional, but photos help us quote faster and more accurately.',
    photoLabels: {
      panel: 'Main electrical panel',
      meter: 'Meter / supply point',
      roof: 'Roof / panel area',
      stickers: 'AC / pump stickers',
    },
  },
  review: {
    kicker: 'Almost done',
    title: 'Review & send',
    notesQ: 'Anything else we should know?',
    optional: '(optional)',
    notesPlaceholder: 'Future expansion, number of rooms, working hours, etc.',
    edit: 'Edit',
    groups: {
      details: 'Your details',
      power: 'Power use',
      cooling: 'Cooling',
      appliances: 'Appliances',
      preferences: 'Preferences',
    },
    keys: {
      name: 'Name',
      whatsapp: 'WhatsApp',
      property: 'Property',
      city: 'City / area',
      supply: 'Supply',
      dailyCuts: 'Daily cuts',
      peakTime: 'Peak time',
      atNight: 'At night',
      usagePattern: 'Usage pattern',
      acUnits: 'AC units',
      fridge: 'Fridge',
      freezer: 'Freezer',
      lighting: 'Lighting',
      heavyDuty: 'Heavy-duty',
      systemType: 'System type',
      cutPriority: 'Cut priority',
      roofSpace: 'Roof space',
      roofShade: 'Roof shade',
      photos: 'Photos',
    },
    acPrefix: 'AC',
    sep: ', ',
    capWeCheck: "capacity: we’ll check",
    capDash: 'capacity: —',
    typeDash: '—',
    no: 'No',
    alwaysOn: ', always on',
    nights: ', nights',
    hUnit: 'h',
    bulbsWord: 'bulbs',
    typeWord: 'type —',
    atNightSuffix: 'at night',
    perDay: '/day',
    customDevice: 'Custom device',
    selectedSuffix: 'selected',
    ofFourAdded: 'of 4 added',
    dash: '—',
  },
  result: {
    title: "Here's your recommended system, ",
    friend: 'friend',
    subtitle: 'Based on what you told us — our engineer will confirm the details.',
    solarPanels: 'Solar panels',
    kwpArray: 'kWp array',
    inverter: 'Inverter',
    kwHybrid: 'kW hybrid',
    battery: 'Battery storage',
    kwh: 'kWh',
    dailyNeed: 'Estimated daily energy need:',
    kwhPerDay: 'kWh/day',
    indicativePrice: 'Indicative price',
    priceFrom: 'From ~',
    lyd: 'LYD',
    priceNote: 'Starting estimate — confirmed by our engineer after a quick review.',
    whatNext: 'What happens next',
    step1: 'We review your details',
    step2: 'We confirm sizing & price on WhatsApp',
    step3: 'We schedule installation',
    whatsappCta: 'Get my detailed quote on WhatsApp',
    startOver: 'Start over',
    trust: 'Trusted by 4,000+ customers · Partners: Huawei · Sungrow · Trina',
    disclaimer:
      'This is an initial estimate based on your inputs and may change after a site assessment.',
  },
  units: { h: 'h' },
  opt: {
    property: {
      Home: 'Home',
      'Office / Company': 'Office / Company',
      Shop: 'Shop',
      Clinic: 'Clinic',
      Workshop: 'Workshop',
      Other: 'Other',
    } as Record<string, string>,
    supply: {
      'Public grid': 'Public grid',
      Generator: 'Generator',
      Both: 'Both',
      None: 'None',
    } as Record<string, string>,
    outage: {
      '0–4 hrs': '0–4 hrs',
      '4–8 hrs': '4–8 hrs',
      '8–12 hrs': '8–12 hrs',
      'More than 12 hrs': 'More than 12 hrs',
    } as Record<string, string>,
    peak: {
      'Daytime (8am–5pm)': 'Daytime (8am–5pm)',
      'Night (6pm–7am)': 'Night (6pm–7am)',
      'All day (~24h)': 'All day (~24h)',
    } as Record<string, string>,
    operation: {
      'Continuous (fridge, router, cameras)': 'Continuous (fridge, router, cameras)',
      'On and off as needed': 'On and off as needed',
      'Heavy use at specific hours': 'Heavy use at specific hours',
    } as Record<string, string>,
    roof: {
      Small: 'Small',
      Medium: 'Medium',
      Large: 'Large',
      'Not sure': 'Not sure',
    } as Record<string, string>,
    shade: { Yes: 'Yes', No: 'No' } as Record<string, string>,
    acType: { Split: 'Split', Window: 'Window' } as Record<string, string>,
    inverter: { yes: 'Yes', no: 'No', unsure: 'Not sure' } as Record<string, string>,
    condition: { new: 'New', old: 'Old' } as Record<string, string>,
    bulb: { led: 'LED', regular: 'Regular', mixed: 'Mixed' } as Record<string, string>,
    nightEconomyFull: {
      yes: 'Yes — essentials only at night',
      no: 'No — I want similar power day and night',
    } as Record<string, string>,
    system: {
      hybrid: 'Hybrid',
      offgrid: 'Off-grid',
      ongrid: 'On-grid (if available)',
      recommend: 'Not sure — recommend for me',
    } as Record<string, string>,
    priority: {
      essentials: 'Essentials only',
      essentials_ac: 'Essentials + AC',
      full: 'Full power as much as possible',
    } as Record<string, string>,
    heavyDuty: {
      electric_oven: 'Electric oven / air fryer',
      instant_heater: 'High-power heater (instant water heater)',
      multi_ac_battery: 'Several ACs on battery',
      industrial: 'Welding / compressor / lathe (industrial)',
    } as Record<string, string>,
    preset: {
      'Router / Internet': 'Router / Internet',
      TV: 'TV',
      'Phone / Laptop charger': 'Phone / Laptop charger',
      Fans: 'Fans',
      'Water pump': 'Water pump',
      'Water heater': 'Water heater',
      'Washing machine': 'Washing machine',
      Dryer: 'Dryer',
      'Oven / Microwave': 'Oven / Microwave',
      'Coffee machine / Kettle': 'Coffee machine / Kettle',
      'Security cameras / NVR': 'Security cameras / NVR',
      'Server / Network': 'Server / Network',
    } as Record<string, string>,
  },
  // Shorter labels used only on the review screen.
  reviewMap: {
    nightEconomy: {
      yes: 'Essentials only at night',
      no: 'Similar power day & night',
    } as Record<string, string>,
    system: {
      hybrid: 'Hybrid',
      offgrid: 'Off-grid',
      ongrid: 'On-grid',
      recommend: 'Recommend for me',
    } as Record<string, string>,
    priority: {
      essentials: 'Essentials only',
      essentials_ac: 'Essentials + AC',
      full: 'Full power',
    } as Record<string, string>,
    condition: { new: 'new', old: 'old' } as Record<string, string>,
    acSuffix: 'AC',
  },
  whatsappMsg: (name: string, kwp: string, inv: string, bat: string) =>
    'Hello Al Qema! I just completed the solar estimate form. My name is ' +
    name +
    ' — estimated system: ' +
    kwp +
    ' kWp, ' +
    inv +
    ' kW inverter, ' +
    bat +
    ' kWh battery. Please send my detailed quote.',
}

export type Strings = typeof EN

/* ------------------------------------------------------------------ *
 * Arabic strings (RTL). Technical units (kWp, kW, kWh, BTU, LED) are
 * kept in Latin as is conventional in Libyan Arabic technical copy.
 * ------------------------------------------------------------------ */
const AR: Strings = {
  header: {
    brand: 'القمة',
    stepWord: 'الخطوة',
    ofWord: 'من',
    titles: {
      aboutYou: 'بياناتك',
      powerUse: 'استهلاك الطاقة',
      cooling: 'التبريد',
      appliances: 'الأجهزة',
      preferences: 'التفضيلات',
      review: 'المراجعة',
    },
    enTitle: 'English',
    arTitle: 'العربية',
  },
  nav: { back: 'رجوع', continue: 'متابعة', getEstimate: 'احصل على التقدير' },
  welcome: {
    title: 'احصل على تقدير نظامك الشمسي',
    subtitle:
      'أجب عن بعض الأسئلة السريعة حول ما ترغب في تشغيله. ستحصل على تقدير فوري، وسيتواصل معك فريقنا عبر واتساب بعرض سعر مخصّص.',
    minutes: '3–4 دقائق تقريباً',
    noTech: 'لا حاجة لمعرفة تقنية',
    free: 'مجاناً وبدون التزام',
    start: 'ابدأ',
    trust: 'موثوق من أكثر من 4,000 عميل · أكثر من 350 مشروعاً في ليبيا',
  },
  details: {
    kicker: 'بياناتك',
    title: 'لنبدأ ببياناتك',
    subtitle: 'يستغرق حوالي 3–4 دقائق. لا حاجة لمعرفة التفاصيل التقنية — سنساعدك.',
    fullName: 'الاسم الكامل',
    yourName: 'اسمك',
    whatsapp: 'رقم واتساب',
    waPlaceholder: '91 123 4567',
    waHelp: 'سنرسل لك عرض السعر المفصّل هنا.',
    propertyType: 'نوع العقار',
    otherPlaceholder: 'أخبرنا بنوع المكان',
    city: 'المدينة / المنطقة',
    cityPlaceholder: 'مثال: طرابلس، حي الأندلس',
  },
  power: {
    kicker: 'استهلاك الطاقة',
    title: 'وضع الطاقة لديك',
    supplyTitle: 'مصدر الطاقة الحالي',
    outageTitle: 'متوسط انقطاع الكهرباء يومياً',
    peakTitle: 'متى تستهلك أكبر قدر من الطاقة؟',
    nightTitle: 'في الليل، هل يمكنك تشغيل الأساسيات فقط لتوفير البطارية؟',
    operationTitle: 'كيف تشغّل أجهزتك غالباً؟',
    footer: 'يساعدنا هذا في تحديد حجم بطاريتك بدقة.',
  },
  cooling: {
    kicker: 'التبريد',
    title: 'التكييف والتبريد',
    intro: 'المكيّفات والثلاجات هي الأكثر تأثيراً في حجم نظامك — هذا هو الجزء المهم.',
    acCount: 'كم عدد المكيّفات التي تريد تشغيلها على الطاقة الشمسية؟',
    acLabel: 'مكيّف',
    removeAc: 'إزالة هذا المكيّف',
    location: 'الموقع',
    locationPlaceholder: 'مثال: غرفة المعيشة',
    type: 'النوع',
    capacity: 'السعة',
    capBtuPlaceholder: 'مثال: 18000',
    capTonPlaceholder: 'مثال: 1.5',
    dontKnow: 'لا أعرف',
    noProblem: 'لا مشكلة — سنكتشف ذلك نيابةً عنك.',
    modelPlaceholder: 'الموديل (إن كان ظاهراً، مثال: LG Dual Inverter)',
    addPhoto: 'أضف صورة للملصق',
    addPhotoHint: 'صوّر الملصق على الوحدة الداخلية أو الخارجية — سنقرأه.',
    photoAdded: 'تمت إضافة الصورة ✓',
    inverterQ: 'مكيّف من نوع إنفرتر؟',
    hoursPerDay: 'ساعات التشغيل يومياً',
    runNight: 'يعمل ليلاً؟',
    fridgesTitle: 'الثلاجات والمجمّدات',
    fridge: 'ثلاجة',
    freezer: 'مجمّد',
    howMany: 'كم العدد؟',
    capacityL: 'السعة باللتر',
    capacityLOptional: '(اختياري — اتركه فارغاً إن لم تكن متأكداً)',
    capacityLPlaceholder: 'مثال: 400',
    condition: 'الحالة',
    alwaysRunning: 'يعمل دائماً؟',
  },
  appliances: {
    kicker: 'ماذا تريد أن تشغّل أيضاً',
    title: 'الإضاءة والأجهزة',
    lighting: 'الإضاءة',
    bulbType: 'نوع اللمبة',
    numberBulbs: 'عدد اللمبات',
    wattsPerBulb: 'واط لكل لمبة',
    optional: '(اختياري)',
    notSure: 'غير متأكد',
    bulbHint: 'اتركه فارغاً إن لم تكن متأكداً — إضاءة LED عادةً 5–15 واط.',
    hoursNight: 'ساعات الإضاءة ليلاً',
    appliancesTitle: 'الأجهزة',
    appliancesHint: 'اضغط لإضافة ما ترغب في تشغيله. لا تقلق بشأن الواط — سنقوم بالتقدير.',
    deviceName: 'اسم الجهاز',
    pumpSize: 'حجم المضخة',
    hpSuffix: ' حصان',
    quantity: 'الكمية',
    hoursPerDay: 'ساعات التشغيل يومياً',
    runNight: 'يعمل ليلاً؟',
    watts: 'واط',
    wattsPlaceholder: 'سنقوم بالتقدير',
    addOther: 'إضافة آخر',
    heavyIntro: 'هذه تستهلك طاقة كبيرة وتحتاج إعداداً خاصاً. اختر ما ترغب بتشغيله رغم ذلك:',
    remove: 'إزالة',
  },
  preferences: {
    kicker: 'تفضيلاتك',
    title: 'تفضيلات النظام',
    systemType: 'نوع النظام',
    priority: 'الأولوية أثناء انقطاع الكهرباء',
    priorityAcCount: 'كم عدد المكيّفات أثناء الانقطاع؟',
    roofSpace: 'مساحة السطح للألواح',
    shadeQ: 'هل يوجد ظل على السطح (مبانٍ/أشجار)؟',
    photos: 'الصور',
    photosOptional: '(اختياري، يسرّع عرض السعر)',
    photosHint: 'اختياري، لكن الصور تساعدنا على تقديم عرض أسرع وأدق.',
    photoLabels: {
      panel: 'اللوحة الكهربائية الرئيسية',
      meter: 'العدّاد / نقطة التغذية',
      roof: 'السطح / منطقة الألواح',
      stickers: 'ملصقات المكيّف / المضخة',
    },
  },
  review: {
    kicker: 'أوشكنا على الانتهاء',
    title: 'المراجعة والإرسال',
    notesQ: 'هل من شيء آخر يجب أن نعرفه؟',
    optional: '(اختياري)',
    notesPlaceholder: 'توسعات مستقبلية، عدد الغرف، ساعات العمل، إلخ.',
    edit: 'تعديل',
    groups: {
      details: 'بياناتك',
      power: 'استهلاك الطاقة',
      cooling: 'التبريد',
      appliances: 'الأجهزة',
      preferences: 'التفضيلات',
    },
    keys: {
      name: 'الاسم',
      whatsapp: 'واتساب',
      property: 'العقار',
      city: 'المدينة / المنطقة',
      supply: 'المصدر',
      dailyCuts: 'الانقطاع اليومي',
      peakTime: 'وقت الذروة',
      atNight: 'في الليل',
      usagePattern: 'نمط الاستخدام',
      acUnits: 'عدد المكيّفات',
      fridge: 'ثلاجة',
      freezer: 'مجمّد',
      lighting: 'الإضاءة',
      heavyDuty: 'أحمال ثقيلة',
      systemType: 'نوع النظام',
      cutPriority: 'أولوية الانقطاع',
      roofSpace: 'مساحة السطح',
      roofShade: 'ظل السطح',
      photos: 'الصور',
    },
    acPrefix: 'مكيّف',
    sep: '، ',
    capWeCheck: 'السعة: سنتحقق',
    capDash: 'السعة: —',
    typeDash: '—',
    no: 'لا',
    alwaysOn: '، دائم التشغيل',
    nights: '، ليلاً',
    hUnit: 'س',
    bulbsWord: 'لمبة',
    typeWord: 'النوع —',
    atNightSuffix: 'ليلاً',
    perDay: '/يوم',
    customDevice: 'جهاز مخصّص',
    selectedSuffix: 'مختارة',
    ofFourAdded: 'من 4 مضافة',
    dash: '—',
  },
  result: {
    title: 'إليك النظام الموصى به، ',
    friend: 'صديقنا',
    subtitle: 'بناءً على ما أخبرتنا به — سيؤكّد مهندسنا التفاصيل.',
    solarPanels: 'الألواح الشمسية',
    kwpArray: 'kWp للمصفوفة',
    inverter: 'الإنفرتر',
    kwHybrid: 'kW هجين',
    battery: 'تخزين البطارية',
    kwh: 'kWh',
    dailyNeed: 'الاستهلاك اليومي المقدّر:',
    kwhPerDay: 'kWh/يومياً',
    indicativePrice: 'السعر التقديري',
    priceFrom: 'ابتداءً من ~',
    lyd: 'د.ل',
    priceNote: 'تقدير أولي — يؤكّده مهندسنا بعد مراجعة سريعة.',
    whatNext: 'ما الذي يحدث بعد ذلك',
    step1: 'نراجع بياناتك',
    step2: 'نؤكّد الحجم والسعر عبر واتساب',
    step3: 'نحدّد موعد التركيب',
    whatsappCta: 'احصل على عرض السعر المفصّل عبر واتساب',
    startOver: 'ابدأ من جديد',
    trust: 'موثوق من أكثر من 4,000 عميل · شركاؤنا: Huawei · Sungrow · Trina',
    disclaimer: 'هذا تقدير أولي بناءً على مدخلاتك وقد يتغيّر بعد معاينة الموقع.',
  },
  units: { h: 'س' },
  opt: {
    property: {
      Home: 'منزل',
      'Office / Company': 'مكتب / شركة',
      Shop: 'محل',
      Clinic: 'عيادة',
      Workshop: 'ورشة',
      Other: 'أخرى',
    },
    supply: {
      'Public grid': 'الشبكة العامة',
      Generator: 'مولّد',
      Both: 'كلاهما',
      None: 'لا يوجد',
    },
    outage: {
      '0–4 hrs': '0–4 ساعات',
      '4–8 hrs': '4–8 ساعات',
      '8–12 hrs': '8–12 ساعة',
      'More than 12 hrs': 'أكثر من 12 ساعة',
    },
    peak: {
      'Daytime (8am–5pm)': 'نهاراً (8ص–5م)',
      'Night (6pm–7am)': 'ليلاً (6م–7ص)',
      'All day (~24h)': 'طوال اليوم (~24 ساعة)',
    },
    operation: {
      'Continuous (fridge, router, cameras)': 'بشكل مستمر (ثلاجة، راوتر، كاميرات)',
      'On and off as needed': 'تشغيل وإيقاف حسب الحاجة',
      'Heavy use at specific hours': 'استخدام مكثّف في أوقات محددة',
    },
    roof: {
      Small: 'صغيرة',
      Medium: 'متوسطة',
      Large: 'كبيرة',
      'Not sure': 'غير متأكد',
    },
    shade: { Yes: 'نعم', No: 'لا' },
    acType: { Split: 'سبليت', Window: 'شبّاك' },
    inverter: { yes: 'نعم', no: 'لا', unsure: 'غير متأكد' },
    condition: { new: 'جديد', old: 'قديم' },
    bulb: { led: 'LED', regular: 'عادية', mixed: 'مختلطة' },
    nightEconomyFull: {
      yes: 'نعم — الأساسيات فقط ليلاً',
      no: 'لا — أريد طاقة مماثلة نهاراً وليلاً',
    },
    system: {
      hybrid: 'هجين',
      offgrid: 'منفصل عن الشبكة',
      ongrid: 'متصل بالشبكة (إن توفّرت)',
      recommend: 'غير متأكد — اقترحوا لي',
    },
    priority: {
      essentials: 'الأساسيات فقط',
      essentials_ac: 'الأساسيات + مكيّف',
      full: 'طاقة كاملة قدر الإمكان',
    },
    heavyDuty: {
      electric_oven: 'فرن كهربائي / قلّاية هوائية',
      instant_heater: 'سخّان عالي الطاقة (سخّان ماء فوري)',
      multi_ac_battery: 'عدة مكيّفات على البطارية',
      industrial: 'لحام / ضاغط / مخرطة (صناعي)',
    },
    preset: {
      'Router / Internet': 'راوتر / إنترنت',
      TV: 'تلفزيون',
      'Phone / Laptop charger': 'شاحن هاتف / لابتوب',
      Fans: 'مراوح',
      'Water pump': 'مضخة ماء',
      'Water heater': 'سخّان ماء',
      'Washing machine': 'غسّالة',
      Dryer: 'نشّافة',
      'Oven / Microwave': 'فرن / ميكروويف',
      'Coffee machine / Kettle': 'آلة قهوة / غلّاية',
      'Security cameras / NVR': 'كاميرات مراقبة / NVR',
      'Server / Network': 'سيرفر / شبكة',
    },
  },
  reviewMap: {
    nightEconomy: {
      yes: 'الأساسيات فقط ليلاً',
      no: 'طاقة مماثلة نهاراً وليلاً',
    },
    system: {
      hybrid: 'هجين',
      offgrid: 'منفصل عن الشبكة',
      ongrid: 'متصل بالشبكة',
      recommend: 'اقترحوا لي',
    },
    priority: {
      essentials: 'الأساسيات فقط',
      essentials_ac: 'الأساسيات + مكيّف',
      full: 'طاقة كاملة',
    },
    condition: { new: 'جديد', old: 'قديم' },
    acSuffix: 'مكيّف',
  },
  whatsappMsg: (name: string, kwp: string, inv: string, bat: string) =>
    'مرحباً القمّة! لقد أكملت نموذج تقدير الطاقة الشمسية. اسمي ' +
    name +
    ' — النظام المقدّر: ' +
    kwp +
    ' kWp، إنفرتر ' +
    inv +
    ' kW، بطارية ' +
    bat +
    ' kWh. يرجى إرسال عرض السعر المفصّل.',
}

const BUNDLES: Record<Lang, Strings> = { en: EN, ar: AR }

type LangContextValue = {
  lang: Lang
  dir: 'rtl' | 'ltr'
  s: Strings
  setLang: (l: Lang) => void
}

const LangContext = createContext<LangContextValue | null>(null)

/** Arabic is the default language on load, per requirement. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar')
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const value = useMemo<LangContextValue>(
    () => ({ lang, dir, s: BUNDLES[lang], setLang }),
    [lang, dir],
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}

/** Convenience hook when only the strings bundle is needed. */
export function useStrings(): Strings {
  return useLang().s
}
