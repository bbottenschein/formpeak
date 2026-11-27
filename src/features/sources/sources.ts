/** Geprüfte Quellen (SPEC › Quellen). Texte in messages `sources.items.<key>`. */
export const SOURCES = [
  { key: "hooper1995", url: "https://doi.org/10.2165/00007256-199520050-00003" },
  { key: "hooper1995b", url: "https://pubmed.ncbi.nlm.nih.gov/7898325/" },
  { key: "mclean2010", url: "https://pubmed.ncbi.nlm.nih.gov/20861526/" },
  { key: "saw2016", url: "https://bjsm.bmj.com/content/50/5/281.short" },
  { key: "buchheit2014", url: "https://pubmed.ncbi.nlm.nih.gov/24578692/" },
  { key: "foster2001", url: "https://pubmed.ncbi.nlm.nih.gov/11708692/" },
  { key: "gabbett2016", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4789704" },
  { key: "impellizzeri2020", url: "https://doi.org/10.1123/ijspp.2019-0864" },
  { key: "krustrup2003", url: "https://pubmed.ncbi.nlm.nih.gov/12673156/" },
  { key: "myjump", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10656545" },
  { key: "sprint2025", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11991301/" },
  { key: "lsi2021", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7863609" },
  { key: "ybalance2023", url: "https://pubmed.ncbi.nlm.nih.gov/37875255/" },
  // Trainingsplanung (plan/basis.ts) – geprüft gegen PubMed/Crossref
  { key: "wisloff2004", url: "https://doi.org/10.1136/bjsm.2002.002071" },
  { key: "schoenfeld2017", url: "https://doi.org/10.1080/02640414.2016.1210197" },
  { key: "helgerud2001", url: "https://doi.org/10.1097/00005768-200111000-00019" },
  { key: "seiler2010", url: "https://doi.org/10.1123/ijspp.5.3.276" },
  { key: "malone2017", url: "https://doi.org/10.1016/j.jsams.2016.08.005" },
  { key: "malone2018", url: "https://doi.org/10.1016/j.jsams.2017.05.016" },
  { key: "petersen2011", url: "https://doi.org/10.1177/0363546511419277" },
  { key: "vanderhorst2015", url: "https://doi.org/10.1177/0363546515574057" },
  { key: "haroy2019", url: "https://doi.org/10.1136/bjsports-2017-098937" },
  { key: "soligard2008", url: "https://doi.org/10.1136/bmj.a2469" },
  { key: "thorborg2017", url: "https://doi.org/10.1136/bjsports-2016-097066" },
  { key: "bosquet2007", url: "https://doi.org/10.1249/mss.0b013e31806010e0" },
  { key: "mujika2000", url: "https://doi.org/10.2165/00007256-200030020-00002" },
  { key: "vanhooren2018", url: "https://doi.org/10.1007/s40279-018-0916-2" },
] as const;

export type SourceKey = (typeof SOURCES)[number]["key"];
