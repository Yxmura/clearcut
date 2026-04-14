"use client";

import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <div className="p-2 flex mx-2 justify-between border-foreground border-2 border-t-0 border-l-0 border-r-0 mb-4">
      <div className="flex items-center gap-2">
        <Button variant="link">HOME</Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground">EN</span>
      </div>
    </div>
  );
};

export default Navbar;