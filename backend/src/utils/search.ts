// Поиск без учёта регистра. На SQLite LIKE складывал только латиницу, и
// кириллицу приходилось искать перебором написаний («молоко», «Молоко»,
// «МОЛОКО»…), а смешанный регистр не находился вовсе. В Postgres LIKE
// чувствителен к регистру целиком, зато ILIKE (mode: "insensitive")
// складывает любые буквы — при UTF-8-локали базы, которую сервер проверяет
// при старте (src/index.ts).
export function ci(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

// "молоко лактис" finds "Молоко «Лактис» 3,2%": every word must match somewhere,
// in any order. Capped so a pasted paragraph cannot build a monster query.
export function searchTokens(search: string, max = 5): string[] {
  return search.trim().split(/\s+/).filter(Boolean).slice(0, max);
}
