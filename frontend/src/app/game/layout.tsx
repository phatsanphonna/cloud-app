'use client'

import { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const GameLayout: FC<Props> = ({ children }) => {
  return (
    <section className="min-h-screen w-full pb-12 pt-16 sm:pt-20">
      {children}
    </section>
  );
};

export default GameLayout;
