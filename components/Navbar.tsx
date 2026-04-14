"use client";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import Link from "next/link";

interface NavbarProps {
  currentLang?: "en" | "nl";
  currentPage?: "home" | "blog" | "blogView";
  noBorder?: boolean;
}

const translations = {
  en: {
    home: "HOME",
    blog: "BLOG",
  },
  nl: {
    home: "HOME",
    blog: "BLOG",
  },
} as const;

const Navbar = ({ currentLang = "en", currentPage = "home", noBorder = false }: NavbarProps) => {
  const { isMobile } = useIsMobile();
  const t = translations[currentLang];

  return (
    <div className={`p-2 flex mx-2 justify-between ${noBorder ? "" : "border-foreground border-2 border-t-0 border-l-0 border-r-0 mb-4"}`}>
      <div className="flex items-center gap-2">
        {currentPage !== "home" && (
          <>
            <Link href={`/${currentLang}`}>
              <Button variant="link">{t.home}</Button>
            </Link>
            <span className="text-muted-foreground opacity-50">/</span>
          </>
        )}
        {currentPage === "home" && (
          <span className="text-sm px-4">{t.home}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/${currentLang}`}>
          <Button variant="link" className={currentLang === "en" ? "text-foreground" : ""}>
            {isMobile ? "EN" : "ENGLISH"}
          </Button>
        </Link>
        <span className="text-muted-foreground opacity-50">|</span>
        <Link href={`/nl`}>
          <Button variant="link" className={currentLang === "nl" ? "text-foreground" : ""}>
            {isMobile ? "NL" : "NEDERLANDS"}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Navbar;