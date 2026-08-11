import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { WaQuote } from './pricing/types'

export type Lang = 'ar' | 'en'

/* ------------------------------------------------------------------ *
 * Canonical option values (language-neutral). These are the values
 * stored in form state and compared against in logic — never shown
 * to the user directly. Labels come from the `opt` maps below.
 * ------------------------------------------------------------------ */
export const PROPERTY_VALS = ['Home', 'Office / Company', 'Shop', 'Clinic', 'Workshop', 'Other']
export const OUTAGE_VALS = ['0–4 hrs', '4–8 hrs', '8–12 hrs', 'More than 12 hrs']
export const OPERATION_VALS = [
  'essentials',
  'essentials_fans_ac_part',
  'essentials_ac_most',
  'everything',
]
/** AC capacity in BTU. Stored as the full number for the pricing engine. */
export const AC_CAP_VALS = ['9000', '12000', '18000', '24000', '32000']
export const ROOF_VALS = ['Small', 'Medium', 'Large', 'Not sure']
export const SHADE_VALS = ['Yes', 'No']
export const SYSTEM_VALS = ['hybrid', 'offgrid', 'ongrid', 'recommend']
export const PRIORITY_VALS = ['essentials', 'essentials_ac', 'full']
export const BULB_VALS = ['led', 'regular', 'mixed']
export const INVERTER_VALS = ['yes', 'no', 'unsure']

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
    outageTitle: 'Average daily power cuts',
    nightTitle: 'At night, can you run only the essentials to save battery?',
    operationTitle: 'What do you want to keep running?',
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
    capacity: 'Capacity',
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
    appliancesTitle: 'Appliances',
    appliancesHint: "Tap to add what you'd like to run. Don't worry about watts — we'll estimate.",
    deviceName: 'Device name',
    quantity: 'Quantity',
    addOther: 'Add other',
    remove: 'Remove',
  },
  preferences: {
    kicker: 'Your preferences',
    title: 'System preferences',
    systemType: 'System type',
    priority: 'During a power cut, what should the battery run?',
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
    notesPlaceholder:
      'Future expansion, number of rooms, working hours, any high-power devices (electric water heater, oven, welding), etc.',
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
      dailyCuts: 'Daily cuts',
      atNight: 'At night',
      usagePattern: 'To keep running',
      acUnits: 'AC units',
      fridge: 'Fridge',
      freezer: 'Freezer',
      lighting: 'Lighting',
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
    no: 'No',
    alwaysOn: ', always on',
    nights: ', nights',
    hUnit: 'h',
    bulbsWord: 'bulbs',
    typeWord: 'type —',
    customDevice: 'Custom device',
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
    kva: 'kVA',
    battery: 'Battery storage',
    kwh: 'kWh',
    dailyNeed: 'Estimated daily energy need:',
    kwhPerDay: 'kWh/day',
    nightNeed: 'Overnight (battery) energy:',
    kwhPerNight: 'kWh/night',
    recommendedPackage: 'Recommended package',
    packagePrefix: 'Package ',
    batteryLiquid: 'liquid (lead-acid)',
    batteryLithium: 'lithium',
    batteryLife4: '4-year battery life',
    batteryLife10: '10-year battery life',
    includesTitle: 'Every Al Qema package includes',
    includes: {
      installConnection: 'Installation, connection & accessories',
      economyLighting: 'Economy lighting',
      tvScreen: 'TV / screen',
      fridge: 'Fridge',
      freezerOrPump: 'Freezer or water pump',
    } as Record<string, string>,
    runtimeNote: 'Backup runtime up to 12 hours, depending on devices and usage',
    warrantyNote: '1-year warranty on all parts',
    addOnLine: (price: string) => 'Optional add-on: battery box (2 batteries) — ' + price + ' LYD',
    termsNote: 'Final scope covers the loads agreed with our engineer.',
    priceRef: 'Pricing ref',
    warningsTitle: 'Please note',
    warnings: {
      heavyDutyLoad:
        'Heavy appliances (oven, kettle, dryer…) draw a lot of power — our engineer will review them with you.',
      acBtuExceeded:
        'One of your ACs is larger than this package officially supports — our engineer will confirm the right fit.',
    } as Record<string, string>,
    assumedTitle: 'We assumed a few details',
    assumedBody:
      "Where you weren't sure, we used typical values — our engineer will confirm before final pricing.",
    assumptions: {
      acSizeAssumed: 'AC size (12,000 BTU typical)',
      lightingAssumed: 'Bulb wattage',
      customApplianceAssumed: 'Custom device power',
    } as Record<string, string>,
    customTitle: 'You need a tailored system, ',
    customPackageName: 'Custom system',
    customBody:
      'Your needs go beyond our standard packages, so we designed a custom system from our component list. Our engineer will confirm the design and final price with you on WhatsApp.',
    customPriceNote: 'Component-level estimate — our engineer will confirm the final design and price.',
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
    outage: {
      '0–4 hrs': '0–4 hrs',
      '4–8 hrs': '4–8 hrs',
      '8–12 hrs': '8–12 hrs',
      'More than 12 hrs': 'More than 12 hrs',
    } as Record<string, string>,
    operation: {
      essentials: 'Essentials only — lights, fridge, internet, TV',
      essentials_fans_ac_part: 'Essentials + fans or one AC part of the day',
      essentials_ac_most: 'Essentials + AC running most of the day',
      everything: 'Everything, all day — like normal grid power',
    } as Record<string, string>,
    roof: {
      Small: 'Small',
      Medium: 'Medium',
      Large: 'Large',
      'Not sure': 'Not sure',
    } as Record<string, string>,
    shade: { Yes: 'Yes', No: 'No' } as Record<string, string>,
    acCapacity: {
      '9000': '9,000 BTU',
      '12000': '12,000 BTU',
      '18000': '18,000 BTU',
      '24000': '24,000 BTU',
      '32000': '32,000 BTU',
    } as Record<string, string>,
    inverter: { yes: 'Yes', no: 'No', unsure: 'Not sure' } as Record<string, string>,
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
    preset: {
      'Router / Internet': 'Router / Internet',
      TV: 'TV',
      'Phone / Laptop charger': 'Phone / Laptop charger',
      Fan: 'Fan',
      'Water pump': 'Water pump',
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
    acSuffix: 'AC',
  },
  whatsappMsg: (name: string, q: WaQuote) =>
    q.isCustom
      ? 'Hello Al Qema! I completed the solar estimate form. My name is ' +
        name +
        ' — my needs require a custom system, from ' +
        q.priceFrom.toLocaleString('en-US') +
        ' LYD (daily need ~' +
        q.dailyKwh +
        ' kWh). Ref: ' +
        q.configVersion +
        '. Please have an engineer confirm my tailored quote.'
      : 'Hello Al Qema! I completed the solar estimate form. My name is ' +
        name +
        ' — recommended: Package ' +
        q.tier +
        ', from ' +
        q.priceFrom.toLocaleString('en-US') +
        ' LYD (daily need ~' +
        q.dailyKwh +
        ' kWh). Ref: ' +
        q.configVersion +
        '. Please send my detailed quote.',
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
    outageTitle: 'متوسط انقطاع الكهرباء يومياً',
    nightTitle: 'في الليل، هل يمكنك تشغيل الأساسيات فقط لتوفير البطارية؟',
    operationTitle: 'ما الذي ترغب في إبقائه يعمل؟',
    footer: 'يساعدنا هذا في تحديد حجم بطاريتك بدقة.',
  },
  cooling: {
    kicker: 'التبريد',
    title: 'التكييف والتبريد',
    intro: 'المكيّفات والثلاجات هي الأكثر تأثيراً في حجم نظامك — هذا هو الجزء المهم.',
    acCount: 'كم عدد المكيّفات التي تريد تشغيلها على الطاقة الشمسية؟',
    acLabel: 'مكيّف',
    removeAc: 'إزالة هذا المكيّف',
    capacity: 'السعة',
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
    freezer: 'مجمّد (فريزر)',
    howMany: 'كم العدد؟',
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
    appliancesTitle: 'الأجهزة',
    appliancesHint: 'اضغط لإضافة ما ترغب في تشغيله. لا تقلق بشأن الواط — سنقوم بالتقدير.',
    deviceName: 'اسم الجهاز',
    quantity: 'الكمية',
    addOther: 'إضافة آخر',
    remove: 'إزالة',
  },
  preferences: {
    kicker: 'تفضيلاتك',
    title: 'تفضيلات النظام',
    systemType: 'نوع النظام',
    priority: 'أثناء انقطاع الكهرباء، ماذا تشغّل البطارية؟',
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
    notesPlaceholder:
      'توسعات مستقبلية، عدد الغرف، ساعات العمل، أي أجهزة عالية الطاقة (سخّان ماء كهربائي، فرن، لحام)، إلخ.',
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
      dailyCuts: 'الانقطاع اليومي',
      atNight: 'في الليل',
      usagePattern: 'ما تريد تشغيله',
      acUnits: 'عدد المكيّفات',
      fridge: 'ثلاجة',
      freezer: 'مجمّد (فريزر)',
      lighting: 'الإضاءة',
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
    no: 'لا',
    alwaysOn: '، دائم التشغيل',
    nights: '، ليلاً',
    hUnit: 'س',
    bulbsWord: 'لمبة',
    typeWord: 'النوع —',
    customDevice: 'جهاز مخصّص',
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
    kva: 'kVA',
    battery: 'تخزين البطارية',
    kwh: 'kWh',
    dailyNeed: 'الاستهلاك اليومي المقدّر:',
    kwhPerDay: 'kWh/يومياً',
    nightNeed: 'الاستهلاك الليلي (البطارية):',
    kwhPerNight: 'kWh/ليلة',
    recommendedPackage: 'الباقة الموصى بها',
    packagePrefix: 'باقة ',
    batteryLiquid: 'سائلة (رصاص حمضي)',
    batteryLithium: 'ليثيوم',
    batteryLife4: 'عمر البطارية 4 سنوات',
    batteryLife10: 'عمر البطارية 10 سنوات',
    includesTitle: 'كل باقات القمة تشمل',
    includes: {
      installConnection: 'التركيب والتوصيل والملحقات',
      economyLighting: 'إضاءة اقتصادية',
      tvScreen: 'تلفزيون / شاشة',
      fridge: 'ثلاجة',
      freezerOrPump: 'مجمّد (فريزر) أو مضخة ماء',
    },
    runtimeNote: 'مدة التشغيل الاحتياطي حتى 12 ساعة حسب الأجهزة والاستخدام',
    warrantyNote: 'ضمان سنة على جميع القطع',
    addOnLine: (price: string) => 'إضافة اختيارية: صندوق بطاريات (بطاريتان) — ' + price + ' د.ل',
    termsNote: 'يشمل النطاق النهائي الأحمال المتفق عليها مع مهندسنا.',
    priceRef: 'مرجع التسعير',
    warningsTitle: 'يرجى الملاحظة',
    warnings: {
      heavyDutyLoad:
        'الأجهزة الثقيلة (فرن، غلّاية، نشّافة…) تستهلك طاقة كبيرة — سيراجعها مهندسنا معك.',
      acBtuExceeded:
        'أحد مكيّفاتك أكبر مما تدعمه هذه الباقة رسمياً — سيؤكّد مهندسنا الخيار المناسب.',
    },
    assumedTitle: 'افترضنا بعض التفاصيل',
    assumedBody: 'حيث لم تكن متأكداً، استخدمنا قيماً نموذجية — سيؤكّدها مهندسنا قبل التسعير النهائي.',
    assumptions: {
      acSizeAssumed: 'حجم المكيّف (12,000 BTU نموذجي)',
      lightingAssumed: 'قدرة اللمبات',
      customApplianceAssumed: 'قدرة الجهاز المخصّص',
    },
    customTitle: 'تحتاج إلى نظام مخصّص، ',
    customPackageName: 'نظام مخصّص',
    customBody:
      'احتياجاتك تتجاوز باقاتنا القياسية، لذا صمّمنا لك نظاماً مخصّصاً من قائمة مكوّناتنا. سيؤكّد مهندسنا التصميم والسعر النهائي معك عبر واتساب.',
    customPriceNote: 'تقدير على مستوى المكوّنات — سيؤكّد مهندسنا التصميم والسعر النهائي.',
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
    outage: {
      '0–4 hrs': '0–4 ساعات',
      '4–8 hrs': '4–8 ساعات',
      '8–12 hrs': '8–12 ساعة',
      'More than 12 hrs': 'أكثر من 12 ساعة',
    },
    operation: {
      essentials: 'الأساسيات فقط — إضاءة، ثلاجة، إنترنت، تلفزيون',
      essentials_fans_ac_part: 'الأساسيات + مراوح أو مكيّف واحد جزءاً من اليوم',
      essentials_ac_most: 'الأساسيات + مكيّف يعمل معظم اليوم',
      everything: 'كل شيء طوال اليوم — مثل كهرباء الشبكة العادية',
    },
    roof: {
      Small: 'صغيرة',
      Medium: 'متوسطة',
      Large: 'كبيرة',
      'Not sure': 'غير متأكد',
    },
    shade: { Yes: 'نعم', No: 'لا' },
    acCapacity: {
      '9000': '9,000 BTU',
      '12000': '12,000 BTU',
      '18000': '18,000 BTU',
      '24000': '24,000 BTU',
      '32000': '32,000 BTU',
    },
    inverter: { yes: 'نعم', no: 'لا', unsure: 'غير متأكد' },
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
    preset: {
      'Router / Internet': 'راوتر / إنترنت',
      TV: 'تلفزيون',
      'Phone / Laptop charger': 'شاحن هاتف / لابتوب',
      Fan: 'مروحة',
      'Water pump': 'مضخة ماء',
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
    acSuffix: 'مكيّف',
  },
  whatsappMsg: (name: string, q: WaQuote) =>
    q.isCustom
      ? 'مرحباً القمّة! لقد أكملت نموذج تقدير الطاقة الشمسية. اسمي ' +
        name +
        ' — احتياجي يتطلب نظاماً مخصّصاً، ابتداءً من ' +
        q.priceFrom.toLocaleString('en-US') +
        ' د.ل (استهلاك يومي ~' +
        q.dailyKwh +
        ' kWh). مرجع: ' +
        q.configVersion +
        '. يرجى تأكيد عرض السعر المخصّص مع مهندسكم.'
      : 'مرحباً القمّة! لقد أكملت نموذج تقدير الطاقة الشمسية. اسمي ' +
        name +
        ' — الباقة الموصى بها: ' +
        q.tier +
        '، ابتداءً من ' +
        q.priceFrom.toLocaleString('en-US') +
        ' د.ل (استهلاك يومي ~' +
        q.dailyKwh +
        ' kWh). مرجع: ' +
        q.configVersion +
        '. يرجى إرسال عرض السعر المفصّل.',
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
