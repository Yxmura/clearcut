"use client";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";

const Navbar = () => {
  const { isMobile } = useIsMobile();

  return (
    <div className="p-2 flex mx-2 justify-between border-foreground border-2 border-t-0 border-l-0 border-r-0 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-sm px-4">HOME</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm px-4 text-foreground">ENGLISH</span>
        <span className="text-muted-foreground opacity-50">|</span>
        <span className="text-sm px-4 opacity-50">NEDERLANDS</span>
      </div>
    </div>
  );
};

export default Navbar;