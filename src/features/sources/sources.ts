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
] as const;

export type SourceKey = (typeof SOURCES)[number]["key"];
