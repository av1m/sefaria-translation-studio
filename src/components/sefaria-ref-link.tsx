import { refToSefariaUrl } from "@/lib/parse-ref";

export function SefariaRefLink({
  ref: sefariaRef,
  lang,
  className,
}: {
  ref: string;
  lang?: string;
  className?: string;
}) {
  return (
    <a
      href={refToSefariaUrl(sefariaRef, lang)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "shrink-0 text-xs font-medium text-sefaria hover:text-sefaria-hover hover:underline"
      }
    >
      Sefaria ↗
    </a>
  );
}
