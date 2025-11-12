'use client'

import { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const GameLayout: FC<Props> = ({ children }) => {
  return (
    <div className="w-[100vw] -mx-8 sm:-mx-20 -mb-20 min-h-[calc(100vh-56px)] -mt-8 sm:-mt-10">
      {children}
    </div>
  );
};

export default GameLayout;
