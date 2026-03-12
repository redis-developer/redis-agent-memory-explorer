"use client";

import type { ReactNode } from "react";

import "./section-card.component.css";

type SectionCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const SectionCard = ({ title, description, actions, children }: SectionCardProps) => {
  return (
    <div className="section-card">
      <div className="section-card__header">
        <div className="section-card__header-text">
          <h3 className="section-card__title">{title}</h3>
          {description && (
            <p className="section-card__description">{description}</p>
          )}
        </div>
        {actions && <div className="section-card__actions">{actions}</div>}
      </div>
      <div className="section-card__body">{children}</div>
    </div>
  );
};

export { SectionCard };
export type { SectionCardProps };
