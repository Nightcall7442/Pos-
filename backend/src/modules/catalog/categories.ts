// Open Food Facts files every product under a tree of English tags — a cola
// carries "en:beverages", "en:carbonated-drinks", "en:sodas", "en:colas" (every
// ancestor is listed too). A shop wants one plain Russian shelf name. The first
// rule that matches wins, so the order below is the priority: specific shelves
// come before the broad ones ("milk chocolate" must not land among dairy).

const RULES: [string, string[]][] = [
  ["Алкоголь", ["en:alcoholic-beverages", "en:beers", "en:wines", "en:spirits", "en:vodkas", "en:whiskies", "en:liqueurs", "en:ciders"]],
  ["Детское питание", ["en:baby-foods", "en:infant-formulas", "en:baby-milks", "en:baby-cereals"]],
  ["Готовая еда", ["en:meals", "en:prepared-salads", "en:microwave-meals", "en:sandwiches", "en:pizzas-pies-and-quiches", "en:pasta-dishes", "en:pizzas", "en:crepes-and-galettes", "en:salads", "en:rice-dishes", "en:fresh-meals"]],
  ["Спортпит и добавки", ["en:dietary-supplements", "en:bodybuilding-supplements", "en:protein-powders", "en:vitamins", "en:protein-shakes"]],
  ["Зоотовары", ["en:pet-food", "en:cat-food", "en:dog-food", "en:pet-foods"]],
  ["Заморозка", ["en:frozen-foods", "en:frozen-desserts", "en:frozen-vegetables", "en:frozen-meals", "en:ice-creams-and-sorbets", "en:ice-creams"]],
  ["Консервы", ["en:canned-foods", "en:canned-vegetables", "en:canned-fruits", "en:canned-fishes", "en:canned-meals", "en:pickles"]],
  ["Сладости", ["en:sweet-snacks", "en:confectioneries", "en:chocolates", "en:candies", "en:biscuits-and-cakes", "en:biscuits", "en:cakes", "en:desserts", "en:sweet-spreads", "en:chocolate-spreads", "en:jams", "en:chewing-gum", "en:honeys", "en:halva", "en:protein-bars", "en:cereal-bars"]],
  ["Снеки", ["en:salty-snacks", "en:appetizers", "en:chips-and-fries", "en:crisps", "en:crackers", "en:nuts", "en:popcorn", "en:snacks", "en:sunflower-seeds", "en:pumpkin-seeds", "en:nuts-and-their-products", "en:seeds"]],
  ["Напитки", ["en:beverages", "en:waters", "en:juices", "en:sodas", "en:carbonated-drinks", "en:teas", "en:coffees", "en:energy-drinks", "en:plant-based-beverages", "en:iced-teas", "en:beverages-and-beverages-preparations", "en:beverage-preparations", "en:instant-beverages", "en:herbal-teas"]],
  ["Молочные продукты", ["en:dairies", "en:milks", "en:cheeses", "en:yogurts", "en:butters", "en:creams", "en:fermented-milk-products", "en:eggs"]],
  ["Мясо и птица", ["en:meats-and-their-products", "en:meats", "en:poultries", "en:sausages", "en:hams", "en:prepared-meats", "en:pork", "en:beef"]],
  ["Рыба и морепродукты", ["en:seafood", "en:fishes-and-their-products", "en:fishes", "en:smoked-fishes"]],
  ["Хлеб и выпечка", ["en:breads", "en:pastries", "en:viennoiseries", "en:buns", "en:flatbreads", "en:rusks"]],
  ["Овощи и фрукты", ["en:fruits-and-vegetables-based-foods", "en:fruits", "en:vegetables", "en:fresh-fruits", "en:fresh-vegetables", "en:legumes-and-their-products", "en:mushrooms-and-their-products"]],
  ["Гигиена и косметика", ["en:beauty", "en:cosmetics", "en:hygiene", "en:body-care", "en:hair-care", "en:face-care", "en:oral-hygiene", "en:toothpastes", "en:shampoos", "en:deodorants", "en:soaps", "en:shower-gels", "en:personal-care", "en:perfumes", "en:cosmetic-products", "en:open-beauty-facts"]],
  ["Бытовая химия", ["en:cleaning-products", "en:detergents", "en:household-products", "en:laundry-detergents", "en:dishwashing-products", "en:household-cleaners"]],
  ["Бакалея", ["en:cereals-and-potatoes", "en:cereals-and-their-products", "en:pastas", "en:rices", "en:flours", "en:sugars", "en:salts", "en:fats", "en:vegetable-oils", "en:condiments", "en:sauces", "en:spices", "en:soups", "en:breakfast-cereals", "en:noodles", "en:groceries", "en:spreads", "en:plant-based-spreads", "en:sweeteners", "en:syrups", "en:cocoa-and-its-products", "en:cocoa-powders", "en:broths", "en:bouillon-cubes", "en:cooking-helpers", "en:nut-butters"]],
];

export const SHELF_NAMES: string[] = RULES.map(([shelf]) => shelf);

/** "en:beverages,en:sodas,fr:boissons" (or an array) → "Напитки"; null when nothing matches. */
export function shelfFor(categoriesTags: string | string[] | null | undefined): string | null {
  const tags = new Set(
    (Array.isArray(categoriesTags) ? categoriesTags : String(categoriesTags ?? "").split(","))
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.startsWith("en:"))
  );
  if (tags.size === 0) return null;
  for (const [shelf, matching] of RULES) {
    if (matching.some((tag) => tags.has(tag))) return shelf;
  }
  return null;
}

// Two fifths of the goods carry no category tags at all, but the name usually
// says what the thing is — in Russian, Uzbek, Turkish or English. A root matches
// at the beginning of a word; a root ending in "=" must be a whole word. Of all
// the hits the one nearest the start of the name wins ("Чай молочный" is tea;
// "Соус со сметаной" is a sauce), and ties go to the shelf listed first. Only a
// suggestion: the shop can change it. When in doubt there is no answer.
const NAME_RULES: [string, string[]][] = [
  ["Зоотовары", ["корм для", "для кошек", "для собак", "cat food", "dog food", "pet food", "whiskas", "pedigree", "kitekat", "purina", "royal canin", "churu", "chappi"]],
  ["Алкоголь", ["пиво", "вино=", "вина=", "водка", "водки", "коньяк", "виски=", "шампанск", "ликёр", "ликер", "beer", "wine=", "vodka", "whisky", "whiskey", "cognac", "champagne", "bira=", "şarap", "sarap", "rakı"]],
  ["Гигиена и косметика", ["шампун", "мыло", "зубная паста", "зубная щётка", "дезодорант", "гель для душа", "подгузник", "прокладк", "бритв", "shampoo", "soap", "toothpaste", "deodorant", "şampuan", "sampuan", "sabun", "shower gel", "хна=", "крем для"]],
  ["Бытовая химия", ["стиральн", "моющ", "чистящ", "средство для мытья", "средство для чистки", "средство для стирки", "средство для унитаз", "отбеливател", "fairy", "domestos", "persil", "detergent", "bleach", "deterjan", "çamaşır suyu", "bulaşık"]],
  ["Детское питание", ["смесь молочная", "детское питание", "детское пюре", "каша детская", "фрутоняня", "агуша", "нутрилон", "nutrilon", "gerber", "similac"]],
  ["Заморозка", ["заморож", "мороженое", "мороженое=", "пельмен", "вареник", "ice cream", "dondurma", "frozen", "donmuş"]],
  ["Консервы", ["консерв", "тушёнк", "тушенк", "шпроты", "canned", "konserve"]],
  ["Мясо и птица", ["колбас", "сосиск", "сардельк", "ветчин", "бекон", "мясо=", "мясн", "курица=", "куриц", "говядин", "свинин", "баранин", "фарш", "sausage", "chicken", "beef", "sucuk", "sosis", "tavuk", "kıyma", "go'sht"]],
  ["Рыба и морепродукты", ["рыба=", "рыбн", "лосос", "сельд", "тунец", "икра=", "креветк", "salmon", "tuna", "shrimp", "balık", "balik"]],
  ["Молочные продукты", ["молоко=", "молока=", "молочн", "кефир", "йогурт", "творог", "творож", "сметан", "сыр=", "сыры=", "сыра=", "сливк", "ряженк", "простокваш", "масло сливочное", "milk", "yogurt", "yoghurt", "cheese", "peynir", "yoğurt", "ayran", "tereyağ", "kaymak", "süt=", "sut=", "qatiq"]],
  ["Хлеб и выпечка", ["хлеб=", "хлеба=", "хлебц", "батон=", "лепёшк", "лепешк", "булочк", "булка=", "круассан", "багет", "bread=", "croissant", "ekmek", "simit", "non="]],
  ["Сладости", ["шоколад", "конфет", "печенье", "печеньк", "вафл", "мармелад", "зефир", "карамел", "жевательн", "жвачк", "пряник", "торт=", "торты=", "торта=", "пирожн", "халва", "chocolate", "candy", "biscuit", "cookie", "wafer", "gummy", "gum=", "çikolata", "cikolata", "bisküvi", "biskuvi", "gofret", "lokum", "helva"]],
  ["Снеки", ["чипсы", "сухарик", "семечк", "попкорн", "крекер", "кириешк", "chips=", "cracker", "popcorn", "çerez", "cerez"]],
  ["Напитки", ["вода=", "воды=", "сок=", "соки=", "нектар", "лимонад", "газированн", "кола=", "пепси", "фанта=", "спрайт", "чай=", "кофе=", "напиток", "морс=", "квас=", "энергетик", "water=", "juice", "soda=", "cola=", "tea=", "coffee=", "drink=", "beverage", "meyve suyu", "içecek", "icecek", "gazoz", "çay=", "kahve", "nescafe", "suv=", "choy="]],
  ["Бакалея", ["макарон", "крупа=", "крупы=", "гречк", "гречнев", "рис=", "риса=", "мука=", "муки=", "сахар", "соль=", "соли=", "масло подсолнечн", "масло растительн", "кетчуп", "майонез", "соус", "специи", "приправ", "лапша=", "вермишел", "спагетти", "pasta=", "rice=", "flour=", "sugar=", "salt=", "sauce", "ketchup", "mayonnaise", "noodle", "makarna", "pirinç", "pirinc", "salça", "mayonez", "ketçap", "qand=", "guruch"]],
];

const NAME_PATTERNS: [string, RegExp][] = NAME_RULES.map(([shelf, roots]) => [
  shelf,
  // "(?<![\p{L}])" is a word beginning that also works for Cyrillic, where \b does not.
  new RegExp(
    roots
      .map((root) => {
        const whole = root.endsWith("=");
        const body = (whole ? root.slice(0, -1) : root).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
        return `(?<![\\p{L}])${body}${whole ? "(?![\\p{L}])" : ""}`;
      })
      .join("|"),
    "iu"
  ),
]);

/** "Молоко Простоквашино 3,2%" → "Молочные продукты"; null when the name gives no clue. */
export function shelfFromName(name: string | null | undefined): string | null {
  const text = String(name ?? "");
  if (text.length < 3) return null;
  let best: { shelf: string; at: number } | null = null;
  for (const [shelf, pattern] of NAME_PATTERNS) {
    const hit = pattern.exec(text);
    if (hit && (!best || hit.index < best.at)) best = { shelf, at: hit.index };
  }
  return best?.shelf ?? null;
}
